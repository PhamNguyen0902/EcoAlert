import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { OsrmRoutingService } from "../services/osrm-routing.service";
import { GisController } from "../controllers/gis.controller";
import type { Request, Response } from "express";

const options = { baseUrl: "http://osrm:5000", timeoutMs: 1000 };
const route = {
  distance: 1234,
  duration: 180,
  geometry: {
    type: "LineString",
    coordinates: [
      [106.7, 10.77],
      [106.71, 10.78],
    ],
  },
};
const payload = { code: "Ok", routes: [route] };

test("OSRM uses only configured private provider and preserves GeoJSON longitude/latitude contract", async () => {
  let calls = 0;
  const request: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(
      String(url),
      "http://osrm:5000/route/v1/driving/106.7,10.77;106.71,10.78?overview=full&geometries=geojson&steps=false&radiuses=1000;1000",
    );
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    return Response.json(payload);
  };
  const result = await new OsrmRoutingService(options, request).route(
    10.77,
    106.7,
    10.78,
    106.71,
  );
  assert.deepEqual(result, {
    distanceMeters: 1234,
    durationSeconds: 180,
    geometry: route.geometry,
  });
  assert.equal(calls, 1);
});

test("provider failures do not call any fallback and produce actionable 502", async () => {
  for (const response of ["network", "json", "http"] as const) {
    let calls = 0;
    const request: typeof fetch = async () => {
      calls++;
      if (response === "network") throw new TypeError("fetch failed");
      return response === "json"
        ? new globalThis.Response("<html>bad</html>")
        : new globalThis.Response("", { status: 503 });
    };
    await assert.rejects(
      new OsrmRoutingService(options, request).route(
        10.77,
        106.7,
        10.78,
        106.71,
      ),
      (e: any) => e.statusCode === 502,
    );
    assert.equal(calls, 1);
  }
});

test("invalid/no-route geometry never reaches the map as a fake successful route", async () => {
  for (const data of [
    null,
    {},
    { code: "NoRoute" },
    { code: "Ok", routes: [null] },
    { code: "Ok", routes: [{ ...route, duration: -1 }] },
    {
      code: "Ok",
      routes: [
        {
          ...route,
          geometry: {
            type: "LineString",
            coordinates: [
              [181, 10],
              [106, 91],
            ],
          },
        },
      ],
    },
    {
      code: "Ok",
      routes: [
        {
          ...route,
          geometry: { type: "LineString", coordinates: [[106.7, 10.77]] },
        },
      ],
    },
    {
      code: "Ok",
      routes: [
        { ...route, geometry: { type: "Point", coordinates: [106, 10] } },
      ],
    },
  ]) {
    const request: typeof fetch = async () => globalThis.Response.json(data);
    await assert.rejects(
      new OsrmRoutingService(options, request).route(
        10.77,
        106.7,
        10.78,
        106.71,
      ),
      (e: any) =>
        e.statusCode ===
        (data && "code" in data && data.code === "NoRoute" ? 404 : 502),
    );
  }
});

test("readiness checks an actual nearest-road response and reports provider failure", async () => {
  for (const [data, ready] of [
    [{ code: "Ok" }, true],
    [{ code: "NoSegment" }, false],
    [null, false],
  ] as const) {
    const service = new OsrmRoutingService(options, async (url) => {
      assert.ok(String(url).startsWith("http://osrm:5000/nearest/"));
      return globalThis.Response.json(data);
    });
    assert.equal(await service.ready(), ready);
  }
  assert.equal(
    await new OsrmRoutingService(options, async () => {
      throw new Error("offline");
    }).ready(),
    false,
  );
});

test("OSRM timeout aborts a real non-responsive HTTP request without fallback", async () => {
  const sockets = new Set<import("node:net").Socket>();
  const server = createServer(() => {});
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as import("node:net").AddressInfo;
    const service = new OsrmRoutingService({
      baseUrl: `http://127.0.0.1:${address.port}`,
      timeoutMs: 50,
    });
    await assert.rejects(
      service.route(10.77, 106.7, 10.78, 106.71),
      (e: any) => e.statusCode === 502,
    );
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("OSRM HTTP 400 NoSegment is a readable 404, not a provider failure", async () => {
  const service = new OsrmRoutingService(options, async () =>
    globalThis.Response.json({ code: "NoSegment" }, { status: 400 }),
  );
  await assert.rejects(
    service.route(10.77, 106.7, 10.78, 106.71),
    (e: any) => e.statusCode === 404,
  );
});

test("real HTTP redirects cannot forward route coordinates to another URL", async () => {
  let redirectedRequests = 0;
  const server = createServer((req, res) => {
    if (req.url === "/forwarded") {
      redirectedRequests++;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(payload));
    } else {
      res.writeHead(302, { Location: "/forwarded" });
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as import("node:net").AddressInfo;
    const service = new OsrmRoutingService({
      baseUrl: `http://127.0.0.1:${address.port}`,
      timeoutMs: 1000,
    });
    await assert.rejects(
      service.route(10.77, 106.7, 10.78, 106.71),
      (e: any) => e.statusCode === 502,
    );
    assert.equal(redirectedRequests, 0);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("route controller rejects missing/empty/array coordinates instead of coercing them to 0", async () => {
  const controller = new GisController();
  const valid = {
    startLat: "10.77",
    startLng: "106.7",
    endLat: "10.78",
    endLng: "106.71",
  };
  for (const query of [
    { ...valid, startLat: undefined },
    { ...valid, startLng: "" },
    { ...valid, endLat: ["10.78"] },
    { ...valid, endLat: "91" },
  ])
    await assert.rejects(
      controller.getRoute({ query } as unknown as Request, {} as Response),
      (e: any) => e.statusCode === 400,
    );
});
