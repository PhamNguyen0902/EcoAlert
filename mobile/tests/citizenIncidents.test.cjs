const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const output = {};
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(
      path.join(__dirname, "../src/utils/citizenIncidents.ts"),
      "utf8",
    ),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    },
  ).outputText,
  { exports: output },
);
const {
  toMapCoordinate,
  getIncidentGroup,
  distanceMeters,
  matchesMyReportFilter,
} = output;
test("GeoJSON longitude/latitude converts without changing the source", () => {
  const point = { type: "Point", coordinates: [106.775, 10.823] };
  const result = toMapCoordinate(point);
  assert.equal(result.latitude, 10.823);
  assert.equal(result.longitude, 106.775);
  assert.deepEqual(point.coordinates, [106.775, 10.823]);
});
test("invalid, missing and out-of-range coordinates are ignored; zero is valid", () => {
  for (const coordinates of [
    [],
    [NaN, 10],
    [106, Infinity],
    [181, 10],
    [106, -91],
    ["106", 10],
  ])
    assert.equal(toMapCoordinate({ coordinates }), null);
  assert.equal(toMapCoordinate(undefined), null);
  assert.equal(toMapCoordinate({ coordinates: {} }), null);
  assert.equal(toMapCoordinate({ coordinates: "106,10" }), null);
  assert.equal(toMapCoordinate({ coordinates: [0, 0] }).latitude, 0);
});
test("all workflow groups are consistent and rejected/unknown are not public markers", () => {
  for (const s of ["PENDING", "ai_analyzing", "VERIFIED"])
    assert.equal(getIncidentGroup(s), "PENDING");
  for (const s of ["ASSIGNED", "in_progress"])
    assert.equal(getIncidentGroup(s), "PROCESSING");
  for (const s of ["RESOLVED", "closed"])
    assert.equal(getIncidentGroup(s), "RESOLVED");
  for (const s of ["REJECTED", "invalid", undefined])
    assert.equal(getIncidentGroup(s), null);
});
test("My Reports processing includes pending, resolved includes closed, all includes rejected", () => {
  for (const status of [
    "PENDING",
    "AI_ANALYZING",
    "VERIFIED",
    "ASSIGNED",
    "IN_PROGRESS",
  ])
    assert.ok(matchesMyReportFilter({ status }, "PROCESSING"));
  assert.ok(matchesMyReportFilter({ status: "CLOSED" }, "RESOLVED"));
  assert.ok(matchesMyReportFilter({ status: "REJECTED" }, "ALL"));
  assert.equal(
    matchesMyReportFilter({ status: "REJECTED" }, "PROCESSING"),
    false,
  );
});
test("near-me distances are bounded and use meters", () => {
  const a = { latitude: 10.823, longitude: 106.775 };
  assert.equal(distanceMeters(a, a), 0);
  assert.ok(distanceMeters(a, { latitude: 10.833, longitude: 106.775 }) > 1100);
  assert.ok(distanceMeters(a, { latitude: 10.833, longitude: 106.775 }) < 1120);
});
