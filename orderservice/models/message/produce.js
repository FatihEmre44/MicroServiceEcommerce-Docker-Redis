const ProductRef = require('../models/productRef');
// RabbitMQ consumeEvent fonksiyonunu içe aktar
const { consumeEvent } = require('./rabbitmq_helper'); 

const syncProductData = async () => {
    // product_updates_for_order kuyruğunu dinle
    await consumeEvent('product_updates_for_order', async (message) => {
        const { type, data } = message;

        try {
            if (type === 'PRODUCT_CREATED' || type === 'PRODUCT_UPDATED') {
                // Upsert: Kayıt varsa güncelle, yoksa oluştur
                await ProductRef.findByIdAndUpdate(
                    data.id, 
                    { price: data.price, isActive: data.isActive }, 
                    { upsert: true, new: true }
                );
                console.log(`[SYNC] Ürün güncellendi: ${data.id}`);
            } else if (type === 'PRODUCT_DELETED') {
                // Fiziksel silme yerine isActive: false yapmak daha güvenlidir
                await ProductRef.findByIdAndUpdate(data.id, { isActive: false });
                console.log(`[SYNC] Ürün silindi (pasife çekildi): ${data.id}`);
            }
        } catch (err) {
            console.error('Senkronizasyon hatası:', err.message);
        }
    });
};

module.exports = { syncProductData };