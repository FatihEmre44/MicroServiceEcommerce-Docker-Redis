const { getRedisClient } = require('../config/redis');


const searchProducts = async (req, res) => {
    try {
        const redis = getRedisClient();
        const { q, category, minPrice, maxPrice, page = 1, limit = 10 } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);

        let productIds = [];

        // 1. Başlangıç: Kategori filtresi varsa kategori setinden, yoksa tüm ürünlerden
        if (category) {
            const categoryKey = `products:category:${category.toLowerCase()}`;
            productIds = await redis.smembers(categoryKey);
        } else {
            // Tüm ürünleri al (en yeniden en eskiye)
            productIds = await redis.zrevrange('products:all', 0, -1);
        }

        if (productIds.length === 0) {
            return res.json({
                products: [],
                pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 }
            });
        }

        // 2. Tüm ürün verilerini Redis'ten topla
        const pipeline = redis.pipeline();
        for (const id of productIds) {
            pipeline.hgetall(`product:${id}`);
        }
        const results = await pipeline.exec();

        // 3. Ürünleri parse et ve filtrele
        let products = results
            .map(([err, data]) => {
                if (err || !data || !data.id) return null;
                return {
                    id: data.id,
                    name: data.name,
                    description: data.description,
                    price: Number(data.price),
                    stock: Number(data.stock),
                    category: data.category,
                    isActive: data.isActive === 'true',
                    images: JSON.parse(data.images || '[]'),
                    sellerId: data.sellerId,
                    createdAt: data.createdAt
                };
            })
            .filter(p => p !== null && p.isActive);

        // Arama sorgusu filtresi (isim ve açıklama)
        if (q) {
            const queryLower = q.toLowerCase();
            products = products.filter(p =>
                p.name.toLowerCase().includes(queryLower) ||
                p.description.toLowerCase().includes(queryLower)
            );
        }

        // Fiyat filtresi
        if (minPrice) {
            products = products.filter(p => p.price >= Number(minPrice));
        }
        if (maxPrice) {
            products = products.filter(p => p.price <= Number(maxPrice));
        }

        // 4. Sıralama (en yeni ilk)
        products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // 5. Pagination
        const total = products.length;
        const start = (pageNum - 1) * limitNum;
        const paginatedProducts = products.slice(start, start + limitNum);

        res.json({
            products: paginatedProducts,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        console.error('[SEARCH HATA]', err.message);
        res.status(500).json({ error: err.message });
    }
};


const getSuggestions = async (req, res) => {
    try {
        const redis = getRedisClient();
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.json({ suggestions: [] });
        }

        const prefix = q.toLowerCase();
        const allEntries = await redis.zrangebylex(
            'search:autocomplete',
            `[${prefix}`,
            `[${prefix}\xff`,
            'LIMIT', 0, 10
        );

        // Benzersiz ürün isimlerini çıkar
        const seen = new Set();
        const suggestions = [];

        for (const entry of allEntries) {
            const parts = entry.split(':');
            // Format: prefix:productId:fullName
            if (parts.length >= 3) {
                const fullName = parts.slice(2).join(':'); // İsimde ':' olabilir
                if (!seen.has(fullName)) {
                    seen.add(fullName);
                    suggestions.push(fullName);
                }
            }
        }

        res.json({ suggestions: suggestions.slice(0, 5) });
    } catch (err) {
        console.error('[SUGGESTION HATA]', err.message);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Tek ürün detayı (Redis cache'ten)
 * GET /api/search/product/:id
 */
const getProductById = async (req, res) => {
    try {
        const redis = getRedisClient();
        const { id } = req.params;
        const data = await redis.hgetall(`product:${id}`);

        if (!data || !data.id) {
            return res.status(404).json({ error: 'Ürün bulunamadı' });
        }

        const product = {
            id: data.id,
            name: data.name,
            description: data.description,
            price: Number(data.price),
            stock: Number(data.stock),
            category: data.category,
            isActive: data.isActive === 'true',
            images: JSON.parse(data.images || '[]'),
            sellerId: data.sellerId,
            createdAt: data.createdAt
        };

        res.json(product);
    } catch (err) {
        console.error('[PRODUCT HATA]', err.message);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { searchProducts, getSuggestions, getProductById };
