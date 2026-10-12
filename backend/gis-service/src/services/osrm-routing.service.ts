import { AppError, createLogger } from "@ecoalert/shared";
import { envConfig } from "../config/env.config";
import { RoutingCoverage } from "./routing-coverage";

export interface DrivingRoute {
  distanceMeters: number;
  durationSeconds: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

const logger = createLogger("gis-routing");
interface RoutingConfig {
  baseUrl: string;
  timeoutMs: number;
  profile?: string;
  dataRoot?: string;
}
export class OsrmRoutingService {
  private readonly profile: string;
  private readonly coverage?: RoutingCoverage;
  constructor(
    private readonly config: RoutingConfig = {
      baseUrl: envConfig.osrmBaseUrl,
      timeoutMs: envConfig.osrmTimeoutMs,
      profile: envConfig.osrmRoutingProfile,
      dataRoot: envConfig.osrmDataRoot,
    },
    private readonly request: typeof fetch = fetch,
  ) {
    this.profile = config.profile || "driving";
    if (this.profile !== "driving")
      throw new Error(
        "OSRM_ROUTING_PROFILE must be driving for the prepared car.lua graph",
      );
    this.coverage = config.dataRoot
      ? new RoutingCoverage(config.dataRoot)
      : undefined;
    const url = new URL(config.baseUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        "OSRM_BASE_URL must be an HTTP(S) base URL without credentials/query/hash",
      );
  }

  private async json(
    path: string,
    timeoutMs = this.config.timeoutMs,
  ): Promise<unknown> {
    const started = Date.now();
    try {
      // A redirect must never silently forward officer coordinates to another provider.
      const response = await this.request(
        `${this.config.baseUrl.replace(/\/+$/, "")}${path}`,
        {
          signal: AbortSignal.timeout(timeoutMs),
          redirect: "error",
        },
      );
      if (!response.ok) {
        // OSRM uses HTTP 400 for a point with no nearby routable road. This is a
        // valid no-route result, not a provider outage; keep the public API's 404.
        if (response.status === 400) {
          const body = await response.json();
          if (body?.code === "NoRoute" || body?.code === "NoSegment")
            return body;
        }
        logger.warn("OSRM HTTP error", {
          provider: new URL(this.config.baseUrl).host,
          status: response.status,
        });
        throw new AppError(
          "Dịch vụ định tuyến nội bộ chưa sẵn sàng. Vui lòng thử lại.",
          502,
        );
      }
      return await response.json();
    } catch (error) {
      if (error instanceof AppError) throw error;
      // Do not log the request URL, user coordinates or tokens.
      logger.warn("OSRM connection/response failure", {
        provider: new URL(this.config.baseUrl).host,
        elapsedMs: Date.now() - started,
        reason: error instanceof Error ? error.name : "UnknownError",
      });
      throw new AppError(
        "Không kết nối được dịch vụ định tuyến nội bộ. Vui lòng thử lại.",
        502,
      );
    }
  }

  async ready(): Promise<boolean> {
    try {
      this.coverage?.ready();
      const data = await this.json(
        `/nearest/v1/${this.profile}/106.7009,10.7769?number=1`,
        Math.min(2500, this.config.timeoutMs),
      );
      return Boolean(
        data &&
        typeof data === "object" &&
        "code" in data &&
        data.code === "Ok",
      );
    } catch {
      return false;
    }
  }

  async route(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
  ): Promise<DrivingRoute> {
    this.coverage?.assertContains(startLat, startLng);
    this.coverage?.assertContains(endLat, endLng);
    const started = Date.now();
    const data = (await this.json(
      `/route/v1/${this.profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=false&radiuses=1000;1000`,
    )) as {
      code?: string;
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { type?: string; coordinates?: unknown };
      }>;
    } | null;
    if (data?.code === "NoRoute" || data?.code === "NoSegment")
      throw new AppError(
        "Không tìm thấy tuyến đường ô tô phù hợp trong vùng TP.HCM. Vị trí phải gần đường ô tô trong phạm vi 1 km.",
        404,
      );
    const route = Array.isArray(data?.routes) ? data.routes[0] : undefined;
    const coordinates = route?.geometry?.coordinates;
    if (
      data?.code !== "Ok" ||
      route?.geometry?.type !== "LineString" ||
      !Array.isArray(coordinates) ||
      coordinates.length < 2 ||
      typeof route.distance !== "number" ||
      !Number.isFinite(route.distance) ||
      route.distance < 0 ||
      typeof route.duration !== "number" ||
      !Number.isFinite(route.duration) ||
      route.duration < 0 ||
      !coordinates.every(
        (p): p is [number, number] =>
          Array.isArray(p) &&
          p.length >= 2 &&
          typeof p[0] === "number" &&
          Number.isFinite(p[0]) &&
          Math.abs(p[0]) <= 180 &&
          typeof p[1] === "number" &&
          Number.isFinite(p[1]) &&
          Math.abs(p[1]) <= 90,
      )
    )
      throw new AppError(
        "Dịch vụ định tuyến trả về dữ liệu không hợp lệ.",
        502,
      );
    logger.info("Internal OSRM route computed", {
      elapsedMs: Date.now() - started,
      pointCount: coordinates.length,
    });
    return {
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: { type: "LineString", coordinates },
    };
  }
}
export const osrmRoutingService = new OsrmRoutingService();
