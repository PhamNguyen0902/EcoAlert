import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import jwt from "jsonwebtoken";
import { createLogger, HTTP_STATUS, errorResponse } from "@ecoalert/shared";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import Redis from "ioredis";
import { randomUUID } from "crypto";

dotenv.config();

const app = express();
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 1));
const logger = createLogger("api-gateway");
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET must be configured before starting the API Gateway",
  );
}

// Redis is used only for the token blacklist. Do not let an unavailable Redis
// instance hold every authenticated API request in its offline command queue.
const redisClient = new Redis(REDIS_URL, {
  connectTimeout: 2_000,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
});

redisClient.on("connect", () => logger.info("Gateway connected to Redis"));
redisClient.on("error", (err) => logger.error("Gateway Redis error:", err));

app.use(cors());
app.use(helmet());

// Logging
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
);

// Rate Limiter cho tất cả các API - giới hạn cao để dev/test
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // High limit for dev/testing API requests
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse("Too many requests, please try again later."),
});
app.use("/api", limiter);

// Rate Limiter riêng cho auth (login/register) - thoải mái hơn để dev/test
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // 200 login attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse("Too many login attempts, please try again later."),
});
app.use("/api/v1/auth", authLimiter);

// Middleware để gán một request ID duy nhất cho mỗi yêu cầu, giúp theo dõi và debug dễ dàng hơn.
app.use((req, res, next) => {
  const reqId = randomUUID();
  req.headers["x-request-id"] = reqId;
  res.setHeader("x-request-id", reqId);
  next();
});

// Kiểm tra sức khỏe của API Gateway
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "api-gateway" });
});

// xác thực jwt token và gán user id user role vào header cho các downstream services
const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  // Never forward client-supplied identity/internal-service credentials.
  for(const name of ['x-user-id','x-user-role','x-user-email','x-service-name','x-service-time','x-service-signature']) delete req.headers[name];
  // Allow unauthenticated access to certain routes
  const publicRoutes = [
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh-token",
    "/api/v1/auth/verify-email",
    "/api/v1/auth/resend-verification",
    "/api/v1/auth/confirm-otp",
    "/api/v1/auth/resend-otp",
  ];

  // Loại bỏ query string để so sánh đường dẫn
  const cleanPath = req.originalUrl.split("?")[0];
  if (publicRoutes.includes(cleanPath)) {
    return next();
  }
  // Kiểm tra xem có header Authorization không
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Authentication token required"));
  }

  const token = authHeader.split(" ")[1];
  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (
      typeof decoded === "string" ||
      typeof decoded?.userId !== "string" ||
      typeof decoded?.role !== "string"
    ) {
      return res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json(errorResponse("Invalid or expired token"));
    }
  } catch (error) {
    logger.error("JWT Verification failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Invalid or expired token"));
  }

  // Kiểm tra xem token có bị blacklist trong Redis không (sau khi chữ ký JWT hợp lệ)
  try {
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json(errorResponse("Token is blacklisted"));
    }
  } catch (err) {
    logger.error("Redis blacklist check error", {
      message: err instanceof Error ? err.message : String(err),
    });
    // Nếu Redis gặp sự cố, vẫn cho phép tiếp tục xác thực để tránh gián đoạn dịch vụ.
  }

  // Gán thông tin người dùng đã xác thực vào header để các dịch vụ downstream có thể sử dụng.
  req.headers["x-user-id"] = decoded.userId;
  req.headers["x-user-role"] = decoded.role;
  if (typeof decoded.email === "string" && decoded.email.trim()) {
    req.headers["x-user-email"] = decoded.email;
  }
  next();
};

// Middleware xác thực JWT cho tất cả các yêu cầu đến /api, ngoại trừ các route công khai như login/register.
app.use("/api", verifyToken);


// WebSocket Proxy cho /socket.io
const socketProxy = createProxyMiddleware("/socket.io", {
  target: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3006",
  changeOrigin: true,
  ws: false,
  onError: (err, req, res) => {
    logger.error("WebSocket Proxy error for /socket.io", {
      message: err instanceof Error ? err.message : String(err),
    });
    if (res && "status" in res && typeof (res as Response).status === "function") {
      if (!(res as Response).headersSent) {
        (res as Response).status(502).json(errorResponse("Bad Gateway"));
      }
    } else if (res && "end" in res && typeof (res as any).end === "function") {
      (res as any).end();
    }
  },
});

// WebSocket endpoint cho /socket.io
app.use("/socket.io", socketProxy);

// Chặn các đường dẫn nội bộ không được phép gọi từ bên ngoài qua API Gateway
app.use((req, res, next) => {
  const cleanPath = req.originalUrl.split("?")[0].toLowerCase();
  if (cleanPath.includes("/internal/")) {
    return res.status(HTTP_STATUS.FORBIDDEN).json(errorResponse("Forbidden"));
  }
  next();
});

// Hàm thiết lập proxy giúp giảm thiểu sự trùng lặp mã nguồn.
const setupProxy = (
  path: string,
  target: string,
  rewrite: boolean = false,
  ws = false,
) => {
  app.use(
    path,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      ws,
      proxyTimeout: 60_000,
      timeout: 60_000,
      pathRewrite: rewrite ? { [`^${path}`]: "" } : undefined,
      onProxyReq: (proxyReq, req) => {
        if (req.body && Object.keys(req.body).length) {
          fixRequestBody(proxyReq, req);
        }
      },
      onError: (err, req, res) => {
        logger.error(`Proxy error for ${path}`, {
          message: err instanceof Error ? err.message : String(err),
        });
        if (res && "status" in res && typeof (res as Response).status === "function") {
          if (!(res as Response).headersSent) {
            (res as Response).status(502).json(errorResponse("Bad Gateway"));
          }
        } else if (res && "end" in res && typeof (res as any).end === "function") {
          (res as any).end();
        }
      },
    }),
  );
};
// định tuyến các endpoint sang media service alert service ai service gis service
setupProxy(
  "/api/v1/auth",
  process.env.USER_SERVICE_URL || "http://localhost:3001",
);
setupProxy(
  "/api/v1/users",
  process.env.USER_SERVICE_URL || "http://localhost:3001",
);
setupProxy(
  "/api/v1/alerts",
  process.env.ALERT_SERVICE_URL || "http://localhost:3002",
  true,
);
setupProxy(
  "/api/v1/media",
  process.env.MEDIA_SERVICE_URL || "http://localhost:3003",
  true,
);
setupProxy(
  "/api/v1/gis",
  process.env.GIS_SERVICE_URL || "http://localhost:3004",
  true,
);
setupProxy(
  "/api/v1/notifications",
  process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3006",
  true,
  false,
);
setupProxy(
  "/api/v1/ai",
  process.env.AI_SERVICE_URL || "http://localhost:3005",
  true,
);

// Global error handler để xử lý các lỗi không được bắt trong các route hoặc middleware.
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error("Gateway Error:", err);
  res.status(500).json(errorResponse("API Gateway Internal Error"));
});

const server = app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});

// Thiết lập WebSocket upgrade để chuyển tiếp các kết nối WebSocket đến dịch vụ thông báo.
server.on("upgrade", (req, socket, head) => {
  if (req.url && req.url.startsWith("/socket.io")) {
    (socketProxy as any).upgrade?.(req, socket, head);
  }
});
