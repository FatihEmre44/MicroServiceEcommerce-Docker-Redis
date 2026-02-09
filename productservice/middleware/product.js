
const jwt = require('jsonwebtoken');
const Product = require('../models/product');

// JWT doğrulama middleware (Yerel Doğrulama - Decoupled)
const verifyTokenRemote = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token bulunamadı' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Auth Service ile aynı gizli anahtarı kullanarak token'ı çözüyoruz
        const jwtSecret = process.env.JWT_SECRET;
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded; // { userId, email, role }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Geçersiz token', details: err.message });
    }
};

// Check if user is owner or admin
const checkOwnerOrAdmin = async (req, res, next) => {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // req.user._id veya req.user.userId formatına göre kontrol edelim
    // Auth servisinden dönen payload yapısına bağlı. Genelde userId veya _id olur.
    // Şimdilik userId ve _id ikisini de kontrol edelim.
    const userId = req.user.userId || req.user._id;

    if (product.sellerId.equals(userId) || req.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ error: 'Unauthorized' });
};

module.exports = {
    checkOwnerOrAdmin,
    verifyTokenRemote
};
