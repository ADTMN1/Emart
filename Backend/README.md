# EMART Backend API

Node.js + Express + TypeScript + PostgreSQL + Prisma backend for EMART Global Proxy Shopping platform.

## 🚀 Features

- **Clean Architecture**: Organized with controllers, services, routes, middleware, and utilities
- **Type Safety**: Full TypeScript implementation
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **Validation**: Request validation using express-validator
- **Error Handling**: Centralized error handling middleware
- **API Documentation**: RESTful API with comprehensive endpoints
- **Database Seeding**: Sample data matching frontend mockData

## 📁 Project Structure

```
Backend/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Database seed script
├── src/
│   ├── config/
│   │   ├── database.ts        # Prisma client configuration
│   │   └── env.ts             # Environment configuration
│   ├── controllers/           # Request handlers
│   │   ├── auth.controller.ts
│   │   ├── cart.controller.ts
│   │   ├── category.controller.ts
│   │   ├── order.controller.ts
│   │   └── product.controller.ts
│   ├── middleware/            # Express middleware
│   │   ├── auth.ts            # Authentication & authorization
│   │   ├── errorHandler.ts   # Error handling
│   │   ├── validator.ts       # Validation middleware
│   │   └── validations/       # Validation rules
│   ├── routes/                # API routes
│   │   ├── auth.routes.ts
│   │   ├── cart.routes.ts
│   │   ├── category.routes.ts
│   │   ├── order.routes.ts
│   │   ├── product.routes.ts
│   │   └── index.ts           # Route aggregator
│   ├── services/              # Business logic
│   │   ├── auth.service.ts
│   │   ├── cart.service.ts
│   │   ├── category.service.ts
│   │   ├── order.service.ts
│   │   └── product.service.ts
│   ├── types/                 # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/                 # Utility functions
│   │   ├── errors.ts          # Custom error classes
│   │   ├── jwt.ts             # JWT utilities
│   │   └── response.ts        # API response helpers
│   └── server.ts              # Express server setup
├── .env.example               # Environment variables template
├── .gitignore
├── package.json
└── tsconfig.json
```

## 🛠️ Installation

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn

### Step 1: Install Dependencies

```bash
cd Backend
npm install
```

### Step 2: Database Setup

1. Create a PostgreSQL database:

```sql
CREATE DATABASE emart;
```

2. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

3. Update `.env` with your configuration:

```env
NODE_ENV=development
PORT=5000
API_VERSION=v1

# Update with your PostgreSQL credentials
DATABASE_URL="postgresql://username:password@localhost:5432/emart?schema=public"

# Generate a secure JWT secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Frontend URL for CORS
CORS_ORIGIN=http://localhost:5173

# Admin credentials (for seeding)
ADMIN_EMAIL=admin@emart.com
ADMIN_PASSWORD=Admin@123456
```

### Step 3: Generate Prisma Client

```bash
npm run prisma:generate
```

### Step 4: Run Database Migrations

```bash
npm run prisma:migrate
```

This will create all database tables based on the Prisma schema.

### Step 5: Seed Database

```bash
npm run db:seed
```

This will populate the database with:
- 1 admin user (credentials from .env)
- 8 categories (Electronics, Fashion, Watches, etc.)
- 8 sample products with realistic data

## 🏃 Running the Server

### Development Mode (with hot reload)

```bash
npm run dev
```

Server will start at `http://localhost:5000`

### Production Build

```bash
npm run build
npm start
```

## 📡 API Endpoints

Base URL: `http://localhost:5000/api/v1`

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| GET | `/auth/profile` | Get user profile | Yes |
| PUT | `/auth/profile` | Update user profile | Yes |

**Register/Login Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "CUSTOMER"
    },
    "token": "jwt-token"
  }
}
```

### Products

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/products` | Get all products (with filters) | No |
| GET | `/products/featured` | Get featured products | No |
| GET | `/products/:id` | Get product by ID | No |
| GET | `/products/:id/related` | Get related products | No |
| POST | `/products` | Create product | Yes (Admin) |
| PUT | `/products/:id` | Update product | Yes (Admin) |
| DELETE | `/products/:id` | Delete product | Yes (Admin) |

**Query Parameters for `/products`:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `category` - Filter by category ID
- `source` - Filter by marketplace source
- `condition` - Filter by condition (NEW, LIKE_NEW, VERY_GOOD, GOOD, ACCEPTABLE)
- `minPrice` - Minimum price in USD
- `maxPrice` - Maximum price in USD
- `q` - Search query (name, description, tags)
- `tags` - Comma-separated tags

**Example:**
```
GET /products?category=electronics&minPrice=100&maxPrice=500&q=sony&page=1&limit=20
```

### Categories

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/categories` | Get all categories | No |
| GET | `/categories/:id` | Get category by ID | No |
| POST | `/categories` | Create category | Yes (Admin) |
| PUT | `/categories/:id` | Update category | Yes (Admin) |
| DELETE | `/categories/:id` | Delete category | Yes (Admin) |

### Cart

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/cart` | Get user's cart | Yes |
| POST | `/cart/items` | Add item to cart | Yes |
| PUT | `/cart/items/:itemId` | Update cart item quantity | Yes |
| DELETE | `/cart/items/:itemId` | Remove item from cart | Yes |
| DELETE | `/cart` | Clear entire cart | Yes |

**Add to Cart Request:**
```json
{
  "productId": "product-uuid",
  "quantity": 2
}
```

### Orders

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/orders` | Create new order | Yes |
| GET | `/orders` | Get user's orders | Yes |
| GET | `/orders/:id` | Get order by ID | Yes |
| POST | `/orders/:id/cancel` | Cancel order | Yes |
| PUT | `/orders/:id/status` | Update order status | Yes (Admin) |

**Create Order Request:**
```json
{
  "items": [
    {
      "productId": "product-uuid",
      "quantity": 2
    }
  ],
  "shippingMethod": "dhl",
  "billingAddressId": "address-uuid",
  "shippingAddressId": "address-uuid",
  "notes": "Optional delivery notes"
}
```

**Query Parameters for `/orders`:**
- `page` - Page number
- `limit` - Items per page
- `status` - Filter by status (PENDING, PAYMENT_RECEIVED, etc.)
- `startDate` - Filter orders from date
- `endDate` - Filter orders to date

### Health Check

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Server health check | No |

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication.

### How to Authenticate:

1. **Register or Login** to get a token
2. **Include the token** in the `Authorization` header for protected routes:

```
Authorization: Bearer your-jwt-token-here
```

### Example with curl:

```bash
# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@emart.com", "password": "Admin@123456"}'

# Use token for protected endpoint
curl http://localhost:5000/api/v1/cart \
  -H "Authorization: Bearer your-jwt-token-here"
```

## 🗄️ Database Schema

### Main Models:

- **User**: Customer and admin accounts
- **Address**: Billing and shipping addresses
- **Category**: Product categories
- **Product**: Product listings
- **Cart**: Shopping cart
- **CartItem**: Items in cart
- **Order**: Order records
- **OrderItem**: Items in orders
- **WarehousePackage**: Package storage tracking
- **Shipment**: Shipment tracking

See `prisma/schema.prisma` for complete schema definition.

## 🛠️ Database Management

### View Database in Browser

```bash
npm run prisma:studio
```

Opens Prisma Studio at `http://localhost:5555`

### Create New Migration

```bash
npm run prisma:migrate
```

### Reset Database (⚠️ Deletes all data)

```bash
npm run prisma:reset
```

## 🔄 Connecting Frontend

Update the frontend API base URL to point to the backend:

```typescript
// Frontend config
const API_BASE_URL = 'http://localhost:5000/api/v1';
```

## 📦 Response Format

### Success Response

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message here"
}
```

### Paginated Response

```json
{
  "success": true,
  "data": {
    "products": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

## 🎯 Testing the API

### Using Default Admin Account

After seeding, you can login with:
- **Email**: `admin@emart.com`
- **Password**: `Admin@123456`

### Quick Test Flow

1. **Login as admin**:
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@emart.com","password":"Admin@123456"}'
```

2. **Get products**:
```bash
curl http://localhost:5000/api/v1/products
```

3. **Register new user**:
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456","firstName":"Test","lastName":"User"}'
```

## 🚧 What's NOT Implemented Yet

- Real payment processing (Stripe, PayPal integration)
- Mercari/marketplace API scraping
- AI shopping assistant integration
- Email notifications
- File upload for product images
- Advanced warehouse management
- Real-time shipment tracking APIs

## 🔧 Troubleshooting

### Database Connection Issues

1. Verify PostgreSQL is running:
```bash
sudo systemctl status postgresql
```

2. Check DATABASE_URL in `.env`
3. Ensure database exists

### Prisma Errors

If you get Prisma errors, regenerate the client:
```bash
npm run prisma:generate
```

### Port Already in Use

Change `PORT` in `.env` file to use a different port.

## 📝 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| NODE_ENV | Environment mode | development |
| PORT | Server port | 5000 |
| API_VERSION | API version | v1 |
| DATABASE_URL | PostgreSQL connection string | postgresql://... |
| JWT_SECRET | Secret key for JWT | random-secret-key |
| JWT_EXPIRES_IN | Token expiration time | 7d |
| CORS_ORIGIN | Allowed frontend origin | http://localhost:5173 |
| ADMIN_EMAIL | Default admin email | admin@emart.com |
| ADMIN_PASSWORD | Default admin password | Admin@123456 |

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Ensure TypeScript compiles: `npm run build`
4. Test the changes
5. Submit pull request

## 📄 License

MIT