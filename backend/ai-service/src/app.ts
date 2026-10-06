import express from "express";
import cors from "cors";
import { createLogger, errorResponse } from "@ecoalert/shared";
import { z } from "zod";
import {
  analyzeIncidentWithOpenRouter,
  safeOpenRouterErrorMetadata,
} from "./services/openrouter.service";
import { officerRagService } from "./services/officer-rag.service";
const logger = createLogger("ai-service");

const app = express();
app.use(cors());
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "ai-service" });
});

const visionDetectionClassSchema = z
  .object({
    materialClass: z.string().trim().min(1).max(120),
    count: z.number().int().nonnegative().max(10_000),
    averageConfidence: z.number().min(0).max(1),
  })
  .strict();

const visionSummarySchema = z
  .object({
    objectCount: z.number().int().nonnegative().max(10_000),
    dominantClass: z.string().trim().min(1).max(120).optional(),
    averageConfidence: z.number().min(0).max(1).optional(),
    classes: z.array(visionDetectionClassSchema).max(30).optional(),
  })
  .strict();

const semanticAnalysisRequestSchema = z
  .object({
    imageUrl: z.string().url().max(2_048),
    title: z.string().trim().max(500).optional(),
    description: z.string().trim().max(5_000).optional(),
    visionSummary: visionSummarySchema.optional(),
  })
  .strict();

// kiểm tra và chuẩn hóa dữ liệu yêu cầu phân tích ngữ nghĩa sự cố
const parseSemanticAnalysisInput = (body: unknown) => {
  const parsed = semanticAnalysisRequestSchema.safeParse(body);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    description: parsed.data.description || "",
  };
};

// tiếp nhận yêu cầu phân tích trực tiếp sự cố từ cổng kết nối
app.post("/analyze", async (req, res) => {
  try {
    const input = parseSemanticAnalysisInput(req.body);
    if (!input) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu phân tích ảnh không hợp lệ.",
      });
    }
    const result = await analyzeIncidentWithOpenRouter(input);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error(
      "Direct AI analysis failed",
      safeOpenRouterErrorMetadata(error),
    );
    res.status(503).json({
      success: false,
      message: "Dịch vụ phân tích AI tạm thời không khả dụng.",
    });
  }
});

// kiểm tra và phân tích ngữ nghĩa hình ảnh sự cố
app.post("/validate-image", async (req, res) => {
  const input = parseSemanticAnalysisInput(req.body);
  if (!input) {
    return res
      .status(400)
      .json({ success: false, message: "Vui lòng cung cấp imageUrl hợp lệ." });
  }

  try {
    const result = await analyzeIncidentWithOpenRouter(input);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error(
      "Vision semantic analysis failed",
      safeOpenRouterErrorMetadata(error),
    );
    return res.status(503).json({
      success: false,
      message: "Không thể hoàn tất AI Vision semantic analysis.",
    });
  }
});
// lược đồ kiểm tra dữ liệu đầu vào cho yêu cầu hỏi đáp của cán bộ
const officerAskSchema = z.object({
  question: z.string().trim().min(1).max(500),
  category: z.literal("illegal_dumping").optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(2000),
      }),
    )
    .max(6)
    .optional(),
});

// tiếp nhận yêu cầu hỏi đáp nghiệp vụ và trả về kết quả truy xuất tri thức
app.post("/rag/officer-ask", async (req, res) => {
  const parsed = officerAskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp câu hỏi hợp lệ (tối đa 500 ký tự).",
    });
  }

  try {
    console.log("[RAG] history length:", parsed.data.history?.length ?? 0);
    const result = await officerRagService.ask(
      parsed.data.question,
      parsed.data.category ?? "illegal_dumping",
      parsed.data.history ?? [],
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    logger.error("Officer RAG request failed", error);
    return res.status(500).json({
      success: false,
      message: "Trợ lý AI tạm thời không khả dụng. Vui lòng thử lại sau.",
    });
  }
});

app.use(
  (
    _err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) =>
    res.status(500).json(errorResponse("Dịch vụ AI tạm thời không khả dụng.")),
);
export { app };
