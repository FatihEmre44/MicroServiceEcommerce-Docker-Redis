const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cors = require('cors');

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/productdb';
mongoose.connect(MONGO_URI)
    .then(() => console.log(' Product Service MongoDB connected'))
    .catch(err => console.error(' Product Service MongoDB connection error:', err));

// RabbitMQ Event Consumer (Event-Driven Architecture)
const { connectRabbit, consumeEvent } = require('./message/producer');

// RabbitMQ bağlantısı kur ve eventleri dinlemeye başla
connectRabbit().then(() => {
    // Auth servisinden gelen "Yeni kullanıcı oluşturuldu" eventini dinle
    consumeEvent('USER_CREATED', (data) => {
        console.log('[EVENT] Yeni kullanıcı kaydoldu:', data.username, '| Role:', data.role);
        // Burada kullanıcıya özel işlemler yapılabilir (örn: varsayılan ürün listesi oluştur)
    });

    // Auth servisinden gelen "Kullanıcı güncellendi" eventini dinle
    consumeEvent('USER_UPDATED', (data) => {
        console.log('[EVENT] Kullanıcı güncellendi:', data.userId);
    });

    // Auth servisinden gelen "Kullanıcı silindi" eventini dinle
    consumeEvent('USER_DELETED', (data) => {
        console.log('[EVENT] Kullanıcı silindi:', data.userId);
        // Burada kullanıcının ürünlerini silme/pasife alma işlemi yapılabilir
    });
}).catch(err => console.error('RabbitMQ event listener başlatılamadı:', err));

// Routes
const productRoutes = require('./routes/product');
app.use('/api/products', productRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'product-service',
        timestamp: new Date()
    });
});

// Error Handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3002; // Auth is 3001
app.listen(PORT, () => {
    console.log(` Product Service running on port ${PORT}`);
});
