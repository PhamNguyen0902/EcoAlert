import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function service(get: (...args: any[]) => Promise<unknown>) {
  // Vite supplies import.meta.env in the browser; provide its equivalent in this Node VM.
  const source = readFileSync(
    new URL("./services.ts", import.meta.url),
    "utf8",
  ).replace(/import\.meta\.env/g, "__testEnv");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: any = {};
  vm.runInNewContext(code, {
    exports,
    URLSearchParams,
    __testEnv: {},
    require: (id: string) => {
      assert.equal(id, "./api");
      return { api: { get } };
    },
    // Any public provider fallback is a test failure, including after a GIS 502.
    fetch: () => {
      throw new Error("Public fallback is forbidden");
    },
  });
  return exports.gisService;
}

test("web route only calls authenticated GIS and preserves actual GeoJSON", async () => {
  const geometry = {
    type: "LineString",
    coordinates: [
      [106.7, 10.77],
      [106.71, 10.78],
    ],
  };
  const data = { distanceMeters: 1234, durationSeconds: 180, geometry };
  let calls = 0;
  const gis = service(async (url, options) => {
    calls++;
    assert.equal(
      url,
      "/v1/gis/route?startLat=10.77&startLng=106.7&endLat=10.78&endLng=106.71",
    );
    assert.equal(options.timeout, 15000);
    return { data: { data } };
  });
  assert.equal(
    await gis.getDrivingRoute(
      { lat: 10.77, lng: 106.7 },
      { lat: 10.78, lng: 106.71 },
    ),
    data,
  );
  assert.equal(calls, 1);
});

test("web preserves GIS 502/504/404/network errors without public fallback", async () => {
  for (const status of [502, 504, 404, undefined]) {
    const failure = Object.assign(new Error("GIS unavailable"), {
      response: { status },
    });
    let calls = 0;
    const gis = service(async () => {
      calls++;
      throw failure;
    });
    await assert.rejects(
      gis.getDrivingRoute(
        { lat: 10.77, lng: 106.7 },
        { lat: 10.78, lng: 106.71 },
      ),
      (error) => error === failure,
    );
    assert.equal(calls, 1);
  }
});

test("Officer start action renders Leaflet route instead of opening an external URL", () => {
  const page = readFileSync(
    new URL(
      "../features/officer/pages/OfficerReportDetail.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /onStartNavigation=\{handleStartNavigation\}/);
  assert.match(
    page,
    /activeRoute\.geometry\.coordinates\.map\(\(\[lng, lat\]\) => \[lat, lng\]\)/,
  );
  assert.match(page, /positions=\{routeLeafletCoordinates\}/);
  const handler = page.slice(
    page.indexOf("const handleStartNavigation ="),
    page.indexOf("const handleStopNavigation ="),
  );
  assert.match(handler, /gisService\.getDrivingRoute/);
  assert.doesNotMatch(
    handler,
    /window\.open|openGoogleMaps|startGoogleMapsNavigation|router\.project-osrm/,
  );
});
