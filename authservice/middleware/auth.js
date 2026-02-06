const jwt = require('jsonwebtoken');

// JWT doğrulama middleware
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token bulunamadı' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { userId, email, role }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Geçersiz token' });
    }
};

// Admin kontrolü middleware
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
    }
    next();
};

// Satıcı veya Admin kontrolü
const isSellerOrAdmin = (req, res, next) => {
    if (req.user.role !== 'seller' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Bu işlem için satıcı veya admin yetkisi gerekli' });
    }
    next();
};

module.exports = { verifyToken, isAdmin, isSellerOrAdmin };
