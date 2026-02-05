const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { createClient } = require('redis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Redis client setup
let redisClient;
(async () => {
  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  
  redisClient.on('error', (err) => console.log('Redis Client Error', err));
  redisClient.on('connect', () => console.log('Redis Client Connected'));
  
  await redisClient.connect();
})();

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Service URLs
const SERVICES = {
  products: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001',
  orders: process.env.ORDER_SERVICE_URL || 'http://localhost:3002',
  users: process.env.USER_SERVICE_URL || 'http://localhost:3003'
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'api-gateway' });
});

// Cache middleware
const cacheMiddleware = (duration) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl}`;
    
    try {
      const cachedResponse = await redisClient.get(key);
      if (cachedResponse) {
        console.log('Cache hit for:', key);
        return res.json(JSON.parse(cachedResponse));
      }
    } catch (error) {
      console.error('Redis error:', error);
    }

    res.originalJson = res.json;
    res.json = async (body) => {
      try {
        await redisClient.setEx(key, duration, JSON.stringify(body));
        console.log('Cached:', key);
      } catch (error) {
        console.error('Redis cache error:', error);
      }
      res.originalJson(body);
    };

    next();
  };
};

// Product routes
app.get('/api/products', cacheMiddleware(300), async (req, res) => {
  try {
    const response = await axios.get(`${SERVICES.products}/products`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch products',
      message: error.message 
    });
  }
});

app.get('/api/products/:id', cacheMiddleware(300), async (req, res) => {
  try {
    const response = await axios.get(`${SERVICES.products}/products/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch product',
      message: error.message 
    });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const response = await axios.post(`${SERVICES.products}/products`, req.body);
    // Invalidate cache
    const keys = await redisClient.keys('cache:/api/products*');
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to create product',
      message: error.message 
    });
  }
});

// Order routes
app.get('/api/orders', async (req, res) => {
  try {
    const response = await axios.get(`${SERVICES.orders}/orders`, {
      headers: { 'user-id': req.headers['user-id'] }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch orders',
      message: error.message 
    });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const response = await axios.post(`${SERVICES.orders}/orders`, req.body, {
      headers: { 'user-id': req.headers['user-id'] }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to create order',
      message: error.message 
    });
  }
});

// User routes
app.post('/api/users/register', async (req, res) => {
  try {
    const response = await axios.post(`${SERVICES.users}/users/register`, req.body);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to register user',
      message: error.message 
    });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const response = await axios.post(`${SERVICES.users}/users/login`, req.body);
    
    // Cache user session
    if (response.data.token) {
      await redisClient.setEx(
        `session:${response.data.token}`,
        3600,
        JSON.stringify(response.data.user)
      );
    }
    
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to login',
      message: error.message 
    });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const response = await axios.get(`${SERVICES.users}/users/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch user',
      message: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`Product Service: ${SERVICES.products}`);
  console.log(`Order Service: ${SERVICES.orders}`);
  console.log(`User Service: ${SERVICES.users}`);
});
