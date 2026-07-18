import express from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/error-handler.middleware';
import uploadRoutes from './routes/upload.routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'media-service' });
});

app.use('/', uploadRoutes);
app.use(errorHandler);

export { app };
