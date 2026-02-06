
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { publishEvent } = require('../message/producer');


exports.register = async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        // Kullanıcı var mı kontrol et
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ error: 'Bu e-posta veya kullanıcı adı zaten kayıtlı' });
        }

        // Role validasyonu - admin dışarıdan kayıt olamaz (güvenlik)
        const allowedRoles = ['customer', 'seller'];
        const userRole = allowedRoles.includes(role) ? role : 'customer';

        // Şifreyi hashle
        const hashedPassword = await bcrypt.hash(password, 10);

        // Yeni kullanıcı oluştur
        const user = new User({
            username,
            email,
            password: hashedPassword,
            role: userRole
        });

        await user.save();

        // Diğer servislere yeni kullanıcı oluşturulduğunu haber ver
        publishEvent('USER_CREATED', { userId: user._id, username: user.username, role: user.role });

        res.status(201).json({ message: 'Kullanıcı başarıyla oluşturuldu', userId: user._id, role: user.role });
    } catch (err) {
        res.status(500).json({ error: 'Kayıt işlemi başarısız', details: err.message });
    }
};


exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email ve şifre gerekli' });
        }

        const user = await User.findOne({ email });

        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign(
                { userId: user._id, email: user.email, role: user.role }, 
                process.env.JWT_SECRET, 
                { expiresIn: '1h' }
            );
            return res.json({ token, role: user.role });
        }
        res.status(401).json({ error: "Geçersiz e-posta veya şifre" });
    } catch (err) {
        res.status(500).json({ error: 'Giriş işlemi başarısız', details: err.message });
    }
};


exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Kullanıcı sadece kendi hesabını güncelleyebilir (admin hariç)
        if (req.user.userId !== id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Sadece kendi hesabınızı güncelleyebilirsiniz' });
        }

        // Role değişikliği sadece admin yapabilir
        if (updates.role && req.user.role !== 'admin') {
            delete updates.role;
        }

        if (updates.password) {
            updates.password = await bcrypt.hash(updates.password, 10);
        }

        const updatedUser = await User.findByIdAndUpdate(id, updates, { new: true });
        
        if (!updatedUser) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }

        // Diğer servislere kullanıcı bilgilerinin değiştiğini haber ver
        publishEvent('USER_UPDATED', { userId: id, username: updatedUser.username });

        res.json({ message: 'Kullanıcı güncellendi', user: { username: updatedUser.username, email: updatedUser.email, role: updatedUser.role } });
    } catch (err) {
        res.status(400).json({ error: "Güncelleme başarısız", details: err.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Kullanıcı sadece kendi hesabını silebilir (admin hariç)
        if (req.user.userId !== id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Sadece kendi hesabınızı silebilirsiniz' });
        }

        const deletedUser = await User.findByIdAndDelete(id);
        
        if (!deletedUser) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }

        publishEvent('USER_DELETED', { userId: id });

        res.json({ message: "Kullanıcı başarıyla silindi" });
    } catch (err) {
        res.status(400).json({ error: "Silme işlemi başarısız", details: err.message });
    }
};

// CREATE ADMIN MANTIĞI (Sadece mevcut adminler kullanabilir)
exports.createAdmin = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Kullanıcı var mı kontrol et
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ error: 'Bu e-posta veya kullanıcı adı zaten kayıtlı' });
        }

        // Şifreyi hashle
        const hashedPassword = await bcrypt.hash(password, 10);

        // Yeni admin oluştur
        const admin = new User({
            username,
            email,
            password: hashedPassword,
            role: 'admin'
        });

        await admin.save();

        // Log: Kim oluşturdu bilgisi
        console.log(`Admin oluşturuldu: ${email} (Oluşturan: ${req.user.email})`);

        res.status(201).json({ 
            message: 'Admin başarıyla oluşturuldu', 
            adminId: admin._id,
            createdBy: req.user.email
        });
    } catch (err) {
        res.status(500).json({ error: 'Admin oluşturma başarısız', details: err.message });
    }
};