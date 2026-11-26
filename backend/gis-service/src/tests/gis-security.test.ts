import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { app } from "../app";
import { gisService } from "../services/gis.service";

test("GIS incident heatmap/drilldown reject forged headers without JWT and reject non-ADMIN JWTs", async () => {
  const prevSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-gis-security-secret-32chars";
  const originalGetHeatmap = gisService.getHeatmap;

  const signJwt = (userId: string, role: string): string => {
    const input = [
      { alg: "HS256", typ: "JWT" },
      { userId, role, exp: Math.floor(Date.now() / 1000) + 60 },
    ]
      .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
      .join(".");
    return `${input}.${createHmac("sha256", process.env.JWT_SECRET!).update(input).digest("base64url")}`;
  };

  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });

  try {
    gisService.getHeatmap = async () => [] as any;
    const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    // 1. Spoofed x-user-role: ADMIN without JWT must return 401
    for (const path of ["/incidents/heatmap", "/incidents/nearby?lat=10.77&lng=106.7"]) {
      const spoofed = await fetch(`${baseUrl}${path}`, {
        headers: { "x-user-id": "attacker", "x-user-role": "ADMIN" },
      });
      assert.equal(spoofed.status, 401);
    }

    // 2. Valid CITIZEN JWT cannot access admin heatmap/drilldown even with spoofed header (403)
    const citizenToken: string = signJwt("citizen-1", "CITIZEN");
    for (const path of ["/incidents/heatmap", "/incidents/nearby?lat=10.77&lng=106.7"]) {
      const forbidden = await fetch(`${baseUrl}${path}`, {
        headers: { authorization: `Bearer ${citizenToken}`, "x-user-role": "ADMIN" },
      });
      assert.equal(forbidden.status, 403);
    }

    // 3. Valid ADMIN JWT with empty coordinates on /incidents/nearby returns 400 instead of coercing to (0, 0)
    const adminToken: string = signJwt("admin-1", "ADMIN");
    const emptyCoords = await fetch(`${baseUrl}/incidents/nearby?lat=&lng=`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(emptyCoords.status, 400);

    const okHeatmap = await fetch(`${baseUrl}/incidents/heatmap`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(okHeatmap.status, 200);
  } finally {
    gisService.getHeatmap = originalGetHeatmap;
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  }
});
