// Run from the host: node scripts/osrm/mobile-integration.cjs
// Real GIS/OSRM HTTP calls run inside gis-service (no public fallback). The actual
// mobile adapter/parser runs here with an HTTP transport, not an invented route.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const vm = require("node:vm");
const root = resolve(__dirname, "../..");
const ts = require(join(root, "mobile/node_modules/typescript"));

function load(file, imports) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(join(root, "mobile/src", file), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require: (id) => {
        assert.ok(id in imports, `Unexpected dependency: ${id}`);
        return imports[id];
      },
    },
  );
  return exports;
}
const maps = load("utils/maps.ts", {
  "react-native": {
    Linking: {
      openURL() {
        throw new Error("External navigation forbidden");
      },
    },
  },
});
let lastBody;
const api = {
  get: async (url, options) => {
    assert.equal(url, "/v1/gis/route");
    assert.equal(options.timeout, 15000);
    const params = new URLSearchParams(options.params).toString();
    const script = `const r = await fetch(${JSON.stringify("http://127.0.0.1:3004/route?" + params)}, {signal: AbortSignal.timeout(15000), redirect:'error'}); console.log(JSON.stringify({status:r.status, body:await r.json()}));`;
    const result = spawnSync(
      "docker",
      ["compose", "exec", "-T", "gis-service", "node", "--input-type=module"],
      {
        cwd: root,
        input: script,
        encoding: "utf8",
        timeout: 20000,
      },
    );
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    const response = JSON.parse(result.stdout.trim());
    lastBody = response.body;
    if (response.status !== 200)
      throw { response: { status: response.status, data: response.body } };
    return { data: response.body };
  },
};
const mobile = load("api/officerRouting.ts", {
  "./client": { api },
  "../utils/maps": maps,
});
async function main() {
  const route = await mobile.getOfficerRoute(
    { latitude: 10.7769, longitude: 106.7009 },
    { latitude: 10.84498, longitude: 106.708477 },
  );
  assert.ok(route.points.length > 10);
  assert.ok(route.distanceMeters > 0 && route.durationSeconds > 0);
  for (let i = 0; i < route.points.length; i++) {
    assert.equal(
      route.points[i].longitude,
      lastBody.data.geometry.coordinates[i][0],
    );
    assert.equal(
      route.points[i].latitude,
      lastBody.data.geometry.coordinates[i][1],
    );
  }
  console.log(
    JSON.stringify({
      status: "PASS",
      client: "actual mobile getOfficerRoute / parseOfficerRoute",
      pointCount: route.points.length,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
    }),
  );
  await assert.rejects(
    mobile.getOfficerRoute(
      { latitude: 21.0285, longitude: 105.8542 },
      { latitude: 10.7769, longitude: 106.7009 },
    ),
    (error) => error.response?.status === 422,
  );
  console.log(
    "PASS: mobile propagates unsupported-region errors; no Google Maps/public provider called. Native visual rendering still requires a device.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
