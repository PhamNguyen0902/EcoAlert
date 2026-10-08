const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const requests = [];
let response = {};
const moduleExports = {};
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(
      path.join(__dirname, "../src/services/serviceAreas.ts"),
      "utf8",
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  {
    exports: moduleExports,
    require: () => ({
      api: Object.fromEntries(
        ["get", "post", "patch", "delete"].map((method) => [
          method,
          async (url, body) => {
            requests.push({ method, url, body });
            return { data: { data: response } };
          },
        ]),
      ),
    }),
  },
);
test("service area CRUD and preview use real API routes and do not modify data on preview", async () => {
  const service = moduleExports.serviceAreas;
  requests.length = 0;
  response = { items: [], total: 0 };
  await service.list(2);
  assert.equal(requests[0].url, "/v1/gis/service-areas?page=2&limit=20");
  response = { _id: "area" };
  const input = {
    code: "TEST",
    name: "Test",
    geometry: { type: "Polygon", coordinates: [] },
    assignedOfficerIds: [],
  };
  await service.save(input);
  await service.save(input, "area");
  assert.equal(requests[1].method, "post");
  assert.equal(requests[2].method, "patch");
  assert.equal(requests[2].body, input);
  await service.preview("alert");
  assert.equal(requests[3].method, "get");
  assert.equal(requests[3].url, "/v1/alerts/alert/assignment-preview");
  await service.autoAssign("alert");
  assert.equal(requests[4].method, "post");
  await service.deactivate("area");
  assert.equal(requests[5].method, "delete");
});
test("backend failure reasons have human-readable Vietnamese labels without faking success", () => {
  for (const reason of [
    "AREA_NOT_FOUND",
    "NO_OFFICER_IN_AREA",
    "NO_ACTIVE_SHIFT",
    "CAPACITY_REACHED",
    "DEPENDENCY_UNAVAILABLE",
    "ASSIGNMENT_BUSY",
  ])
    assert.notEqual(moduleExports.assignmentReasonLabel(reason), reason);
  assert.equal(moduleExports.assignmentReasonLabel(), "Chờ phân công");
  assert.match(
    moduleExports.assignmentReasonLabel("DEPENDENCY_UNAVAILABLE"),
    /không khả dụng/,
  );
});
