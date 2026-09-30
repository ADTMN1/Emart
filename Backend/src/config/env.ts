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
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/v1/auth/google/callback',
  },

  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@emart.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123456',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },

  // Base URL of the EMART web app, used to build clickable links in
  // transactional emails. Must be an absolute http(s) origin — email
  // templates append a fixed path to it.
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, ''),

  email: {
    apiKey: process.env.BREVO_API_KEY || '',
    from: process.env.EMAIL_FROM || '',
    fromName: (process.env.EMAIL_FROM_NAME || 'EMART').trim(),
  },

  /**
   * Local filesystem storage (replaces Supabase Storage).
   *
   * `root` is the absolute directory that holds every namespace
   * (products/, shop-media/, seller-documents/). `publicBaseUrl` is the origin
   * that publicly serves `<publicPathPrefix>` — normally the public origin of
   * this API (Nginx terminates TLS and proxies here). It is only used to build
   * public asset URLs and the identity-document download URL; when empty,
   * root-relative URLs are emitted for same-origin deployments.
   */
  storage: {
    root: (process.env.STORAGE_ROOT || '/var/lib/emart/storage').trim(),
    publicPathPrefix: (process.env.STORAGE_PUBLIC_PATH_PREFIX || '/uploads').trim(),
    publicBaseUrl: (process.env.STORAGE_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, ''),
    /** Lifetime of a minted identity-document download token, in seconds. */
    documentUrlTtlSeconds: parseInt(process.env.STORAGE_DOCUMENT_URL_TTL || '300', 10),
  },

  cj: {
    apiKey: process.env.CJ_API_KEY || '',
    accessToken: process.env.CJ_ACCESS_TOKEN || '',
    refreshToken: process.env.CJ_REFRESH_TOKEN || '',
    baseUrl: 'https://developers.cjdropshipping.com/api2.0/v1',
  },
};

export default config;
