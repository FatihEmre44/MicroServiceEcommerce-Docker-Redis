const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
    {
        // Siparişi veren kullanıcının ID'si (Auth servisinden gelir)
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        items: [
            {
                productId: {
                    type: mongoose.Schema.Types.ObjectId,
                    required: true,
                    ref: 'ProductRef' // Kendi içindeki referans tabloyu kullanıyor
                },
                name: {
                    type: String,
                    required: true
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 1
                },
                // Sipariş anındaki fiyat (İleride ürün fiyatı değişse de fatura değişmemeli)
                price: {
                    type: Number,
                    required: true
                }
            }
        ],

        // Siparişin toplam tutarı
        totalAmount: {
            type: Number,
            required: true,
            default: 0
        },

        // Sipariş durumu
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'cancelled'],
            default: 'pending'
        },

        // Teslimat adresi veya ek notlar eklenebilir
        shippingAddress: {
            type: String,
            required: false
        }
    },
    {
        timestamps: true // createdAt ve updatedAt otomatik oluşur
    }
);

// Sipariş kaydedilmeden önce toplam tutarı hesaplayan bir ara yazılım (optional)
orderSchema.pre('save', function (next) {
    this.totalAmount = this.items.reduce((total, item) => {
        return total + (item.price * item.quantity);
    }, 0);
    next();
});

module.exports = mongoose.model('Order', orderSchema);