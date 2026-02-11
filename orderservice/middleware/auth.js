const jwt = require('jsonwebtoken');

// JWT doğrulama middleware (Yerel Doğrulama - Decoupled)
const verifyTokenRemote = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token bulunamadı' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const jwtSecret = process.env.JWT_SECRET;
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded; // { userId, email, role }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Geçersiz token', details: err.message });
    }
};

module.exports = { verifyTokenRemote };
