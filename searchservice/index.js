const express = require('express');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cors = require('cors');

const { connectRedis } = require('./config/redis');
const { connectRabbit, startConsumers } = require('./message/rabbitmq');

dotenv.config();
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// --- MİMARİ BAŞLATMA FONKSİYONU ---
async function startServer() {
    try {
        // 1. Redis Bağlantısı
        await connectRedis();

        // 2. RabbitMQ Bağlantısı
        await connectRabbit();

        // 3. Olay Dinleyicilerini Başlat (Ürün indeksleme)
        await startConsumers();

        // 4. Routes & Server Start
        const searchRoutes = require('./routes/search');
        app.use('/api/search', searchRoutes);

        // Health Check
        app.get('/health', (req, res) => {
            res.json({ status: 'ok', service: 'search-service', timestamp: new Date() });
        });

        const PORT = process.env.PORT || 3004;
        app.listen(PORT, () => {
            console.log(`✅ Search Service running on port ${PORT}`);
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
