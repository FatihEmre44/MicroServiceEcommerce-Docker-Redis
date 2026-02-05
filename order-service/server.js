const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001';

// Redis client setup
let redisClient;
(async () => {
  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  
  redisClient.on('error', (err) => console.log('Redis Client Error', err));
  redisClient.on('connect', () => console.log('Order Service: Redis Connected'));
  
  await redisClient.connect();
})();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'order-service' });
});

// Get all orders for a user
app.get('/orders', async (req, res) => {
  try {
    const userId = req.headers['user-id'];
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required in headers' 
      });
    }
    
    const orderIds = await redisClient.sMembers(`user:${userId}:orders`);
    const orders = [];
    
    for (const id of orderIds) {
      const order = await redisClient.get(`order:${id}`);
      if (order) {
        orders.push(JSON.parse(order));
      }
    }
    
    // Sort by date (newest first)
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// Get order by ID
app.get('/orders/:id', async (req, res) => {
  try {
    const order = await redisClient.get(`order:${req.params.id}`);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    res.json({ success: true, data: JSON.parse(order) });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

// Create new order
app.post('/orders', async (req, res) => {
  try {
    const userId = req.headers['user-id'];
    const { items } = req.body; // items: [{ productId, quantity }]
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required in headers' 
      });
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Order items are required' 
      });
    }
    
    // Validate and calculate order total
    let totalAmount = 0;
    const orderItems = [];
    
    for (const item of items) {
      try {
        // Get product details from product service
        const productResponse = await axios.get(
          `${PRODUCT_SERVICE_URL}/products/${item.productId}`
        );
        
        if (!productResponse.data.success) {
          return res.status(400).json({ 
            success: false, 
            error: `Product ${item.productId} not found` 
          });
        }
        
        const product = productResponse.data.data;
        
        // Check stock availability
        if (product.stock < item.quantity) {
          return res.status(400).json({ 
            success: false, 
            error: `Insufficient stock for product ${product.name}` 
          });
        }
        
        const itemTotal = product.price * item.quantity;
        totalAmount += itemTotal;
        
        orderItems.push({
          productId: product.id,
          productName: product.name,
          price: product.price,
          quantity: item.quantity,
          subtotal: itemTotal
        });
        
        // Update product stock
        await axios.patch(
          `${PRODUCT_SERVICE_URL}/products/${product.id}/stock`,
          { quantity: -item.quantity }
        );
        
      } catch (error) {
        console.error('Error processing product:', error);
        return res.status(400).json({ 
          success: false, 
          error: `Failed to process product ${item.productId}` 
        });
      }
    }
    
    const order = {
      id: uuidv4(),
      userId,
      items: orderItems,
      totalAmount,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    await redisClient.set(`order:${order.id}`, JSON.stringify(order));
    await redisClient.sAdd(`user:${userId}:orders`, order.id);
    await redisClient.sAdd('orders:all', order.id);
    
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, error: 'Failed to create order' });
  }
});

// Update order status
app.patch('/orders/:id/status', async (req, res) => {
  try {
    const orderData = await redisClient.get(`order:${req.params.id}`);
    
    if (!orderData) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    const order = JSON.parse(orderData);
    const { status } = req.body;
    
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid status. Valid values: ${validStatuses.join(', ')}` 
      });
    }
    
    order.status = status;
    order.updatedAt = new Date().toISOString();
    
    await redisClient.set(`order:${req.params.id}`, JSON.stringify(order));
    
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

// Cancel order
app.delete('/orders/:id', async (req, res) => {
  try {
    const orderData = await redisClient.get(`order:${req.params.id}`);
    
    if (!orderData) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    const order = JSON.parse(orderData);
    
    // Only allow cancellation of pending orders
    if (order.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        error: 'Only pending orders can be cancelled' 
      });
    }
    
    // Restore product stock
    for (const item of order.items) {
      try {
        await axios.patch(
          `${PRODUCT_SERVICE_URL}/products/${item.productId}/stock`,
          { quantity: item.quantity }
        );
      } catch (error) {
        console.error('Error restoring stock:', error);
      }
    }
    
    order.status = 'cancelled';
    order.updatedAt = new Date().toISOString();
    
    await redisClient.set(`order:${req.params.id}`, JSON.stringify(order));
    
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel order' });
  }
});

app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
  console.log(`Product Service URL: ${PRODUCT_SERVICE_URL}`);
});
