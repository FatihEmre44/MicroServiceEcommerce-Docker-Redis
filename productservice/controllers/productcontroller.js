
const Product = require('../models/product');

// ...existing code...

// Create product (only seller or admin)
const createProduct = async (req, res) => {
	if (req.user.role !== 'seller' && req.user.role !== 'admin') {
		return res.status(403).json({ error: 'Only seller or admin can create' });
	}
	try {
		const product = new Product({ ...req.body, sellerId: req.user.userId });
		await product.save();
		res.status(201).json(product);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
};

// Update product (only owner or admin)
const updateProduct = async (req, res) => {
	try {
		const { id } = req.params;
		const product = await Product.findById(id);
		if (!product) return res.status(404).json({ error: 'Product not found' });
		if (!product.sellerId.equals(req.user.userId) && req.user.role !== 'admin') {
			return res.status(403).json({ error: 'Unauthorized' });
		}
		Object.assign(product, req.body);
		await product.save();
		res.json(product);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
};

// Delete product (only owner or admin)
const deleteProduct = async (req, res) => {
	try {
		const { id } = req.params;
		const product = await Product.findById(id);
		if (!product) return res.status(404).json({ error: 'Product not found' });
		if (!product.sellerId.equals(req.user.userId) && req.user.role !== 'admin') {
			return res.status(403).json({ error: 'Unauthorized' });
		}
		await product.remove();
		res.json({ message: 'Product deleted' });
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
};

module.exports = {
	createProduct,
	updateProduct,
	deleteProduct
};
