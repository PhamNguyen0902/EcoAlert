import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import { createLogger, HTTP_STATUS, errorResponse } from '@ecoalert/shared';

dotenv.config();

const app = express();
const logger = createLogger('api-gateway');
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

app.use(cors());
app.use(helmet());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'api-gateway' });
});

// Authentication Middleware for Gateway
const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  // Allow unauthenticated access to certain routes
  const publicRoutes = ['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/refresh-token'];
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse('Authentication token required'));
  }

  const token = authHeader.split(' ')[1];
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
const setupProxy = (path: string, target: string) => {
  app.use(
    path,
    createProxyMiddleware({
      target,
      changeOrigin: true,
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
setupProxy('/api/v1/alerts', process.env.ALERT_SERVICE_URL || 'http://localhost:3002');
setupProxy('/api/v1/media', process.env.MEDIA_SERVICE_URL || 'http://localhost:3003');
setupProxy('/api/v1/gis', process.env.GIS_SERVICE_URL || 'http://localhost:3004');

// Note: AI and Notification services are event-driven, they don't expose public REST APIs to the frontend.

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Gateway Error:', err);
  res.status(500).json(errorResponse('API Gateway Internal Error'));
});

app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});
