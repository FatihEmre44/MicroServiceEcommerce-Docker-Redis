const ProductRef = require('../models/productref');
const { consumeEvent } = require('./rabbitmq_helper');

const syncProductData = async () => {
    console.log('📦 Order Service: Ürün güncellemeleri dinleniyor...');

    await consumeEvent('product_updates_for_order', async (message) => {
        const { type, data } = message;

        try {
            if (type === 'PRODUCT_CREATED' || type === 'PRODUCT_UPDATED') {
                // Kayıt varsa güncelle, yoksa yeni oluştur (Upsert)
                await ProductRef.findByIdAndUpdate(
                    data.id,
                    { price: data.price, isActive: data.isActive },
                    { upsert: true, new: true }
                );
                console.log(`[SYNC] Ürün fiyatı güncellendi: ${data.id}`);
            } else if (type === 'PRODUCT_DELETED') {
                // Silinen ürünü pasife çekiyoruz
                await ProductRef.findByIdAndUpdate(data.id, { isActive: false });
                console.log(`[SYNC] Ürün pasife çekildi: ${data.id}`);
            }
        } catch (err) {
            console.error('Senkronizasyon Hatası:', err.message);
        }
    });
};

module.exports = { syncProductData };