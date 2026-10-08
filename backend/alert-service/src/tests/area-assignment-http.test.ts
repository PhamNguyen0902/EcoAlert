import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { createRequire } from "module";
import { resolve } from "path";
import type { Server } from "http";
import express from "express";
import mongoose from "mongoose";
import { internalServiceHeaders, AlertStatus, EVENTS } from "@ecoalert/shared";
import { app } from "../app";
import { Alert } from "../models/alert.model";
import { OfficerShift } from "../models/officer-shift.model";
import { officerAssignmentService } from "../services/officer-assignment.service";
import { processAssignmentJobs } from "../services/assignment-worker.service";
import { rabbitMQService } from "../services/rabbitmq.service";
import { envConfig } from "../config/env.config";
const sign = (role: string, userId = "507f1f77bcf86cd799439010") => {
  const base = [
    { alg: "HS256", typ: "JWT" },
    { role, userId, exp: Math.floor(Date.now() / 1000) + 60 },
  ]
    .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
    .join(".");
  return `${base}.${createHmac("sha256", process.env.JWT_SECRET!).update(base).digest("base64url")}`;
};
const listen = async (application: express.Express) => {
  const server = application.listen(0);
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { server, url: `http://127.0.0.1:${address.port}` };
};
const close = (server: Server) =>
  new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
test("alert assignment endpoints reject forged roles and Citizen/Officer JWTs", async () => {
  process.env.JWT_SECRET = "assignment-test-secret-not-production";
  const { server, url } = await listen(app);
  const original = officerAssignmentService.preview;
  officerAssignmentService.preview = async () => ({ reason: "NOT_VERIFIED" });
  try {
    for (const role of ["CITIZEN", "OFFICER"])
      for (const route of [
        "/507f1f77bcf86cd799439011/auto-assign",
        "/507f1f77bcf86cd799439011/assign",
        "/507f1f77bcf86cd799439011/status",
      ]) {
        const response = await fetch(url + route, {
          method: route.endsWith("/status") ? "PATCH" : "POST",
          headers: {
            authorization: `Bearer ${sign(role)}`,
            "x-user-role": "ADMIN",
            "x-user-id": "fake",
            "content-type": "application/json",
          },
          body: "{}",
        });
        assert.equal(response.status, 403);
      }
    assert.equal(
      (
        await fetch(url + "/507f1f77bcf86cd799439011/assignment-preview", {
          headers: { "x-user-role": "ADMIN", "x-user-id": "fake" },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(url + "/507f1f77bcf86cd799439011/assignment-preview", {
          headers: { authorization: `Bearer ${sign("ADMIN")}` },
        })
      ).status,
      200,
    );
  } finally {
    officerAssignmentService.preview = original;
    await close(server);
  }
});

test(
  "real HTTP: GIS/User signed directory + real spatial match + verification worker + scoped Officer tasks/areas",
  { skip: !process.env.TEST_MONGO_URI },
  async () => {
    const uri = process.env.TEST_MONGO_URI!;
    if (!/\/ecoalert_assignment_test_[\w-]+(?:\?|$)/.test(uri))
      throw new Error("Refusing non-test database");
    process.env.JWT_SECRET = "assignment-test-secret-not-production";
    process.env.SERVICE_AUTH_SECRET = "assignment-internal-test-not-production";
    const gisRequire = createRequire(
      resolve(__dirname, "../../../gis-service/dist/app.js"),
    );
    const userRequire = createRequire(
      resolve(__dirname, "../../../user-service/dist/app.js"),
    );
    const gisMongoose = gisRequire("mongoose") as typeof mongoose;
    const userMongoose = userRequire("mongoose") as typeof mongoose;
    const gisApp = (gisRequire("./app") as { app: express.Express }).app;
    // Mount the actual internal router without importing unrelated Redis/auth transport.
    const userApp = express();
    userApp.use(express.json());
    userApp.use(
      "/api/v1/internal",
      (
        userRequire("./routes/officer-directory.routes") as {
          default: express.Router;
        }
      ).default,
    );
    const userModel = (
      userRequire("./models/user.model") as {
        User: mongoose.Model<{
          _id: mongoose.Types.ObjectId;
          email: string;
          fullName: string;
          role: string;
          isActive: boolean;
          isDeleted: boolean;
        }>;
      }
    ).User;
    const original = {
      user: envConfig.userServiceUrl,
      gis: envConfig.gisServiceUrl,
      userEnv: process.env.USER_SERVICE_URL,
      publish: rabbitMQService.publishEvent,
      enabled: envConfig.autoAssignEnabled,
      shift: envConfig.autoAssignRequireActiveShift,
    };
    const servers: Server[] = [];
    const events: string[] = [];
    const disposable = (service: string) =>
      uri.replace(
        /ecoalert_assignment_test_[\w-]+/,
        `ecoalert_assignment_test_http_${service}_${process.pid}`,
      );
    await Promise.all([
      mongoose.connect(disposable("alerts")),
      gisMongoose.connect(disposable("gis")),
      userMongoose.connect(disposable("users")),
    ]);
    try {
      const userServer = await listen(userApp);
      servers.push(userServer.server);
      const gisServer = await listen(gisApp);
      servers.push(gisServer.server);
      const alertServer = await listen(app);
      servers.push(alertServer.server);
      envConfig.userServiceUrl = userServer.url;
      envConfig.gisServiceUrl = gisServer.url;
      process.env.USER_SERVICE_URL = userServer.url;
      envConfig.autoAssignEnabled = true;
      envConfig.autoAssignRequireActiveShift = true;
      rabbitMQService.publishEvent = async (name) => {
        events.push(name);
      };
      await Promise.all([
        userModel.init(),
        Alert.init(),
        OfficerShift.init(),
        (
          gisRequire("./models/service-area.model") as {
            ServiceArea: mongoose.Model<unknown>;
          }
        ).ServiceArea.init(),
      ]);
      const [officer, citizen, inactive] = await userModel.create([
        {
          email: "officer@example.test",
          fullName: "Synthetic Officer",
          role: "OFFICER",
          isActive: true,
          isDeleted: false,
        },
        {
          email: "citizen@example.test",
          fullName: "Synthetic Citizen",
          role: "CITIZEN",
          isActive: true,
          isDeleted: false,
        },
        {
          email: "inactive@example.test",
          fullName: "Inactive Officer",
          role: "OFFICER",
          isActive: false,
          isDeleted: false,
        },
      ]);
      const adminHeaders = {
        authorization: `Bearer ${sign("ADMIN")}`,
        "content-type": "application/json",
      };
      const input = {
        code: "HTTP-TEST",
        name: "Synthetic test ward",
        administrativeLevel: "WARD",
        priority: 0,
        isActive: true,
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [106, 10],
              [107, 10],
              [107, 11],
              [106, 11],
              [106, 10],
            ],
          ],
        },
        assignedOfficerIds: [String(officer._id)],
      };
      for (const invalid of [citizen, inactive]) {
        const r = await fetch(gisServer.url + "/service-areas", {
          method: "POST",
          headers: adminHeaders,
          body: JSON.stringify({
            ...input,
            assignedOfficerIds: [String(invalid._id)],
          }),
        });
        assert.equal(r.status, 400);
      }
      const created = await fetch(gisServer.url + "/service-areas", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify(input),
      });
      assert.equal(created.status, 201);
      const area = ((await created.json()) as { data: { _id: string } }).data;
      assert.equal(
        (
          await fetch(gisServer.url + "/service-areas", {
            method: "POST",
            headers: adminHeaders,
            body: JSON.stringify(input),
          })
        ).status,
        409,
      );
      const directoryPath = "/api/v1/internal/officers/lookup",
        body = { ids: [String(officer._id)] };
      assert.equal(
        (
          await fetch(userServer.url + directoryPath, {
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
      const directory = await fetch(userServer.url + directoryPath, {
        method: "POST",
        headers: internalServiceHeaders("alert-service", directoryPath, body),
        body: JSON.stringify(body),
      });
      assert.equal(directory.status, 200);
      const entries = (
        (await directory.json()) as {
          data: { items: Array<Record<string, unknown>> };
        }
      ).data.items;
      assert.equal(entries[0].password, undefined);
      await OfficerShift.create({
        officerId: String(officer._id),
        status: "ACTIVE",
        startedAt: new Date(),
        startLocation: {
          type: "Point",
          coordinates: [106.5, 10.5],
          accuracyMeters: 10,
        },
      });
      const report = await Alert.create({
        title: "Synthetic HTTP report",
        description: "Disposable fixture, no production report",
        citizenId: String(citizen._id),
        status: AlertStatus.PENDING,
        location: { type: "Point", coordinates: [106.5, 10.5] },
        mediaUrls: ["https://example.test/original.jpg"],
      });
      const verified = await fetch(`${alertServer.url}/${report._id}/status`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ status: "verified" }),
      });
      assert.equal(verified.status, 200);
      await processAssignmentJobs();
      const saved = await Alert.findById(report._id);
      assert.equal(saved?.status, "assigned");
      assert.equal(saved?.assignedOfficerId, String(officer._id));
      assert.equal(saved?.assignedAreaId, area._id);
      assert.equal(
        events.filter((name) => name === EVENTS.OFFICER_ASSIGNED).length,
        1,
      );
      const officerHeaders = {
        authorization: `Bearer ${sign("OFFICER", String(officer._id))}`,
      };
      const tasks = await fetch(alertServer.url + "/officer/tasks", {
        headers: officerHeaders,
      });
      assert.equal(tasks.status, 200);
      assert.equal(
        ((await tasks.json()) as { data: { items: unknown[] } }).data.items
          .length,
        1,
      );
      const mine = await fetch(gisServer.url + "/service-areas/mine", {
        headers: officerHeaders,
      });
      assert.equal(mine.status, 200);
      assert.equal(
        ((await mine.json()) as { data: { items: Array<{ _id: string }> } })
          .data.items[0]._id,
        area._id,
      );
      const other = await fetch(gisServer.url + "/service-areas/mine", {
        headers: {
          authorization: `Bearer ${sign("OFFICER", String(inactive._id))}`,
        },
      });
      assert.equal(
        ((await other.json()) as { data: { items: unknown[] } }).data.items
          .length,
        0,
      );
      const fieldHeaders = {
        ...officerHeaders,
        "content-type": "application/json",
      };
      const start = await fetch(`${alertServer.url}/${report._id}/start`, {
        method: "POST",
        headers: fieldHeaders,
        body: JSON.stringify({}),
      });
      assert.equal(start.status, 200);
      const arrival = await fetch(`${alertServer.url}/${report._id}/arrival`, {
        method: "POST",
        headers: fieldHeaders,
        body: JSON.stringify({
          latitude: 10.5,
          longitude: 106.5,
          accuracyMeters: 10,
        }),
      });
      assert.equal(arrival.status, 200);
      const resolution = await fetch(
        `${alertServer.url}/${report._id}/resolution`,
        {
          method: "POST",
          headers: fieldHeaders,
          body: JSON.stringify({
            resolutionSummary: "Synthetic collection completed",
            treatmentMethod: "Synthetic test method",
            evidence: [
              {
                url: "https://example.test/after.jpg",
                capturedAt: new Date().toISOString(),
                location: {
                  latitude: 10.5,
                  longitude: 106.5,
                  accuracyMeters: 10,
                },
              },
            ],
          }),
        },
      );
      assert.equal(resolution.status, 200);
      const closed = await fetch(`${alertServer.url}/${report._id}/close`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ reviewNote: "Synthetic acceptance" }),
      });
      assert.equal(closed.status, 200);
      assert.equal((await Alert.findById(report._id))?.status, "closed");
      const softDelete = await fetch(
        `${gisServer.url}/service-areas/${area._id}`,
        { method: "DELETE", headers: adminHeaders },
      );
      assert.equal(softDelete.status, 200);
      assert.equal(
        (await Alert.findById(report._id))?.assignedAreaId,
        area._id,
      );
    } finally {
      await Promise.all(servers.map(close));
      rabbitMQService.publishEvent = original.publish;
      envConfig.userServiceUrl = original.user;
      envConfig.gisServiceUrl = original.gis;
      envConfig.autoAssignEnabled = original.enabled;
      envConfig.autoAssignRequireActiveShift = original.shift;
      if (original.userEnv === undefined) delete process.env.USER_SERVICE_URL;
      else process.env.USER_SERVICE_URL = original.userEnv;
      await Promise.all([
        mongoose.connection.dropDatabase(),
        gisMongoose.connection.dropDatabase(),
        userMongoose.connection.dropDatabase(),
      ]);
      await Promise.all([
        mongoose.disconnect(),
        gisMongoose.disconnect(),
        userMongoose.disconnect(),
      ]);
    }
  },
);
