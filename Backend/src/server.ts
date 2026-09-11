import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import config from './config/env';
import routes from './routes';
import prisma from './config/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

// Health check (before other middleware to skip logging/compression)
app.get('/health', async (_req, res) => {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1 as ok`;
    const dbLatency = Date.now() - start;
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      dbLatencyMs: dbLatency,
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      db: 'unavailable',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

// Middleware
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.path === '/health') return false;
    return compression.filter(req, res);
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Disable caching for API responses to prevent stale product/image data
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Guard against stalled requests and slow upstream dependencies.
app.use((req, res, next) => {
  req.socket.setTimeout(15000);
  res.setTimeout(15000);
  next();
});

// Routes
app.use(`/api/${config.apiVersion}`, routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.port;

async function startServer() {
  try {
    const connectStart = Date.now();
    await prisma.$connect();
    const connectLatency = Date.now() - connectStart;
    console.log(`[DB] Connected to Supabase PostgreSQL (${connectLatency}ms)`);
  } catch (err: any) {
    console.error('[DB] FATAL: Failed to establish database connection on startup');
    console.error(`[DB] Error: ${err.message?.substring(0, 200)}`);
    if (config.env !== 'production') {
      console.warn('[DB] Continuing in dev mode — requests may fail until DB is reachable');
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║                                        ║
║   🚀 EMART Backend Server Started     ║
║                                        ║
║   Environment: ${config.env.padEnd(24)}║
║   Port: ${PORT.toString().padEnd(31)}║
║   API Version: ${config.apiVersion.padEnd(24)}║
║   CORS Origin: ${config.cors.origin.padEnd(24)}║
║                                        ║
║   API Base: http://localhost:${PORT}/api/${config.apiVersion}  ║
║   Health:   http://localhost:${PORT}/health          ║
║                                        ║
╚════════════════════════════════════════╝
  `);
  });

  server.requestTimeout = 15000;
  server.headersTimeout = 16000;
  server.keepAliveTimeout = 5000;
  server.setTimeout(15000);
}

startServer();

export default app;
