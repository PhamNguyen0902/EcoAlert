import express from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/error-handler.middleware';
import routes from './routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'alert-service' });
});

// Since the gateway proxies /api/v1/alerts to /, we mount routes at /
app.use('/', routes);

app.use(errorHandler);

export { app };
