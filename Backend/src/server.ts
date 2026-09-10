import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import config from './config/env';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

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
║                                        ║
╚════════════════════════════════════════╝
  `);
});

server.requestTimeout = 15000;
server.headersTimeout = 16000;
server.keepAliveTimeout = 5000;
server.setTimeout(15000);

export default app;
