import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import config from './config/env';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

// Middleware
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Routes
app.use(`/api/${config.apiVersion}`, routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.port;

app.listen(PORT, () => {
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

export default app;
