import express from 'express';
import cors from 'cors';
import notificationRoutes from './routes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/', notificationRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'notification-service' });
});

export { app };
