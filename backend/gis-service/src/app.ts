import express from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/error-handler.middleware';
import routes from './routes';
import { osrmRoutingService } from './services/osrm-routing.service';

const app = express();

app.use(cors());
app.use(express.json({limit:'2mb'}));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'gis-service' });
});

// Keep liveness independent of routing; readiness additionally checks the local graph.
app.get('/health/ready', async (_req, res) => {
  const ready = await osrmRoutingService.ready();
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'unavailable',
    service: 'gis-service',
    routing: ready ? 'ready' : 'unavailable',
  });
});

app.use('/', routes);
app.use(errorHandler);

export { app };
