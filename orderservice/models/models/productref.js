const mongoose = require('mongoose');

const productRefSchema = new mongoose.Schema({
    
    _id: { type: mongoose.Schema.Types.ObjectId, required: true }, 
    price: { type: Number, required: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('ProductRef', productRefSchema);