const amqp = require('amqplib');
const { getRedisClient } = require('../config/redis');

let channel;

/**
 * RabbitMQ bağlantısı
 */
async function connectRabbit(retries = 5, delay = 3000) {
    for (let i = 0; i < retries; i++) {
        try {
            const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
            channel = await connection.createChannel();
            console.log('🐰 RabbitMQ bağlantısı başarılı (searchservice)');
            return;
        } catch (err) {
            console.log(`RabbitMQ bağlantı denemesi ${i + 1}/${retries} başarısız. ${delay / 1000}s sonra tekrar...`);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw new Error('RabbitMQ bağlantısı kurulamadı!');
}

/**
 * Ürün verilerini Redis'e indeksler
 */
async function indexProduct(product) {
    const redis = getRedisClient();
    const key = `product:${product.id}`;

    // Ürün verilerini hash olarak sakla
    await redis.hset(key,
        'id', product.id,
        'name', product.name || '',
        'description', product.description || '',
        'price', String(product.price || 0),
        'stock', String(product.stock || 0),
        'category', product.category || '',
        'isActive', String(product.isActive !== false),
        'images', JSON.stringify(product.images || []),
        'sellerId', product.sellerId || '',
        'createdAt', product.createdAt || new Date().toISOString()
    );

    // Ürünü genel sıralı kümeye ekle (timestamp ile sıralama)
    const score = new Date(product.createdAt || Date.now()).getTime();
    await redis.zadd('products:all', score, product.id);

    // Kategori indeksi
    if (product.category) {
        const categoryKey = `products:category:${product.category.toLowerCase()}`;
        await redis.sadd(categoryKey, product.id);
    }

    // Autocomplete indeksi — ürün adını küçük harfle prefix olarak ekle
    if (product.name) {
        const nameLower = product.name.toLowerCase();
        // İsmin her prefix'ini ekle (min 2 karakter)
        for (let i = 2; i <= nameLower.length; i++) {
            const prefix = nameLower.substring(0, i);
            await redis.zadd('search:autocomplete', 0, `${prefix}:${product.id}:${nameLower}`);
        }
    }

    console.log(`[INDEX] Ürün indekslendi: ${product.id} - ${product.name}`);
}

/**
 * Ürünü Redis indeksinden siler
 */
async function removeProductIndex(productId) {
    const redis = getRedisClient();
    const key = `product:${productId}`;

    // Önce mevcut veriyi oku (kategori ve isim temizliği için)
    const existing = await redis.hgetall(key);

    if (existing && existing.name) {
        // Autocomplete kayıtlarını temizle
        const nameLower = existing.name.toLowerCase();
        for (let i = 2; i <= nameLower.length; i++) {
            const prefix = nameLower.substring(0, i);
            await redis.zrem('search:autocomplete', `${prefix}:${productId}:${nameLower}`);
        }
    }

    if (existing && existing.category) {
        // Kategori indeksinden çıkar
        const categoryKey = `products:category:${existing.category.toLowerCase()}`;
        await redis.srem(categoryKey, productId);
    }

    // Hash ve sorted set'ten sil
    await redis.del(key);
    await redis.zrem('products:all', productId);

    console.log(`[INDEX] Ürün indeksten silindi: ${productId}`);
}

/**
 * RabbitMQ'dan gelen olayları dinle ve Redis'i güncelle
 */
async function startConsumers() {
    if (!channel) throw new Error('RabbitMQ hazır değil!');

    const queue = 'product_search_index';
    await channel.assertQueue(queue, { durable: true });

    console.log(`[SEARCH] "${queue}" kuyruğu dinleniyor...`);

    channel.consume(queue, async (msg) => {
        if (!msg) return;

        try {
            const event = JSON.parse(msg.content.toString());
            console.log(`[EVENT] Alınan olay: ${event.type}`);

            switch (event.type) {
                case 'PRODUCT_CREATED':
                case 'PRODUCT_UPDATED':
                    await indexProduct(event.data);
                    break;

                case 'PRODUCT_DELETED':
                    await removeProductIndex(event.data.id);
                    break;

                default:
                    console.log(`[EVENT] Bilinmeyen olay tipi: ${event.type}`);
            }

            channel.ack(msg);
        } catch (err) {
            console.error('[EVENT HATA] Olay işlenirken hata:', err.message);
            // Hata durumunda mesajı tekrar kuyruğa gönder
            channel.nack(msg, false, true);
        }
    });
}

module.exports = { connectRabbit, startConsumers };
