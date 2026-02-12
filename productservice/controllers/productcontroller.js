
const Product = require('../models/product');
const { publishEvent } = require('../message/producer');

// Get all products (public - no auth required)
const getAllProducts = async (req, res) => {
	try {
		const { category, minPrice, maxPrice, search, page = 1, limit = 10 } = req.query;

		// Build filter object
		const filter = { isActive: true };

		if (category) filter.category = category;
		if (minPrice || maxPrice) {
			filter.price = {};
			if (minPrice) filter.price.$gte = Number(minPrice);
			if (maxPrice) filter.price.$lte = Number(maxPrice);
		}
		if (search) {
			filter.$or = [
				{ name: { $regex: search, $options: 'i' } },
				{ description: { $regex: search, $options: 'i' } }
			];
		}

		// Pagination
		const skip = (Number(page) - 1) * Number(limit);

		const products = await Product.find(filter)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(Number(limit));

		const total = await Product.countDocuments(filter);

		res.json({
			products,
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

// Get single product by ID (public - no auth required)
const getProductById = async (req, res) => {
	try {
		const { id } = req.params;
		const product = await Product.findById(id);

		if (!product) {
			return res.status(404).json({ error: 'Product not found' });
		}

		res.json(product);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
};

// ...existing code...

// Create product (only seller or admin)
const createProduct = async (req, res) => {
	if (req.user.role !== 'seller' && req.user.role !== 'admin') {
		return res.status(403).json({ error: 'Only seller or admin can create' });
	}
	try {
		const product = new Product({ ...req.body, sellerId: req.user.userId });
		await product.save();

		publishEvent('product_updates_for_order', {
			type: 'PRODUCT_CREATED',
			data: {
				id: product._id,
				price: product.price,
				isActive: product.isActive
			}
		});

		// Search Service indeksleme olayı
		publishEvent('product_search_index', {
			type: 'PRODUCT_CREATED',
			data: {
				id: product._id,
				name: product.name,
				description: product.description,
				price: product.price,
				stock: product.stock,
				category: product.category,
				images: product.images,
				isActive: product.isActive,
				sellerId: product.sellerId,
				createdAt: product.createdAt
			}
		});
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
		publishEvent('product_updates_for_order', {
			type: 'PRODUCT_UPDATED',
			data: {
				id: product._id,
				price: product.price,
				isActive: product.isActive
			}
		});

		// Search Service indeksleme olayı
		publishEvent('product_search_index', {
			type: 'PRODUCT_UPDATED',
			data: {
				id: product._id,
				name: product.name,
				description: product.description,
				price: product.price,
				stock: product.stock,
				category: product.category,
				images: product.images,
				isActive: product.isActive,
				sellerId: product.sellerId,
				createdAt: product.createdAt
			}
		});
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
		publishEvent('product_updates_for_order', {
			type: 'PRODUCT_DELETED',
			data: {
				id: product._id,
				isActive: false
			}
		});

		// Search Service indeksten silme olayı
		publishEvent('product_search_index', {
			type: 'PRODUCT_DELETED',
			data: { id: product._id }
		});
		res.json({ message: 'Product deleted' });
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
};

module.exports = {
	getAllProducts,
	getProductById,
	createProduct,
	updateProduct,
	deleteProduct
};
