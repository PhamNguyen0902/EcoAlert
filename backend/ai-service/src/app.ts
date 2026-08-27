import express from 'express';
import cors from 'cors';
import { errorResponse } from '@ecoalert/shared';
import { analyzeIncidentWithOpenRouter } from './services/openrouter.service';
import { validateIncidentImage } from './services/image-validation.service';

const app = express();
app.use(cors());
app.use(express.json({ limit: '32kb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'ai-service' });
});

/** Direct OpenRouter analysis endpoint used by the gateway. */
app.post('/analyze', async (req, res) => {
  try {
    const { title, description, imageUrl } = req.body;
    const result = await analyzeIncidentWithOpenRouter({
      title,
      description: description || '',
      imageUrl,
    });
    res.status(200).json({ success: true, data: result });
  } catch {
    res.status(503).json({ success: false, message: 'Dịch vụ phân tích AI tạm thời không khả dụng.' });
  }
});

app.post('/validate-image', async (req, res) => {
  const imageUrl = req.body?.imageUrl;
  if (!imageUrl || typeof imageUrl !== 'string') {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp imageUrl hợp lệ.' });
  }
  const result = await validateIncidentImage(imageUrl);
  return res.status(200).json({ success: true, data: result });
});

app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) =>
  res.status(500).json(errorResponse('Dịch vụ AI tạm thời không khả dụng.')),
);

export { app };
