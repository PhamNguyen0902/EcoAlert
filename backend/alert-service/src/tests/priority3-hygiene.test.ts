import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { AlertCategory, AlertStatus, Severity } from "@ecoalert/shared";
import { alertService } from "../services/alert.service";
import { alertRepository } from "../repositories/alert.repository";
import { alertController } from "../controllers/alert.controller";

test("alertService.getAlerts passes isDeleted=true and includeDeleted=true when queried, and controller restricts it to ADMIN", async () => {
  const origFindPaginated = alertRepository.findPaginated.bind(alertRepository);
  let lastFilter: Record<string, unknown> | null = null;
  const getLastFilter = () => lastFilter as Record<string, unknown> | null;

  alertRepository.findPaginated = (async (filter: Record<string, unknown>) => {
    lastFilter = filter;
    return { items: [], total: 0 };
  }) as any;

  try {
    await alertService.getAlerts(1, 10, undefined, { isDeleted: "true" });
    assert.equal(getLastFilter()?.isDeleted, true);
    assert.equal(getLastFilter()?.includeDeleted, true);

    lastFilter = null;
    const jsonPayloads: unknown[] = [];
    const mockRes = {
      status() {
        return this;
      },
      json(body: unknown) {
        jsonPayloads.push(body);
        return this;
      },
    } as any;

    // Non-admin citizen must have isDeleted stripped
    await alertController.getAlerts(
      {
        headers: { "x-user-id": "cit-1", "x-user-role": "CITIZEN" },
        query: { page: "1", limit: "10", isDeleted: "true" },
      } as any,
      mockRes,
    );
    assert.equal(getLastFilter()?.isDeleted, undefined);
    assert.equal(getLastFilter()?.includeDeleted, undefined);

    // Admin keeps isDeleted=true
    await alertController.getAlerts(
      {
        headers: { "x-user-id": "adm-1", "x-user-role": "ADMIN" },
        query: { page: "1", limit: "10", isDeleted: "true" },
      } as any,
      mockRes,
    );
    assert.equal(getLastFilter()?.isDeleted, true);
    assert.equal(getLastFilter()?.includeDeleted, true);
    assert.equal(jsonPayloads.length, 2);
  } finally {
    alertRepository.findPaginated = origFindPaginated;
  }
});

test("backend/seed.ts uses only valid lowercase AlertCategory, AlertStatus, and Severity enums", () => {
  const seedPath = path.resolve(__dirname, "../../../seed.ts");
  const seedSource = fs.readFileSync(seedPath, "utf8");

  const validCategories = new Set<string>(Object.values(AlertCategory));
  const validStatuses = new Set<string>(Object.values(AlertStatus));
  const validSeverities = new Set<string>(Object.values(Severity));

  const categories = [...seedSource.matchAll(/category:\s*"([^"]+)"/g)].map((m) => m[1]);
  const statuses = [...seedSource.matchAll(/status:\s*"([^"]+)"/g)].map((m) => m[1]);
  const severities = [...seedSource.matchAll(/severity:\s*"([^"]+)"/g)].map((m) => m[1]);

  assert.ok(categories.length >= 20);
  for (const cat of categories) {
    assert.ok(validCategories.has(cat), `Invalid seeded category: ${cat}`);
  }
  for (const status of statuses) {
    assert.ok(validStatuses.has(status), `Invalid seeded status: ${status}`);
  }
  for (const sev of severities) {
    assert.ok(validSeverities.has(sev), `Invalid seeded severity: ${sev}`);
  }
});

test("All 4 RabbitMQ services attach error/close reconnect handlers and declare DLX/DLQ topology", () => {
  const servicePaths = [
    path.resolve(__dirname, "../../src/services/rabbitmq.service.ts"),
    path.resolve(__dirname, "../../../ai-service/src/services/rabbitmq.service.ts"),
    path.resolve(__dirname, "../../../gis-service/src/services/rabbitmq.service.ts"),
    path.resolve(__dirname, "../../../notification-service/src/services/rabbitmq.service.ts"),
  ];

  for (const filePath of servicePaths) {
    const src = fs.readFileSync(filePath, "utf8");
    assert.match(src, /connection\.on\(\s*['"]error['"]/);
    assert.match(src, /connection\.on\(\s*['"]close['"]/);
    assert.match(src, /channel\.on\(\s*['"]error['"]/);
    assert.match(src, /channel\.on\(\s*['"]close['"]/);
    assert.match(src, /ecoalert_dlx/);
    assert.match(src, /x-dead-letter-exchange/);
  }
});
