const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");
const util = {};
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(
      path.join(__dirname, "../src/lib/officer-field-evidence.ts"),
      "utf8",
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  { exports: util },
);
test("web resolution acquires fresh GPS with zero cache age and preserves accuracy", async () => {
  let options;
  const location = await util.getFreshOfficerFieldLocation({
    getCurrentPosition: async (success, _error, input) => {
      options = input;
      success({ coords: { latitude: 10.7, longitude: 106.7, accuracy: 12 } });
    },
  });
  assert.equal(options.maximumAge, 0);
  assert.equal(options.enableHighAccuracy, true);
  assert.equal(location.accuracyMeters, 12);
  assert.equal(location.latitude, 10.7);
});
test("permission denied, GPS unavailable, invalid coordinates do not fake a location", async () => {
  await assert.rejects(
    util.getFreshOfficerFieldLocation({
      getCurrentPosition: (_success, error) => error({ code: 1 }),
    }),
    /cho phép vị trí/,
  );
  await assert.rejects(
    util.getFreshOfficerFieldLocation({
      getCurrentPosition: (_success, error) => error({ code: 2 }),
    }),
    /Không thể lấy/,
  );
  await assert.rejects(
    util.getFreshOfficerFieldLocation({
      getCurrentPosition: (success) =>
        success({ coords: { latitude: 91, longitude: 106, accuracy: 12 } }),
    }),
    /GPS chưa/,
  );
});
test("legacy web photos attach real foreground GPS but never invent capture time or distance", () => {
  const location = { latitude: 10.7, longitude: 106.7, accuracyMeters: 12 };
  const evidence = util.attachOfficerEvidenceLocation(
    ["https://example.test/a.jpg", "https://example.test/b.jpg"],
    location,
  );
  assert.equal(evidence.length, 2);
  assert.equal(evidence[0].location, location);
  assert.equal(evidence[0].capturedAt, undefined);
  assert.equal(evidence[0].distanceFromIncidentMeters, undefined);
});
