import express from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/error-handler.middleware';
import routes from './routes';

const app = express();

app.use(cors());
app.use(express.json({limit:'2mb'}));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'gis-service' });
});

app.use('/', routes);
app.use(errorHandler);

export { app };
