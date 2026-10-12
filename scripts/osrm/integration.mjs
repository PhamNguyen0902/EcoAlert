import assert from "node:assert/strict";

// Run INSIDE gis-service: verifies actual private Docker networking, not a mock.
const gis = process.env.GIS_TEST_BASE_URL || "http://localhost:3004";
const osrm = process.env.OSRM_BASE_URL || "http://osrm:5000";
async function json(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  assert.equal(
    response.status,
    200,
    `${new URL(url).host} returned HTTP ${response.status}`,
  );
  return response.json();
}
const readiness = await json(`${gis}/health/ready`);
assert.equal(readiness.routing, "ready");
const pairs = [
  [
    [10.7769, 106.7009],
    [10.84498, 106.708477],
  ],
  [
    [10.84498, 106.708477],
    [10.7769, 106.7009],
  ],
];
for (const [start, end] of pairs) {
  const params = new URLSearchParams({
    startLat: start[0],
    startLng: start[1],
    endLat: end[0],
    endLng: end[1],
  });
  const body = await json(`${gis}/route?${params}`);
  assert.equal(body.success, true);
  const route = body.data;
  assert.equal(route.geometry.type, "LineString");
  assert.ok(route.geometry.coordinates.length > 2);
  assert.ok(Number.isFinite(route.distanceMeters) && route.distanceMeters > 0);
  assert.ok(
    Number.isFinite(route.durationSeconds) && route.durationSeconds > 0,
  );
  for (const [lng, lat] of route.geometry.coordinates) {
    assert.ok(Number.isFinite(lng) && lng >= 106 && lng <= 107);
    assert.ok(Number.isFinite(lat) && lat >= 10 && lat <= 11);
  }
  // Direct local OSRM result must match the GIS contract, including every point.
  const direct = await json(
    `${osrm}/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&steps=false&radiuses=1000;1000`,
  );
  assert.equal(direct.code, "Ok");
  assert.equal(route.distanceMeters, direct.routes[0].distance);
  assert.equal(route.durationSeconds, direct.routes[0].duration);
  assert.deepEqual(
    route.geometry.coordinates,
    direct.routes[0].geometry.coordinates,
  );
  console.log(
    JSON.stringify({
      status: "PASS",
      start,
      end,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      pointCount: route.geometry.coordinates.length,
    }),
  );
}
const invalid = await fetch(
  `${gis}/route?startLat=bad&startLng=106.7&endLat=10.8&endLng=106.71`,
);
assert.equal(invalid.status, 400);
const outside = await fetch(
  `${gis}/route?startLat=21.0285&startLng=105.8542&endLat=10.7769&endLng=106.7009`,
);
assert.equal(
  outside.status,
  422,
  "Hanoi must not silently snap onto a road in HCMC",
);
assert.match((await outside.json()).message, /ngoài vùng định tuyến TP.HCM/);
console.log(
  "PASS: GIS → private OSRM → valid HCMC GeoJSON; invalid input and unsupported region rejected.",
);
