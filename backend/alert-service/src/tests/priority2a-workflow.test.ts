import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  AlertCategory,
  AlertStatus,
  EVENTS,
  IAiAnalysisCompletedData,
  Severity,
} from "@ecoalert/shared";
import { app } from "../app";
import { alertRepository } from "../repositories/alert.repository";
import { alertService, WorkflowActor } from "../services/alert.service";
import { rabbitMQService } from "../services/rabbitmq.service";

const id = "507f1f77bcf86cd799439011";
const admin: WorkflowActor = { id: "admin-1", role: "ADMIN" };
const officer: WorkflowActor = { id: "officer-1", role: "OFFICER" };

const signJwt = (userId: string, role: string, secret: string): string => {
  const input = [
    { alg: "HS256", typ: "JWT" },
    { userId, role, exp: Math.floor(Date.now() / 1000) + 60 },
  ]
    .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
    .join(".");
  return `${input}.${createHmac("sha256", secret).update(input).digest("base64url")}`;
};

test("updateStatus emits one merged ALERT_UPDATED event without duplicate publish", async () => {
  const repository = alertRepository as any;
  const rabbit = rabbitMQService as any;
  const oldFind = repository.findById;
  const oldUpdate = repository.findOneAndUpdate;
  const oldPublish = rabbit.publishEvent;
  const published: Array<{ name: string; data: any }> = [];
  try {
    const existing = {
      _id: { toString: () => id },
      title: "Bãi rác tự phát",
      citizenId: "citizen-1",
      status: AlertStatus.PENDING,
      category: AlertCategory.ILLEGAL_DUMPING,
      location: { type: "Point", coordinates: [106.7, 10.77] },
      toObject: () => ({
        _id: id,
        title: "Bãi rác tự phát",
        citizenId: "citizen-1",
        status: AlertStatus.VERIFIED,
        category: AlertCategory.ILLEGAL_DUMPING,
        location: { type: "Point", coordinates: [106.7, 10.77] },
      }),
    };
    repository.findById = async () => existing;
    repository.findOneAndUpdate = async () => ({
      ...existing,
      status: AlertStatus.VERIFIED,
    });
    rabbit.publishEvent = async (name: string, data: any) => {
      published.push({ name, data });
    };

    await alertService.updateStatus(id, admin, {
      status: AlertStatus.VERIFIED,
    });
    assert.equal(published.length, 1);
    assert.equal(published[0].name, EVENTS.ALERT_UPDATED);
    assert.equal(published[0].data.previousStatus, AlertStatus.PENDING);
    assert.equal(published[0].data.category, AlertCategory.ILLEGAL_DUMPING);
    assert.deepEqual(published[0].data.location.coordinates, [106.7, 10.77]);
  } finally {
    repository.findById = oldFind;
    repository.findOneAndUpdate = oldUpdate;
    rabbit.publishEvent = oldPublish;
  }
});

test("getAlerts escapes title regex and builds multi-status / safe enum filters", async () => {
  const repository = alertRepository as any;
  const oldFindPaginated = repository.findPaginated;
  let capturedFilter: Record<string, any> | undefined;
  try {
    repository.findPaginated = async (filter: Record<string, any>) => {
      capturedFilter = filter;
      return { items: [], total: 0 };
    };
    await alertService.getAlerts(1, 20, undefined, {
      title: "rác (ven+đường) [Q1]",
      status: "pending,ai_analyzing",
      category: "illegal_dumping",
      severity: "high",
    });
    assert.ok(capturedFilter?.title instanceof RegExp);
    assert.equal(capturedFilter?.title.test("Điểm Rác (Ven+Đường) [Q1] mới"), true);
    assert.equal(Array.isArray(capturedFilter?.status?.$in), true);
    assert.equal(capturedFilter?.status?.$in.length, 2);
    assert.equal(capturedFilter?.status?.$in[0].test("pending"), true);
    assert.equal(capturedFilter?.status?.$in[1].test("AI_ANALYZING"), true);

    await alertService.getAlerts(1, 20, undefined, {
      status: "(a+)+",
    });
    assert.deepEqual(capturedFilter?.status, { $in: [] });
  } finally {
    repository.findPaginated = oldFindPaginated;
  }
});

test("startHandling records startedBy and confirmArrival records arrivedBy, arrivalLocation, and blocks duplicate check-in", async () => {
  const repository = alertRepository as any;
  const rabbit = rabbitMQService as any;
  const oldFind = repository.findById;
  const oldUpdate = repository.findOneAndUpdate;
  const oldPublish = rabbit.publishEvent;
  try {
    rabbit.publishEvent = async () => undefined;
    let startSet: Record<string, any> | undefined;
    repository.findById = async () => ({
      _id: { toString: () => id },
      title: "Sự cố",
      citizenId: "citizen-1",
      status: AlertStatus.ASSIGNED,
      assignedOfficerId: officer.id,
      location: { type: "Point", coordinates: [106.7009, 10.7769] },
      toObject: () => ({ status: AlertStatus.IN_PROGRESS }),
    });
    repository.findOneAndUpdate = async (_filter: any, update: any) => {
      startSet = update.$set;
      return {
        _id: { toString: () => id },
        title: "Sự cố",
        citizenId: "citizen-1",
        assignedOfficerId: officer.id,
        status: AlertStatus.IN_PROGRESS,
        toObject: () => ({ status: AlertStatus.IN_PROGRESS }),
      };
    };
    await alertService.startHandling(id, officer);
    assert.equal(startSet?.startedBy, officer.id);

    let arrivalFilter: Record<string, any> | undefined;
    let arrivalSet: Record<string, any> | undefined;
    repository.findById = async () => ({
      _id: { toString: () => id },
      title: "Sự cố",
      citizenId: "citizen-1",
      status: AlertStatus.IN_PROGRESS,
      assignedOfficerId: officer.id,
      location: { type: "Point", coordinates: [106.7009, 10.7769] },
      toObject: () => ({ status: AlertStatus.IN_PROGRESS }),
    });
    repository.findOneAndUpdate = async (filter: any, update: any) => {
      arrivalFilter = filter;
      arrivalSet = update.$set;
      return {
        _id: { toString: () => id },
        title: "Sự cố",
        citizenId: "citizen-1",
        assignedOfficerId: officer.id,
        status: AlertStatus.IN_PROGRESS,
        toObject: () => ({ status: AlertStatus.IN_PROGRESS }),
      };
    };
    await alertService.confirmArrival(id, officer, {
      latitude: 10.7769,
      longitude: 106.7009,
      accuracyMeters: 12,
    });
    assert.deepEqual(arrivalFilter?.["checkIn.verified"], { $ne: true });
    assert.equal(arrivalSet?.arrivedBy, officer.id);
    assert.deepEqual(arrivalSet?.arrivalLocation, {
      latitude: 10.7769,
      longitude: 106.7009,
      accuracy: 12,
    });

    repository.findById = async () => ({
      _id: { toString: () => id },
      status: AlertStatus.IN_PROGRESS,
      assignedOfficerId: officer.id,
      checkIn: { verified: true },
      location: { type: "Point", coordinates: [106.7009, 10.7769] },
    });
    await assert.rejects(
      alertService.confirmArrival(id, officer, {
        latitude: 10.7769,
        longitude: 106.7009,
        accuracyMeters: 12,
      }),
      /Đã xác nhận đến hiện trường/,
    );
  } finally {
    repository.findById = oldFind;
    repository.findOneAndUpdate = oldUpdate;
    rabbit.publishEvent = oldPublish;
  }
});

test("reviewClassification rejects UNCLASSIFIED and stores ADMIN metadata; internalUpdateAiResult preserves human decision", async () => {
  const repository = alertRepository as any;
  const rabbit = rabbitMQService as any;
  const oldFind = repository.findById;
  const oldUpdate = repository.findOneAndUpdate;
  const oldPublish = rabbit.publishEvent;
  try {
    rabbit.publishEvent = async () => undefined;
    repository.findById = async () => ({
      _id: { toString: () => id },
      title: "Sự cố",
      citizenId: "citizen-1",
      status: AlertStatus.PENDING,
      category: "UNCLASSIFIED",
      classification: { status: "UNCLASSIFIED" },
    });
    await assert.rejects(
      alertService.reviewClassification(id, admin, {}),
      /danh mục hợp lệ/,
    );

    let reviewSet: Record<string, any> | undefined;
    repository.findOneAndUpdate = async (_filter: any, update: any) => {
      reviewSet = update.$set;
      return {
        _id: { toString: () => id },
        title: "Sự cố",
        citizenId: "citizen-1",
        status: AlertStatus.PENDING,
        category: AlertCategory.WATER_POLLUTION,
        toObject: () => ({ category: AlertCategory.WATER_POLLUTION }),
      };
    };
    await alertService.reviewClassification(id, admin, {
      category: AlertCategory.WATER_POLLUTION,
    });
    assert.equal(reviewSet?.["classification.status"], "ADMIN_CORRECTED");
    assert.equal(
      reviewSet?.["classification.finalCategory"],
      AlertCategory.WATER_POLLUTION,
    );
    assert.equal(reviewSet?.["classification.finalCategorySource"], "ADMIN");
    assert.equal(reviewSet?.["classification.confirmedBy"], admin.id);
    assert.ok(reviewSet?.["classification.confirmedAt"] instanceof Date);

    let aiFilter: Record<string, any> | undefined;
    let aiSet: Record<string, any> | undefined;
    repository.findById = async () => ({
      _id: id,
      status: AlertStatus.VERIFIED,
      category: AlertCategory.FLOODING,
      classification: {
        status: "ADMIN_CORRECTED",
        finalCategory: AlertCategory.FLOODING,
        finalCategorySource: "ADMIN",
      },
    });
    repository.findOneAndUpdate = async (filter: any, update: any) => {
      aiFilter = filter;
      aiSet = update.$set;
      return { _id: id };
    };
    const aiPayload: IAiAnalysisCompletedData = {
      alertId: id,
      analysisId: "analysis-2",
      category: AlertCategory.ILLEGAL_DUMPING,
      severity: Severity.MEDIUM,
      confidence: 0.77,
      displayConfidenceSource: "CATEGORY",
      summary: "AI gợi ý",
      reasoningSummary: "Lý do AI",
      analysisMode: "IMAGE_AND_TEXT",
      provider: "openrouter",
      model: "openai/gpt-4o-mini",
      pipelineVersion: "openrouter-multimodal-v1",
    };
    await alertService.internalUpdateAiResult(id, aiPayload);
    assert.deepEqual(aiFilter?.aiAnalysisId, { $ne: "analysis-2" });
    assert.equal(aiSet?.aiConfidenceSource, "CATEGORY");
    assert.equal(aiSet?.category, AlertCategory.FLOODING);
    assert.equal(aiSet?.["classification.status"], undefined);
    assert.equal(
      aiSet?.["classification.aiSuggestedCategory"],
      AlertCategory.ILLEGAL_DUMPING,
    );
  } finally {
    repository.findById = oldFind;
    repository.findOneAndUpdate = oldUpdate;
    rabbit.publishEvent = oldPublish;
  }
});

test("GET /officer/tasks returns standardized PaginatedResult and 403 for non-OFFICER JWT", async () => {
  const prevSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-officer-tasks-secret-32chars";
  const repository = alertRepository as any;
  const oldFindPaginated = repository.findPaginated;
  repository.findPaginated = async () => ({
    items: [{ _id: id, title: "Task 1" }],
    total: 1,
  });

  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const officerToken = signJwt("officer-1", "OFFICER", process.env.JWT_SECRET);
    const citizenToken = signJwt("citizen-1", "CITIZEN", process.env.JWT_SECRET);

    const okRes = await fetch(`${baseUrl}/officer/tasks?page=1&limit=10`, {
      headers: { authorization: `Bearer ${officerToken}` },
    });
    assert.equal(okRes.status, 200);
    const okJson = (await okRes.json()) as any;
    assert.equal(okJson.data.total, 1);
    assert.equal(okJson.data.page, 1);
    assert.equal(okJson.data.limit, 10);
    assert.equal(okJson.data.totalPages, 1);
    assert.equal(okJson.data.items.length, 1);

    const forbiddenRes = await fetch(`${baseUrl}/officer/tasks`, {
      headers: { authorization: `Bearer ${citizenToken}` },
    });
    assert.equal(forbiddenRes.status, 403);
  } finally {
    repository.findPaginated = oldFindPaginated;
    server.closeAllConnections?.();
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  }
});
