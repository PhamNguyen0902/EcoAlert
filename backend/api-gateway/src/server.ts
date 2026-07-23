import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import { createLogger, HTTP_STATUS, errorResponse } from '@ecoalert/shared';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

dotenv.config();

const app = express();
const logger = createLogger('api-gateway');
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = new Redis(REDIS_URL);

redisClient.on('connect', () => logger.info('Gateway connected to Redis'));
redisClient.on('error', (err) => logger.error('Gateway Redis error:', err));

app.use(cors());
app.use(helmet());

// Logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Rate Limiting - Global (tăng lên cho môi trường dev)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Tăng từ 100 → 500 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse('Too many requests, please try again later.')
});
app.use(limiter);

// Rate Limiter riêng cho auth (login/register) - thoải mái hơn để dev/test
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 100 login attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse('Too many login attempts, please try again later.')
});
app.use('/api/v1/auth', authLimiter);

// Request ID Injection
app.use((req, res, next) => {
  const reqId = randomUUID();
  req.headers['x-request-id'] = reqId;
  res.setHeader('x-request-id', reqId);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'api-gateway' });
});

// Authentication Middleware for Gateway
const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  // Allow unauthenticated access to certain routes
  const publicRoutes = ['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/refresh-token'];
  const cleanPath = req.originalUrl.split('?')[0];
  if (publicRoutes.includes(cleanPath)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse('Authentication token required'));
  }

  const token = authHeader.split(' ')[1];
  logger.info(`Received token of length ${token?.length}: "${token?.substring(0, 30)}..."`);
  
  // Check blacklist
  try {
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse('Token is blacklisted'));
    }
  } catch (err) {
    logger.error('Redis blacklist check error', err);
    // Proceed if redis is down to not break everything, or fail fast. We fail open here.
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    // Attach to headers so downstream services can read it
    req.headers['x-user-id'] = decoded.userId;
    req.headers['x-user-role'] = decoded.role;
    req.headers['x-user-email'] = decoded.email;
    next();
  } catch (error) {
    logger.error('JWT Verification failed', error);
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse('Invalid or expired token'));
  }
};

// Apply auth middleware to all /api routes
app.use('/api', verifyToken);

// Proxy configuration
const setupProxy = (path: string, target: string, rewrite: boolean = false) => {
  app.use(
    path,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: rewrite ? { [`^${path}`]: '' } : undefined,
      onProxyReq: fixRequestBody,
      onError: (err, req, res) => {
        logger.error(`Proxy error for ${path}`, err);
        res.status(502).json(errorResponse('Bad Gateway'));
      }
    })
  );
};

// The proxy middleware automatically streams the request body. 
// However, if we parse it before proxying (e.g. express.json()), it breaks. 
// We use fixRequestBody to re-stream it if needed, but it's safer to only parse when needed.
// For Gateway, we don't parse JSON globally to avoid interfering with file uploads to media service.
// We only parse if absolutely necessary.

setupProxy('/api/v1/auth', process.env.USER_SERVICE_URL || 'http://localhost:3001');
setupProxy('/api/v1/users', process.env.USER_SERVICE_URL || 'http://localhost:3001');
setupProxy('/api/v1/alerts', process.env.ALERT_SERVICE_URL || 'http://localhost:3002', true);
setupProxy('/api/v1/media', process.env.MEDIA_SERVICE_URL || 'http://localhost:3003', true);
setupProxy('/api/v1/gis', process.env.GIS_SERVICE_URL || 'http://localhost:3004', true);
setupProxy('/api/v1/notifications', process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006', true);

// Note: AI service is event-driven, it doesn't expose public REST APIs to the frontend.

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Gateway Error:', err);
  res.status(500).json(errorResponse('API Gateway Internal Error'));
});

app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});
