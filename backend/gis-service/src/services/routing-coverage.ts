import { readFileSync } from "node:fs";
import { join } from "node:path";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { AppError, createLogger } from "@ecoalert/shared";

const logger = createLogger("gis-routing-coverage");
export class RoutingCoverage {
  private active = "";
  private polygon?: Feature<Polygon | MultiPolygon>;
  constructor(private readonly root: string) {}

  private load() {
    try {
      const active = readFileSync(join(this.root, "active.txt"), "utf8").trim();
      if (!/^graphs\/[a-f0-9]{64}-\d{8}T\d{6}$/.test(active))
        throw new Error("InvalidGraphPointer");
      if (active !== this.active || !this.polygon) {
        const graph = join(this.root, active);
        const marker = readFileSync(
          join(graph, "ecoalert-ready"),
          "utf8",
        ).trim();
        if (!/^[a-f0-9]{64} car \S+$/.test(marker))
          throw new Error("GraphNotReady");
        const polygon = JSON.parse(
          readFileSync(join(graph, "coverage.geojson"), "utf8"),
        );
        if (
          polygon?.type !== "Feature" ||
          !["Polygon", "MultiPolygon"].includes(polygon?.geometry?.type)
        )
          throw new Error("InvalidCoveragePolygon");
        // Exercise the geometry parser before marking the cached polygon ready.
        booleanPointInPolygon([106.7009, 10.7769], polygon);
        this.polygon = polygon;
        this.active = active;
      }
      return this.polygon!;
    } catch {
      logger.warn("HCMC routing coverage unavailable; no fallback allowed");
      throw new AppError(
        "Dữ liệu định tuyến TP.HCM chưa sẵn sàng. Vui lòng liên hệ quản trị viên.",
        503,
      );
    }
  }

  ready() {
    this.load();
  }

  assertContains(latitude: number, longitude: number) {
    if (!booleanPointInPolygon([longitude, latitude], this.load()))
      throw new AppError(
        "Vị trí nằm ngoài vùng định tuyến TP.HCM được hỗ trợ (kèm vùng đệm 10 km).",
        422,
      );
  }
}
