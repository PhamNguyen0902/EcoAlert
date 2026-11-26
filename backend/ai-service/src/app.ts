import express from "express";
import cors from "cors";
import {
  AppError,
  createLogger,
  errorResponse,
  requireInternalService,
  requireVerifiedRoles,
} from "@ecoalert/shared";
import { z } from "zod";
import {
  analyzeIncidentWithOpenRouter,
  safeOpenRouterErrorMetadata,
} from "./services/openrouter.service";

const logger = createLogger("ai-service");
const semanticFailure = (error: unknown) => {
  const metadata = safeOpenRouterErrorMetadata(error);
  return { success: false, code: metadata.status === 402 ? "AI_PROVIDER_BILLING_REQUIRED" : "AI_SEMANTIC_UNAVAILABLE",
    providerStatus: metadata.status, message: "Chưa thể hoàn tất đánh giá tự động." };
};

const VALIDATE_WINDOW_MS = 15 * 60 * 1000;
const validateBuckets = new Map<string, { count: number; resetAt: number }>();

export const resetValidateImageRateLimiter = () => {
  validateBuckets.clear();
};

const validateImageRateLimiter: express.RequestHandler = (req, res, next) => {
  const maxRequests = Math.max(
    1,
    Number(process.env.AI_VALIDATE_RATE_LIMIT_MAX) || 30,
  );
  const now = Date.now();
  if (validateBuckets.size > 1_000) {
    for (const [key, bucket] of validateBuckets.entries()) {
      if (bucket.resetAt <= now) validateBuckets.delete(key);
    }
  }
  const key = String(req.headers["x-user-id"] || req.ip || "anonymous");
  const existing = validateBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    validateBuckets.set(key, { count: 1, resetAt: now + VALIDATE_WINDOW_MS });
    return next();
  }
  if (existing.count >= maxRequests) {
    return res.status(429).json({
      success: false,
      message: "Quá nhiều yêu cầu xác thực ảnh. Vui lòng thử lại sau.",
    });
  }
  existing.count += 1;
  return next();
};

export const isAllowedImageUrl = (rawUrl: string): boolean => {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "https:" || !parsed.hostname) return false;
    const hostname = parsed.hostname.toLowerCase();
    const allowedHosts = new Set(
      (process.env.ALLOWED_IMAGE_HOSTS || "")
        .split(",")
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean),
    );
    const bucket = (process.env.AWS_S3_BUCKET_NAME || "").trim().toLowerCase();
    const region = (process.env.AWS_REGION || "").trim().toLowerCase();
    const s3Host = bucket && region ? `${bucket}.s3.${region}.amazonaws.com` : "";
    if (s3Host) allowedHosts.add(s3Host);
    if (allowedHosts.size === 0 || !allowedHosts.has(hostname)) return false;
    if (s3Host && hostname === s3Host && !parsed.pathname.startsWith("/ecoalert/")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

const requireAnalyzeAuth: express.RequestHandler = (req, res, next) => {
  if (req.headers["x-service-name"] || req.headers["x-service-signature"]) {
    return requireInternalService(["alert-service"])(req, res, next);
  }
  return requireVerifiedRoles(["ADMIN"])(req, res, next);
};

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
app.post("/analyze", requireAnalyzeAuth, async (req, res) => {
  try {
    const input = parseSemanticAnalysisInput(req.body);
    if (!input) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu phân tích ảnh không hợp lệ.",
      });
    }
    if (!isAllowedImageUrl(input.imageUrl)) {
      return res.status(400).json({
        success: false,
        message: "URL hình ảnh không thuộc nguồn lưu trữ được phép.",
      });
    }
    const result = await analyzeIncidentWithOpenRouter(input);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error(
      "Direct AI analysis failed",
      safeOpenRouterErrorMetadata(error),
    );
    res.status(503).json(semanticFailure(error));
  }
});

// kiểm tra và phân tích ngữ nghĩa hình ảnh sự cố
app.post(
  "/validate-image",
  requireVerifiedRoles(["CITIZEN", "OFFICER", "ADMIN"]),
  validateImageRateLimiter,
  async (req, res) => {
    const input = parseSemanticAnalysisInput(req.body);
    if (!input) {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng cung cấp imageUrl hợp lệ." });
    }
    if (!isAllowedImageUrl(input.imageUrl)) {
      return res.status(400).json({
        success: false,
        message: "URL hình ảnh không thuộc nguồn lưu trữ được phép.",
      });
    }

    try {
      const result = await analyzeIncidentWithOpenRouter(input);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error(
        "Vision semantic analysis failed",
        safeOpenRouterErrorMetadata(error),
      );
      return res.status(503).json(semanticFailure(error));
    }
  },
);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json(errorResponse(err.message));
    }
    return res
      .status(500)
      .json(errorResponse("Dịch vụ AI tạm thời không khả dụng."));
  },
);
export { app };
