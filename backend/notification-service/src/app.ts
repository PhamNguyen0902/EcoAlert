import express from 'express';
import cors from 'cors';
import notificationRoutes from './routes';
import { AppError, errorResponse } from '@ecoalert/shared';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'notification-service' });
});
app.use('/', notificationRoutes);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = error instanceof AppError ? error.statusCode : 500;
  res.status(status).json(errorResponse(status === 403 ? 'Bạn không có quyền truy cập thông báo.' : status === 401 ? 'Vui lòng đăng nhập để xem thông báo.' : 'Chưa cập nhật được thông báo.'));
});

export { app };
