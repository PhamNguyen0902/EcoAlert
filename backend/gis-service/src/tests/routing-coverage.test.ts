import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RoutingCoverage } from "../services/routing-coverage";
import { OsrmRoutingService } from "../services/osrm-routing.service";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ecoalert-routing-coverage-"));
  const active = `graphs/${"a".repeat(64)}-20261012T120000`;
  const graph = join(root, active);
  mkdirSync(graph, { recursive: true });
  writeFileSync(join(root, "active.txt"), active);
  writeFileSync(
    join(graph, "ecoalert-ready"),
    `${"a".repeat(64)} car test-image`,
  );
  writeFileSync(
    join(graph, "coverage.geojson"),
    JSON.stringify({
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [106.3, 10.2],
            [107.2, 10.2],
            [107.2, 11.3],
            [106.3, 11.3],
            [106.3, 10.2],
          ],
          [
            [106.8, 10.9],
            [106.9, 10.9],
            [106.9, 11],
            [106.8, 11],
            [106.8, 10.9],
          ],
        ],
      },
    }),
  );
  return root;
}

test("routing coverage uses the active polygon, including holes/boundary, with correct longitude/latitude axes", () => {
  const root = fixture();
  try {
    const coverage = new RoutingCoverage(root);
    assert.doesNotThrow(() => coverage.assertContains(10.7769, 106.7009));
    assert.doesNotThrow(() => coverage.assertContains(10.2, 106.3));
    for (const point of [
      [21.0285, 105.8542],
      [10.95, 106.85],
      [106.7009, 10.7769],
    ])
      assert.throws(
        () => coverage.assertContains(point[0], point[1]),
        (e: any) => e.statusCode === 422,
      );
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("missing graph/pointer traversal is unavailable and never fetches coordinates to any provider", async () => {
  const root = fixture();
  let calls = 0;
  try {
    const service = new OsrmRoutingService(
      { baseUrl: "http://osrm:5000", timeoutMs: 1000, dataRoot: root },
      async () => {
        calls++;
        throw new Error("Must not fetch");
      },
    );
    await assert.rejects(
      service.route(21.0285, 105.8542, 10.7769, 106.7009),
      (e: any) => e.statusCode === 422,
    );
    writeFileSync(join(root, "active.txt"), "../outside");
    await assert.rejects(
      service.route(10.7769, 106.7009, 10.8, 106.71),
      (e: any) => e.statusCode === 503,
    );
    assert.equal(await service.ready(), false);
    assert.equal(calls, 0);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("a car graph cannot be relabelled as motorcycle or walking by configuration", () => {
  assert.throws(
    () =>
      new OsrmRoutingService({
        baseUrl: "http://osrm:5000",
        timeoutMs: 1000,
        profile: "motorcycle",
      }),
    /must be driving/,
  );
});
