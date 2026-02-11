const Order = require('../models/order');
const ProductRef = require('../models/productref');
const { publishEvent } = require('../message/rabbitmq_helper');

// Yeni sipariş oluştur
const createOrder = async (req, res) => {
    try {
        const { items, shippingAddress } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Sipariş için en az bir ürün gerekli' });
        }

        // Her ürünün aktifliğini ve fiyatını ProductRef'ten doğrula
        const orderItems = [];
        for (const item of items) {
            const product = await ProductRef.findById(item.productId);

            if (!product) {
                return res.status(404).json({ error: `Ürün bulunamadı: ${item.productId}` });
            }
            if (!product.isActive) {
                return res.status(400).json({ error: `Ürün artık aktif değil: ${item.productId}` });
            }

            orderItems.push({
                productId: product._id,
                name: item.name || 'Ürün',
                quantity: item.quantity,
                price: product.price // Anlık fiyatı ProductRef'ten al
            });
        }

        // Siparişi oluştur
        const order = new Order({
            userId: req.user.userId,
            items: orderItems,
            shippingAddress
        });

        await order.save();

        // KANAL B: Stok düşürmesi için productservice'e mesaj gönder
        publishEvent('order_events', {
            type: 'ORDER_CREATED',
            data: {
                orderId: order._id,
                items: orderItems.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity
                }))
            }
        });

        console.log(`[SİPARİŞ] Yeni sipariş oluşturuldu: ${order._id}`);
        res.status(201).json(order);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Kullanıcının kendi siparişlerini listele
const getMyOrders = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const orders = await Order.find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const total = await Order.countDocuments({ userId: req.user.userId });

        res.json({
            orders,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Tek sipariş detayı
const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ error: 'Sipariş bulunamadı' });
        }

        // Sadece kendi siparişini görebilir (admin hariç)
        if (!order.userId.equals(req.user.userId) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Bu siparişi görüntüleme yetkiniz yok' });
        }

        res.json(order);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Sipariş iptal et
const cancelOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ error: 'Sipariş bulunamadı' });
        }

        // Sadece kendi siparişini iptal edebilir
        if (!order.userId.equals(req.user.userId) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Bu siparişi iptal etme yetkiniz yok' });
        }

        if (order.status === 'cancelled') {
            return res.status(400).json({ error: 'Sipariş zaten iptal edilmiş' });
        }

        if (order.status === 'completed') {
            return res.status(400).json({ error: 'Tamamlanmış sipariş iptal edilemez' });
        }

        order.status = 'cancelled';
        await order.save();

        // KANAL B: Stok geri yükleme için productservice'e mesaj gönder
        publishEvent('order_events', {
            type: 'ORDER_CANCELLED',
            data: {
                orderId: order._id,
                items: order.items.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity
                }))
            }
        });

        console.log(`[SİPARİŞ] Sipariş iptal edildi: ${order._id}`);
        res.json({ message: 'Sipariş başarıyla iptal edildi', order });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    createOrder,
    getMyOrders,
    getOrderById,
    cancelOrder
};
