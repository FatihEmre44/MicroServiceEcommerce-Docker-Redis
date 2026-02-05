const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Redis client setup
let redisClient;
(async () => {
  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  
  redisClient.on('error', (err) => console.log('Redis Client Error', err));
  redisClient.on('connect', () => console.log('Product Service: Redis Connected'));
  
  await redisClient.connect();
  
  // Initialize with sample products
  await initializeSampleProducts();
})();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize sample products
async function initializeSampleProducts() {
  const sampleProducts = [
    {
      id: uuidv4(),
      name: 'Laptop',
      description: 'High-performance laptop',
      price: 999.99,
      category: 'Electronics',
      stock: 10
    },
    {
      id: uuidv4(),
      name: 'Smartphone',
      description: 'Latest smartphone model',
      price: 699.99,
      category: 'Electronics',
      stock: 25
    },
    {
      id: uuidv4(),
      name: 'Headphones',
      description: 'Noise-cancelling headphones',
      price: 199.99,
      category: 'Electronics',
      stock: 50
    }
  ];

  for (const product of sampleProducts) {
    const exists = await redisClient.exists(`product:${product.id}`);
    if (!exists) {
      await redisClient.set(`product:${product.id}`, JSON.stringify(product));
      await redisClient.sAdd('products:all', product.id);
    }
  }
  
  console.log('Sample products initialized');
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'product-service' });
});

// Get all products
app.get('/products', async (req, res) => {
  try {
    const productIds = await redisClient.sMembers('products:all');
    const products = [];
    
    for (const id of productIds) {
      const product = await redisClient.get(`product:${id}`);
      if (product) {
        products.push(JSON.parse(product));
      }
    }
    
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

// Get product by ID
app.get('/products/:id', async (req, res) => {
  try {
    const product = await redisClient.get(`product:${req.params.id}`);
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    res.json({ success: true, data: JSON.parse(product) });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
});

// Create new product
app.post('/products', async (req, res) => {
  try {
    const { name, description, price, category, stock } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and price are required' 
      });
    }
    
    const product = {
      id: uuidv4(),
      name,
      description: description || '',
      price: parseFloat(price),
      category: category || 'General',
      stock: stock || 0,
      createdAt: new Date().toISOString()
    };
    
    await redisClient.set(`product:${product.id}`, JSON.stringify(product));
    await redisClient.sAdd('products:all', product.id);
    
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, error: 'Failed to create product' });
  }
});

// Update product
app.put('/products/:id', async (req, res) => {
  try {
    const productData = await redisClient.get(`product:${req.params.id}`);
    
    if (!productData) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    const product = JSON.parse(productData);
    const { name, description, price, category, stock } = req.body;
    
    const updatedProduct = {
      ...product,
      name: name || product.name,
      description: description !== undefined ? description : product.description,
      price: price !== undefined ? parseFloat(price) : product.price,
      category: category || product.category,
      stock: stock !== undefined ? stock : product.stock,
      updatedAt: new Date().toISOString()
    };
    
    await redisClient.set(`product:${req.params.id}`, JSON.stringify(updatedProduct));
    
    res.json({ success: true, data: updatedProduct });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, error: 'Failed to update product' });
  }
});

// Delete product
app.delete('/products/:id', async (req, res) => {
  try {
    const exists = await redisClient.exists(`product:${req.params.id}`);
    
    if (!exists) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    await redisClient.del(`product:${req.params.id}`);
    await redisClient.sRem('products:all', req.params.id);
    
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, error: 'Failed to delete product' });
  }
});

// Update product stock
app.patch('/products/:id/stock', async (req, res) => {
  try {
    const productData = await redisClient.get(`product:${req.params.id}`);
    
    if (!productData) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    const product = JSON.parse(productData);
    const { quantity } = req.body;
    
    if (quantity === undefined) {
      return res.status(400).json({ success: false, error: 'Quantity is required' });
    }
    
    product.stock = Math.max(0, product.stock + quantity);
    product.updatedAt = new Date().toISOString();
    
    await redisClient.set(`product:${req.params.id}`, JSON.stringify(product));
    
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ success: false, error: 'Failed to update stock' });
  }
});

app.listen(PORT, () => {
  console.log(`Product Service running on port ${PORT}`);
});
