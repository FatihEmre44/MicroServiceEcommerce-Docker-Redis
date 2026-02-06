const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
require('dotenv').config();

const createSuperAdmin = async () => {
    try {
        // MongoDB'ye bağlan
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB bağlantısı başarılı');

        // Admin zaten var mı kontrol et
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
            console.log('Zaten bir admin mevcut:', existingAdmin.email);
            process.exit(0);
        }

        // Süper admin bilgileri (.env'den ZORUNLU)
        if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
            console.error('HATA: .env dosyasında ADMIN_USERNAME, ADMIN_EMAIL ve ADMIN_PASSWORD tanımlanmalı!');
            process.exit(1);
        }

        const adminData = {
            username: process.env.ADMIN_USERNAME,
            email: process.env.ADMIN_EMAIL,
            password: await bcrypt.hash(process.env.ADMIN_PASSWORD, 10),
            role: 'admin'
        };

        // Admin oluştur
        const admin = new User(adminData);
        await admin.save();

        console.log(' Süper admin başarıyla oluşturuldu!');
        console.log('  Email:', adminData.email);
        console.log('  Username:', adminData.username);
        
        process.exit(0);
    } catch (err) {
        console.error(' Admin oluşturma hatası:', err.message);
        process.exit(1);
    }
};

createSuperAdmin();
