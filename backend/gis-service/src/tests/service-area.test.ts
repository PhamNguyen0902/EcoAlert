import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { areaGeometrySchema, areaInputSchema } from "../dtos/service-area.dto";
import { ServiceArea } from "../models/service-area.model";
import { serviceAreaService } from "../services/service-area.service";
import { app } from "../app";
import { internalServiceHeaders } from "@ecoalert/shared";

const polygon = {
  type: "Polygon" as const,
  coordinates: [
    [
      [106, 10],
      [107, 10],
      [107, 11],
      [106, 11],
      [106, 10],
    ],
  ],
};
test("GeoJSON validation rejects invalid coordinates, open/empty/self-crossing polygons and duplicate Officers", () => {
  assert.equal(areaGeometrySchema.safeParse(polygon).success, true);
  for (const coordinates of [
    [],
    [[]],
    [
      [
        [181, 10],
        [107, 10],
        [107, 11],
        [181, 10],
      ],
    ],
    [
      [
        [106, 10],
        [107, 10],
        [107, 11],
        [106, 11],
      ],
    ],
    [
      [
        [106, 10],
        [107, 11],
        [106, 11],
        [107, 10],
        [106, 10],
      ],
    ],
  ])
    assert.equal(
      areaGeometrySchema.safeParse({ type: "Polygon", coordinates }).success,
      false,
    );
  assert.equal(
    areaInputSchema.safeParse({
      code: "A",
      name: "Area",
      administrativeLevel: "WARD",
      geometry: polygon,
      assignedOfficerIds: [
        "507f1f77bcf86cd799439011",
        "507f1f77bcf86cd799439011",
      ],
    }).success,
    false,
  );
  assert.equal(
    areaGeometrySchema.safeParse({
      type: "MultiPolygon",
      coordinates: [polygon.coordinates],
    }).success,
    true,
  );
  assert.equal(
    areaGeometrySchema.safeParse({ type: "MultiPolygon", coordinates: [] })
      .success,
    false,
  );
  assert.equal(
    areaGeometrySchema.safeParse({ type: "Point", coordinates: [106, 10] })
      .success,
    false,
  );
  assert.equal(
    areaGeometrySchema.safeParse({
      type: "Polygon",
      coordinates: [
        [
          [106, 10],
          [107, 10],
          [107, 91],
          [106, 10],
        ],
      ],
    }).success,
    false,
  );
  const indexes = ServiceArea.schema.indexes();
  assert.ok(indexes.some(([keys]) => keys.geometry === "2dsphere"));
  assert.ok(
    indexes.some(([keys, options]) => keys.code === 1 && options.unique),
  );
});
test("area APIs verify JWT role and internal signatures, not spoofed role headers", async () => {
  process.env.JWT_SECRET = "test-area-secret-not-production";
  process.env.SERVICE_AUTH_SECRET = "test-service-secret-not-production";
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const original = serviceAreaService.matchServiceArea;
  serviceAreaService.matchServiceArea = async () => ({
    area: null,
    overlaps: [],
  });
  try {
    for (const role of ["CITIZEN", "OFFICER"]) {
      const token: string = jwt.sign(
        { userId: "test-user", role },
        process.env.JWT_SECRET!,
      );
      assert.equal(
        (
          await fetch(`${base}/service-areas`, {
            method: "POST",
            headers: {
              authorization: `Bearer ${token}`,
              "x-user-role": "ADMIN",
              "content-type": "application/json",
            },
            body: "{}",
          })
        ).status,
        403,
      );
    }
    assert.equal(
      (
        await fetch(`${base}/service-areas`, {
          headers: { "x-user-id": "fake", "x-user-role": "ADMIN" },
        })
      ).status,
      401,
    );
    const body = { longitude: 106.5, latitude: 10.5 },
      path = "/service-areas/internal/match";
    assert.equal(
      (
        await fetch(base + path, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-user-role": "ADMIN",
          },
          body: JSON.stringify(body),
        })
      ).status,
      401,
    );
    const headers = internalServiceHeaders("alert-service", path, body);
    assert.equal(
      (
        await fetch(base + path, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(base + path, {
          method: "POST",
          headers,
          body: JSON.stringify({ ...body, latitude: 11 }),
        })
      ).status,
      401,
    );
    const admin = jwt.sign(
      { userId: "admin", role: "ADMIN" },
      process.env.JWT_SECRET,
    );
    assert.equal(
      (
        await fetch(`${base}/service-areas/match`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${admin}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        })
      ).status,
      200,
    );
  } finally {
    serviceAreaService.matchServiceArea = original;
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
test(
  "real MongoDB $geoIntersects: inside/outside/boundary/holes/MultiPolygon/inactive/overlap/no-Officer",
  { skip: !process.env.TEST_MONGO_URI },
  async () => {
    const uri = process.env.TEST_MONGO_URI!;
    // This test only writes to a disposable, explicitly named test database.
    if (!/\/ecoalert_assignment_test_[\w-]+(?:\?|$)/.test(uri))
      throw new Error("Refusing a non-test database");
    await mongoose.connect(uri);
    try {
      await ServiceArea.init();
      await ServiceArea.create({
        code: "A",
        name: "A",
        administrativeLevel: "WARD",
        geometry: polygon,
        priority: 0,
      });
      assert.equal(
        (await serviceAreaService.matchServiceArea(106.5, 10.5)).area?.code,
        "A",
      );
      assert.equal(
        (await serviceAreaService.matchServiceArea(108, 10.5)).area,
        null,
      );
      assert.equal(
        (await serviceAreaService.matchServiceArea(106, 10.5)).area?.code,
        "A",
      );
      await assert.rejects(serviceAreaService.matchServiceArea(181, 10));
      await assert.rejects(
        serviceAreaService.matchServiceArea(106, Number.NaN),
      );
      await ServiceArea.create({
        code: "B",
        name: "B",
        administrativeLevel: "CUSTOM",
        geometry: polygon,
        priority: 2,
      });
      const overlap = await serviceAreaService.matchServiceArea(106.5, 10.5);
      assert.equal(overlap.area?.code, "B");
      assert.equal(overlap.overlaps.length, 2);
      await ServiceArea.updateOne({ code: "B" }, { $set: { priority: 0 } });
      assert.equal(
        (await serviceAreaService.matchServiceArea(106.5, 10.5)).area?.code,
        "A",
      );
      await ServiceArea.updateOne({ code: "B" }, { $set: { isActive: false } });
      assert.equal(
        (await serviceAreaService.matchServiceArea(106.5, 10.5)).area?.code,
        "A",
      );
      assert.deepEqual(
        (await serviceAreaService.matchServiceArea(106.5, 10.5)).area
          ?.assignedOfficerIds,
        [],
      );
      const area = await ServiceArea.findOne({ code: "A" });
      assert.ok(area);
      assert.equal(
        (await serviceAreaService.overlaps(String(area._id))).length,
        0,
      );
      await ServiceArea.updateOne(
        { code: "A" },
        {
          $set: {
            geometry: {
              type: "Polygon",
              coordinates: [
                ...polygon.coordinates,
                [
                  [106.2, 10.2],
                  [106.2, 10.8],
                  [106.8, 10.8],
                  [106.8, 10.2],
                  [106.2, 10.2],
                ],
              ],
            },
          },
        },
      );
      assert.equal(
        (await serviceAreaService.matchServiceArea(106.5, 10.5)).area,
        null,
      );
      await ServiceArea.updateOne(
        { code: "A" },
        {
          $set: {
            geometry: {
              type: "MultiPolygon",
              coordinates: [polygon.coordinates],
            },
          },
        },
      );
      assert.equal(
        (await serviceAreaService.matchServiceArea(106.5, 10.5)).area?.code,
        "A",
      );
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
