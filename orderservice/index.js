const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cors = require('cors');

// RabbitMQ ve Senkronizasyon
const { connectRabbit } = require('./message/rabbitmq_helper');
const { syncProductData } = require('./message/syncProductData');

dotenv.config();
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// --- MİMARİ BAŞLATMA FONKSİYONU ---
async function startServer() {
    try {
        // 1. MongoDB Bağlantısı
        const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/orderdb';
        await mongoose.connect(MONGO_URI);
        console.log('🚀 Order Service MongoDB connected');

        // 2. RabbitMQ Bağlantısı
        await connectRabbit();

        // --- EVENT CONSUMERS (Olay Dinleyicileri) ---

        // KANAL A: Ürün güncellemeleri dinle → ProductRef tablosunu güncelle
        await syncProductData();

        // 3. Routes & Server Start
        const orderRoutes = require('./routes/order');
        app.use('/api/orders', orderRoutes);

        // Health Check
        app.get('/health', (req, res) => {
            res.json({ status: 'ok', service: 'order-service', timestamp: new Date() });
        });

        const PORT = process.env.PORT || 3003;
        app.listen(PORT, () => {
            console.log(`✅ Order Service running on port ${PORT}`);
        });

    } catch (error) {
        console.error('❌ Servis başlatılamadı:', error.message);
        process.exit(1);
    }
}

// Global Hata Yönetimi
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

startServer();
