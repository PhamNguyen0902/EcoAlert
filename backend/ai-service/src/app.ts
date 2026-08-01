import express from "express";
import cors from "cors";
import { errorResponse } from "@ecoalert/shared";
import assistantRoutes from "./routes/assistant.routes";
import { AssistantHttpError } from "./assistant/types";

import { analyzeIncidentWithOpenRouter } from "./services/openrouter.service";

const app = express();

app.use(cors());
app.use(express.json({ limit: "32kb" }));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "ai-service" });
});

app.use(['/', '/assistant'], assistantRoutes);

// 1. Đưa route /analyze lên TRƯỚC bộ xử lý lỗi
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

// 2. Middleware xử lý lỗi phải nằm ở CUỐI CÙNG và được đóng ngoặc đầy đủ
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof AssistantHttpError) {
    return res.status(err.statusCode).json(errorResponse(err.message));
  }
  return res.status(500).json(errorResponse('Assistant service is temporarily unavailable'));
}); // <--- Đã bổ sung dấu }); còn thiếu

export { app };
