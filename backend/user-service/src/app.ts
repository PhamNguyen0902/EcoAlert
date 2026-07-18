import express from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/error-handler.middleware';
import routes from './routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'user-service' });
});

app.use('/api/v1', routes);
app.use(errorHandler);

export { app };
