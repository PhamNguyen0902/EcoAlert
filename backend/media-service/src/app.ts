import dotenv from 'dotenv';
dotenv.config(); // BẮT BUỘC Ở DÒNG ĐẦU TIÊN để nạp file .env trước khi import các route và service

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