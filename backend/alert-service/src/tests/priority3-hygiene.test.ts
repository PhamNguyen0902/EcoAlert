import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  AlertCategory,
  AlertStatus,
  createResilientRabbitMQConnector,
  Severity,
} from "@ecoalert/shared";
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

    await alertController.getAlerts(
      {
        headers: { "x-user-id": "cit-1", "x-user-role": "CITIZEN" },
        query: { page: "1", limit: "10", isDeleted: "true" },
      } as any,
      mockRes,
    );
    assert.equal(getLastFilter()?.isDeleted, undefined);
    assert.equal(getLastFilter()?.includeDeleted, undefined);

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

  const tupleMatches = [
    ...seedSource.matchAll(
      /\[\s*\d+\s*,\s*"[^"]+"\s*,\s*"[^"]+"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,/g,
    ),
  ];

  assert.equal(tupleMatches.length, 20);
  for (const [, category, status, severity] of tupleMatches) {
    assert.ok(validCategories.has(category), `Invalid seeded category: ${category}`);
    assert.ok(validStatuses.has(status), `Invalid seeded status: ${status}`);
    assert.ok(validSeverities.has(severity), `Invalid seeded severity: ${severity}`);
  }
});

test("createResilientRabbitMQConnector configures DLQ, handles 406 fallback, and reconnects on close across all 4 services", async () => {
  const sharedPath = path.resolve(__dirname, "../../../shared/src/utils/rabbitmq.util.ts");
  const sharedSrc = fs.readFileSync(sharedPath, "utf8");
  assert.match(sharedSrc, /conn\.on\(\s*['"]error['"]/);
  assert.match(sharedSrc, /conn\.on\(\s*['"]close['"]/);
  assert.match(sharedSrc, /ch\.on\(\s*['"]error['"]/);
  assert.match(sharedSrc, /ch\.on\(\s*['"]close['"]/);
  assert.match(sharedSrc, /x-dead-letter-exchange/);

  const serviceSpecs = [
    { rel: "../../src/services/rabbitmq.service.ts", queue: "alert_service_queue", dlq: "alert_service_dlq" },
    { rel: "../../../ai-service/src/services/rabbitmq.service.ts", queue: "ai_service_queue", dlq: "ai_service_dlq" },
    { rel: "../../../gis-service/src/services/rabbitmq.service.ts", queue: "gis_service_queue", dlq: "gis_service_dlq" },
    { rel: "../../../notification-service/src/services/rabbitmq.service.ts", queue: "notification_service_queue", dlq: "notification_service_dlq" },
  ];

  for (const spec of serviceSpecs) {
    const src = fs.readFileSync(path.resolve(__dirname, spec.rel), "utf8");
    assert.match(src, /createResilientRabbitMQConnector/);
    assert.ok(src.includes(spec.queue));
    assert.ok(src.includes(spec.dlq));
  }

  // Behavioral check: DLQ declaration, 406 fallback, and close -> reconnect
  let connectCount = 0;
  const events: string[] = [];
  let simulate406Once = true;
  let lastConnClose: (() => void) | undefined;

  const makeChannel = () => {
    const handlers: Record<string, () => void> = {};
    return {
      on(ev: "error" | "close", fn: () => void) {
        handlers[ev] = fn;
      },
      async assertExchange(name: string) {
        events.push(`ex:${name}`);
      },
      async assertQueue(name: string, opts?: { arguments?: Record<string, unknown> }) {
        if (name === "q_main" && opts?.arguments && simulate406Once) {
          simulate406Once = false;
          throw Object.assign(new Error("PRECONDITION_FAILED"), { code: 406 });
        }
        events.push(`q:${name}:${Boolean(opts?.arguments)}`);
        return { queue: name };
      },
      async bindQueue(q: string, ex: string, rk: string) {
        events.push(`bind:${q}:${ex}:${rk}`);
      },
    };
  };

  const connector = createResilientRabbitMQConnector({
    connect: async () => {
      connectCount += 1;
      const connHandlers: Record<string, () => void> = {};
      return {
        on(ev: "error" | "close", fn: () => void) {
          connHandlers[ev] = fn;
          if (ev === "close") lastConnClose = fn;
        },
      };
    },
    createChannel: async () => makeChannel(),
    queueName: "q_main",
    dlqName: "q_dlq",
    reconnectDelayMs: 25,
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    onConnected: async (_ch, queue) => {
      events.push(`connected:${queue}`);
    },
  });

  try {
    await connector.connect();
    assert.equal(connectCount, 1);
    assert.ok(events.includes("ex:ecoalert_dlx"));
    assert.ok(events.includes("bind:q_dlq:ecoalert_dlx:q_main"));
    assert.ok(events.includes("q:q_main:false"));
    assert.ok(events.includes("connected:q_main"));
    assert.ok(connector.getChannel());

    lastConnClose?.();
    assert.equal(connector.getChannel(), undefined);
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(connectCount, 2);
  } finally {
    connector.stop();
  }
});
