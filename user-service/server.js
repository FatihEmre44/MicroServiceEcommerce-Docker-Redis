const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Redis client setup
let redisClient;
(async () => {
  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  
  redisClient.on('error', (err) => console.log('Redis Client Error', err));
  redisClient.on('connect', () => console.log('User Service: Redis Connected'));
  
  await redisClient.connect();
})();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'user-service' });
});

// Register new user
app.post('/users/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, password, and name are required' 
      });
    }
    
    // Check if user already exists
    const existingUser = await redisClient.get(`user:email:${email}`);
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'User with this email already exists' 
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = {
      id: uuidv4(),
      email,
      name,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };
    
    // Store user
    await redisClient.set(`user:${user.id}`, JSON.stringify(user));
    await redisClient.set(`user:email:${email}`, user.id);
    await redisClient.sAdd('users:all', user.id);
    
    // Remove password from response
    const userResponse = { ...user };
    delete userResponse.password;
    
    res.status(201).json({ success: true, data: userResponse });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ success: false, error: 'Failed to register user' });
  }
});

// Login user
app.post('/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }
    
    // Get user ID from email
    const userId = await redisClient.get(`user:email:${email}`);
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }
    
    // Get user data
    const userData = await redisClient.get(`user:${userId}`);
    if (!userData) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }
    
    const user = JSON.parse(userData);
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Store session in Redis
    await redisClient.setEx(
      `session:${token}`,
      86400, // 24 hours
      JSON.stringify({ userId: user.id, email: user.email })
    );
    
    // Remove password from response
    const userResponse = { ...user };
    delete userResponse.password;
    
    res.json({ 
      success: true, 
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ success: false, error: 'Failed to login' });
  }
});

// Get user by ID
app.get('/users/:id', async (req, res) => {
  try {
    const userData = await redisClient.get(`user:${req.params.id}`);
    
    if (!userData) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const user = JSON.parse(userData);
    
    // Remove password from response
    delete user.password;
    
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

// Update user
app.put('/users/:id', async (req, res) => {
  try {
    const userData = await redisClient.get(`user:${req.params.id}`);
    
    if (!userData) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const user = JSON.parse(userData);
    const { name, email } = req.body;
    
    // If email is being changed, check if new email is available
    if (email && email !== user.email) {
      const existingUser = await redisClient.get(`user:email:${email}`);
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email already in use' 
        });
      }
      
      // Update email index
      await redisClient.del(`user:email:${user.email}`);
      await redisClient.set(`user:email:${email}`, user.id);
      user.email = email;
    }
    
    if (name) user.name = name;
    user.updatedAt = new Date().toISOString();
    
    await redisClient.set(`user:${req.params.id}`, JSON.stringify(user));
    
    // Remove password from response
    const userResponse = { ...user };
    delete userResponse.password;
    
    res.json({ success: true, data: userResponse });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// Logout user
app.post('/users/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token is required' 
      });
    }
    
    // Delete session
    await redisClient.del(`session:${token}`);
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ success: false, error: 'Failed to logout' });
  }
});

// Verify token (for other services)
app.post('/users/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token is required' 
      });
    }
    
    // Check session in Redis
    const session = await redisClient.get(`session:${token}`);
    if (!session) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }
    
    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    
    res.json({ success: true, data: decoded });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
});

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});
