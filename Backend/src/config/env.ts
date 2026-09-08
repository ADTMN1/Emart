import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  
  database: {
    url: process.env.DATABASE_URL || '',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },

  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@emart.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123456',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },
};

export default config;
