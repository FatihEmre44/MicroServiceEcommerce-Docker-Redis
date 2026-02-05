# E-Commerce Microservices Backend

A complete e-commerce backend built with Node.js microservices architecture, Redis for caching and data storage, and Docker for containerization.

## 🏗️ Architecture

This project implements a microservices architecture with the following services:

- **API Gateway** (Port 3000) - Main entry point for all client requests
- **Product Service** (Port 3001) - Manages product catalog
- **Order Service** (Port 3002) - Handles orders and shopping cart
- **User Service** (Port 3003) - Manages user authentication and profiles
- **Redis** (Port 6379) - Caching and data storage

## 🚀 Features

### Product Service
- Create, read, update, and delete products
- Manage product inventory and stock
- Product categorization
- Redis-based storage for fast access

### Order Service
- Create and manage orders
- Automatic stock management
- Order status tracking (pending, processing, shipped, delivered, cancelled)
- Order history per user
- Integration with Product Service

### User Service
- User registration and authentication
- JWT-based authentication
- Password hashing with bcrypt
- Session management with Redis
- User profile management

### API Gateway
- Request routing to microservices
- Rate limiting for API protection
- Response caching with Redis
- Centralized error handling
- CORS support

## 📋 Prerequisites

- Docker (v20.10 or higher)
- Docker Compose (v2.0 or higher)
- Node.js 18+ (for local development)

## 🛠️ Installation & Setup

### Using Docker (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/FatihEmre44/MicroServiceEcommerce-Docker-Redis.git
cd MicroServiceEcommerce-Docker-Redis
```

2. Start all services with Docker Compose:
```bash
docker-compose up --build
```

3. The services will be available at:
   - API Gateway: http://localhost:3000
   - Product Service: http://localhost:3001
   - Order Service: http://localhost:3002
   - User Service: http://localhost:3003
   - Redis: localhost:6379

### Local Development

For each service, you can run locally:

1. Install dependencies:
```bash
cd api-gateway && npm install
cd ../product-service && npm install
cd ../order-service && npm install
cd ../user-service && npm install
```

2. Copy environment files:
```bash
cp api-gateway/.env.example api-gateway/.env
cp product-service/.env.example product-service/.env
cp order-service/.env.example order-service/.env
cp user-service/.env.example user-service/.env
```

3. Make sure Redis is running locally or update the REDIS_URL in .env files

4. Start each service in separate terminals:
```bash
cd api-gateway && npm start
cd product-service && npm start
cd order-service && npm start
cd user-service && npm start
```

## 📡 API Endpoints

### User Endpoints (via API Gateway)

**Register a new user:**
```bash
POST /api/users/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Login:**
```bash
POST /api/users/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Get user profile:**
```bash
GET /api/users/:id
```

### Product Endpoints (via API Gateway)

**Get all products:**
```bash
GET /api/products
```

**Get product by ID:**
```bash
GET /api/products/:id
```

**Create a product:**
```bash
POST /api/products
Content-Type: application/json

{
  "name": "Laptop",
  "description": "High-performance laptop",
  "price": 999.99,
  "category": "Electronics",
  "stock": 10
}
```

### Order Endpoints (via API Gateway)

**Create an order:**
```bash
POST /api/orders
Content-Type: application/json
user-id: <user-id-here>

{
  "items": [
    {
      "productId": "product-uuid",
      "quantity": 2
    }
  ]
}
```

**Get user orders:**
```bash
GET /api/orders
user-id: <user-id-here>
```

## 🧪 Testing the System

### Using cURL

**1. Register a user:**
```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

**2. Get all products:**
```bash
curl http://localhost:3000/api/products
```

**3. Create an order:**
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "user-id: <user-id-from-registration>" \
  -d '{
    "items": [
      {
        "productId": "<product-id-from-products-list>",
        "quantity": 1
      }
    ]
  }'
```

### Health Checks

Each service has a health check endpoint:

```bash
curl http://localhost:3000/health  # API Gateway
curl http://localhost:3001/health  # Product Service
curl http://localhost:3002/health  # Order Service
curl http://localhost:3003/health  # User Service
```

## 🔧 Configuration

Each service can be configured using environment variables. See `.env.example` files in each service directory.

### Key Environment Variables:

- `PORT` - Service port number
- `REDIS_URL` - Redis connection URL
- `JWT_SECRET` - Secret key for JWT tokens (User Service)
- `*_SERVICE_URL` - URLs for service-to-service communication

## 🐳 Docker Commands

**Start all services:**
```bash
docker-compose up
```

**Start in detached mode:**
```bash
docker-compose up -d
```

**Rebuild and start:**
```bash
docker-compose up --build
```

**Stop all services:**
```bash
docker-compose down
```

**View logs:**
```bash
docker-compose logs -f
```

**View logs for specific service:**
```bash
docker-compose logs -f api-gateway
```

## 🔍 Monitoring Redis

**Access Redis CLI:**
```bash
docker exec -it ecommerce-redis redis-cli
```

**Common Redis commands:**
```bash
KEYS *              # List all keys
GET key             # Get value of key
SMEMBERS set        # Get all members of a set
```

## 📂 Project Structure

```
.
├── api-gateway/          # API Gateway service
│   ├── server.js
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── product-service/      # Product microservice
│   ├── server.js
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── order-service/        # Order microservice
│   ├── server.js
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── user-service/         # User/Auth microservice
│   ├── server.js
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── docker-compose.yml    # Docker Compose configuration
├── .gitignore
└── README.md
```

## 🛡️ Security Features

- Password hashing with bcrypt
- JWT-based authentication
- Session management with Redis
- Rate limiting on API Gateway
- Environment-based configuration

## 🚧 Future Enhancements

- [ ] Add database (MongoDB/PostgreSQL) for persistent storage
- [ ] Implement message queue (RabbitMQ/Kafka) for async communication
- [ ] Add API documentation with Swagger
- [ ] Implement logging and monitoring (ELK Stack)
- [ ] Add unit and integration tests
- [ ] Implement CI/CD pipeline
- [ ] Add payment gateway integration
- [ ] Implement email notifications
- [ ] Add WebSocket support for real-time updates

## 📝 License

ISC

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.