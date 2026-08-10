import express from "express";
import cors from "cors";
import { errorResponse } from "@ecoalert/shared";
import assistantRoutes from "./routes/assistant.routes";
import { AssistantHttpError } from "./assistant/types";

import { analyzeIncidentWithOpenRouter, translateTextWithOpenRouter } from "./services/openrouter.service";
import { validateIncidentImage } from './services/image-validation.service';

const app = express();

app.use(cors());
app.use(express.json({ limit: "32kb" }));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "ai-service" });
});


// Route phân tích sự cố
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
    res.status(503).json({ success: false, message: 'AI analysis is temporarily unavailable' });
  }
});

app.post('/validate-image', async (req, res) => {
  const imageUrl = req.body?.imageUrl;
  if (!imageUrl || typeof imageUrl !== 'string') {
    return res.status(400).json({ success: false, message: 'imageUrl is required' });
  }
  const result = await validateIncidentImage(imageUrl);
  return res.status(200).json({ success: true, data: result });
});

// Route dịch thuật AI (Vietnamese <-> English)
app.post('/translate', async (req, res) => {
  try {
    const { text, targetLang = 'en' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, message: 'Text is required for translation' });
    }
    const translatedText = await translateTextWithOpenRouter(text, targetLang);
    res.status(200).json({ success: true, data: { text: translatedText, targetLang } });
  } catch {
    res.status(503).json({ success: false, message: 'AI translation service is temporarily unavailable' });
  }
});

// 2. Middleware xử lý lỗi phải nằm ở CUỐI CÙNG và được đóng ngoặc đầy đủ
// Assistant endpoints keep their stricter internal-gateway authorization.
// Operational AI endpoints above are authenticated by the API gateway.
app.use(['/', '/assistant'], assistantRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof AssistantHttpError) {
    return res.status(err.statusCode).json(errorResponse(err.message));
  }
  return res.status(500).json(errorResponse('Assistant service is temporarily unavailable'));
}); // <--- Đã bổ sung dấu }); còn thiếu

export { app };
