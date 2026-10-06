import { createHmac, timingSafeEqual } from "crypto";
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { AppError, ForbiddenError, UnauthorizedError } from "../errors";

const secret = () =>
  process.env.SERVICE_AUTH_SECRET || process.env.JWT_SECRET || "";
const signature = (
  name: string,
  timestamp: string,
  method: string,
  path: string,
  body: unknown,
) =>
  createHmac("sha256", secret())
    .update(JSON.stringify([name, timestamp, method, path, body ?? null]))
    .digest("hex");
export function internalServiceHeaders(
  name: string,
  path: string,
  body: unknown,
) {
  if (secret().length < 16)
    throw new AppError(
      "Internal service authentication is not configured",
      503,
    );
  const timestamp = Date.now().toString();
  return {
    "content-type": "application/json",
    "x-service-name": name,
    "x-service-time": timestamp,
    "x-service-signature": signature(name, timestamp, "POST", path, body),
  };
}
/** The service identity, method, exact URL and body are all signed. Role headers are not credentials. */
export const requireInternalService =
  (allowed: string[]): RequestHandler =>
  (req, _res, next) => {
    const name = req.get("x-service-name") || "",
      time = req.get("x-service-time") || "";
    const supplied = req.get("x-service-signature") || "";
    const expected = signature(
      name,
      time,
      req.method,
      req.originalUrl,
      req.body,
    );
    if (
      secret().length < 16 ||
      !allowed.includes(name) ||
      !Number.isFinite(Number(time)) ||
      Math.abs(Date.now() - Number(time)) > 30_000 ||
      !/^[a-f0-9]{64}$/.test(supplied) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
    )
      return next(
        new UnauthorizedError("Internal service authentication required"),
      );
    next();
  };
/** Verify the real JWT at sensitive service boundaries, independently of gateway-supplied headers. */
export const requireVerifiedRoles =
  (roles: string[]): RequestHandler =>
  (req, _res, next) => {
    try {
      const token = req.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
      if (!token || !process.env.JWT_SECRET)
        throw new UnauthorizedError("Authentication token required");
      const claims = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
      });
      if (
        typeof claims === "string" ||
        typeof claims.userId !== "string" ||
        typeof claims.role !== "string"
      )
        throw new UnauthorizedError("Invalid authentication token");
      if (!roles.includes(claims.role.toUpperCase()))
        throw new ForbiddenError("Không có quyền thực hiện hành động này");
      req.headers["x-user-id"] = claims.userId;
      req.headers["x-user-role"] = claims.role.toUpperCase();
      next();
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : new UnauthorizedError("Invalid authentication token"),
      );
    }
  };
export async function internalServiceRequest<T>(
  base: string,
  path: string,
  name: string,
  body: unknown,
): Promise<T> {
  // Bounded retry is safe here: these internal endpoints are read-only despite POST bodies.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
        method: "POST",
        headers: internalServiceHeaders(name, path, body),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new AppError("Dependency unavailable", 502);
      const payload = (await response.json()) as {
        success?: boolean;
        data?: T;
      };
      if (!payload.success || payload.data === undefined)
        throw new AppError("Invalid dependency response", 502);
      return payload.data;
    } catch (error) {
      if (attempt === 1) throw new AppError("Dependency unavailable", 502);
    }
  }
  throw new AppError("Dependency unavailable", 502);
}
