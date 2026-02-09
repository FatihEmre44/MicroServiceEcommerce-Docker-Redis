const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		description: { type: String, default: '' },
		price: { type: Number, required: true, min: 0 },
		stock: { type: Number, required: true, min: 0, default: 0 },
		category: { type: String, required: true, trim: true },
		images: [{ type: String }],
		isActive: { type: Boolean, default: true },
		sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
	},
	{ timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
