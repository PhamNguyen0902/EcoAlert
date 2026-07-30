import express from 'express';
import cors from 'cors';

import { analyzeIncidentWithOpenRouter } from './services/openrouter.service';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'ai-service' });
});

app.post('/analyze', async (req, res) => {
  try {
    const { description, imageUrl } = req.body;
    const result = await analyzeIncidentWithOpenRouter(description || '', imageUrl);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'AI Analysis failed' });
  }
});

export { app };
