const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const load = (file, dependencies) => {
  const output = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: output, require: (name) => dependencies[name] });
  return output;
};
const logger = { info() {}, error() {} };
const alertId = "6aba37a5932b5c69f65c360c";
const eventId = "16e52d49-bfd7-422c-8ecb-cbd1eae7677";
test("Citizen notification preserves recipient/event dedup semantics and emits only after save", async () => {
  const calls = [];
  const { NotificationService } = load("services/notification.service.ts", {
    "@ecoalert/shared": { createLogger: () => logger },
    "../repositories/notification.repository": { notificationRepository: {
      createOnce: async (data) => { calls.push(["persist", data]); return { _id: "notice" }; },
      create: async (data) => { calls.push(["create", data]); return { _id: "legacy" }; },
    } },
    "./socket.service": { socketService: { emitToRoom: (...args) => calls.push(["socket", ...args]) } },
  });
  const service = new NotificationService();
  await service.notifyCitizen("citizen", "title", "message", eventId, alertId);
  assert.equal(calls[0][0], "persist");
  assert.equal(calls[0][1].eventId, eventId);
  assert.equal(calls[0][1].alertId, alertId);
  assert.equal(calls[1][1], "user:citizen");
  assert.equal(calls[1][2], "notification:created");
  await service.notifyCitizen("citizen", "legacy", "message");
  assert.equal(calls[2][0], "create");
  assert.equal(calls[2][1].alertId, undefined);
});
test("workflow producer maps entity ID separately from UUID for existing Citizen events", async () => {
  const EVENTS = Object.fromEntries(["ALERT_CREATED", "AI_ANALYZED", "ALERT_UPDATED", "OFFICER_ASSIGNED", "ALERT_STARTED", "ALERT_ARRIVED", "ALERT_RESOLVED", "ALERT_CLOSED"].map((key) => [key, key]));
  const calls = [];
  const { rabbitMQService } = load("services/rabbitmq.service.ts", {
    amqplib: {}, "../config/env.config": { envConfig: {} }, "@ecoalert/shared": { createLogger: () => logger, EVENTS },
    "./socket.service": { socketService: { emitToAll() {}, emitToRoom() {} } },
    "./notification.service": { notificationService: { notifyCitizen: async (...args) => calls.push(args), notifyAdmins: async () => {}, notifyOfficer: async () => {}, notifyOfficers: async () => {} } },
  });
  for (const type of ["ALERT_STARTED", "ALERT_ARRIVED", "ALERT_RESOLVED", "ALERT_CLOSED", "ALERT_UPDATED"]) {
    await rabbitMQService.handleEvent({ eventType: type, eventId, data: { alertId, citizenId: "citizen" } });
  }
  assert.equal(calls.length, 5);
  for (const args of calls) { assert.equal(args[3], eventId); assert.equal(args[4], alertId); }
  await rabbitMQService.handleEvent({ eventType: "ALERT_STARTED", eventId, data: { citizenId: "citizen" } });
  assert.equal(calls.at(-1)[4], undefined);
});
