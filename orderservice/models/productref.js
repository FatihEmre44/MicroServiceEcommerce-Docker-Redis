const mongoose = require('mongoose');

const productRefSchema = new mongoose.Schema({
    // ID'yi productservice'deki orijinal ID ile aynı tutuyoruz
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    price: { type: Number, required: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('ProductRef', productRefSchema);