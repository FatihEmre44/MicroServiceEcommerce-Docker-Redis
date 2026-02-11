const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cors = require('cors');

// Modeller ve Yardımcılar
const Product = require('./models/product');
const { connectRabbit, consumeEvent } = require('./message/producer'); 

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
        const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/productdb';
        await mongoose.connect(MONGO_URI);
        console.log('🚀 Product Service MongoDB connected');

        // 2. RabbitMQ Bağlantısı
        await connectRabbit();

        // --- EVENT CONSUMERS (Olay Dinleyicileri) ---

        // KANAL B: Sipariş Geldiğinde Stok Düşürme
        await consumeEvent('order_events', async (message) => {
            if (message.type === 'ORDER_CREATED') {
                console.log(`[STOK] Sipariş alındı: ${message.data.orderId}. Güncelleniyor...`);
                try {
                    for (const item of message.data.items) {
                        // Atomik işlem: $inc ile stok azaltma
                        await Product.findByIdAndUpdate(item.productId, {
                            $inc: { stock: -item.quantity }
                        });
                    }
                    console.log('[STOK] Tüm ürünlerin stokları başarıyla düşürüldü.');
                } catch (err) {
                    console.error('[STOK HATA] Stok güncellenirken hata:', err.message);
                }
            }
        });

        // AUTH Servisinden Gelen Olaylar
        consumeEvent('USER_CREATED', (data) => {
            console.log('[EVENT] Yeni kullanıcı kaydoldu:', data.username);
        });

        consumeEvent('USER_DELETED', async (data) => {
            console.log('[EVENT] Kullanıcı silindi:', data.userId);
            // İleride burada kullanıcıya ait ürünleri pasife çekme mantığı eklenebilir
        });

        // 3. Routes & Server Start
        const productRoutes = require('./routes/product');
        app.use('/api/products', productRoutes);

        // Health Check
        app.get('/health', (req, res) => {
            res.json({ status: 'ok', service: 'product-service', timestamp: new Date() });
        });

        const PORT = process.env.PORT || 3002;
        app.listen(PORT, () => {
            console.log(`✅ Product Service running on port ${PORT}`);
        });

    } catch (error) {
        console.error('❌ Servis başlatılamadı:', error.message);
        process.exit(1); // Kritik hata durumunda servisi durdur
    }
}

// Global Hata Yönetimi
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

startServer();