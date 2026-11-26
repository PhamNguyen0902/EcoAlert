import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import express from "express";
import { AlertStatus, AlertCategory } from "@ecoalert/shared";
import { validate } from "../middlewares/validate.middleware";
import { createAlertSchema, updateAlertSchema } from "../dtos/alert.dto";
import router from "../routes";
import { alertService } from "../services/alert.service";
import { alertRepository } from "../repositories/alert.repository";
import { rabbitMQService } from "../services/rabbitmq.service";
import { Alert } from "../models/alert.model";
import { errorHandler } from "../middlewares/error-handler.middleware";

test("alert validate middleware strips Mass Assignment fields on create and update", async () => {
  const createMw = validate(createAlertSchema);
  const reqCreate: any = {
    body: {
      title: "Rác thải tự phát ven đường",
      description: "Đống rác lớn chắn lối đi tại góc đường.",
      category: AlertCategory.ILLEGAL_DUMPING,
      mediaUrls: ["https://bucket.s3.ap-southeast-1.amazonaws.com/ecoalert/a.jpg"],
      location: { type: "Point", coordinates: [106.7, 10.77] },
      status: "verified",
      assignedOfficerId: "507f1f77bcf86cd799439099",
      assignmentEvent: { pending: true },
      autoAssignmentJob: { pending: true },
      citizenId: "forged-citizen",
    },
  };
  await createMw(reqCreate, {} as any, () => {});
  assert.equal("status" in reqCreate.body, false);
  assert.equal("assignedOfficerId" in reqCreate.body, false);
  assert.equal("assignmentEvent" in reqCreate.body, false);
  assert.equal("autoAssignmentJob" in reqCreate.body, false);
  assert.equal("citizenId" in reqCreate.body, false);

  const updateMw = validate(updateAlertSchema);
  const reqUpdate: any = {
    body: {
      title: "Tiêu đề đã cập nhật hợp lệ",
      status: "verified",
      assignedOfficerId: "507f1f77bcf86cd799439099",
      aiVerified: true,
    },
  };
  await updateMw(reqUpdate, {} as any, () => {});
  assert.equal(reqUpdate.body.title, "Tiêu đề đã cập nhật hợp lệ");
  assert.equal("status" in reqUpdate.body, false);
  assert.equal("assignedOfficerId" in reqUpdate.body, false);
  assert.equal("aiVerified" in reqUpdate.body, false);
});

test("category write routes reject CITIZEN and OFFICER with 403", async () => {
  const prevSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-alert-security-secret-32chars";
  const app = express();
  app.use(express.json());
  app.use("/", router);
  app.use(errorHandler);
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });

  const signJwt = (userId: string, role: string): string => {
    const input = [
      { alg: "HS256", typ: "JWT" },
      { userId, role, exp: Math.floor(Date.now() / 1000) + 60 },
    ]
      .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
      .join(".");
    return `${input}.${createHmac("sha256", process.env.JWT_SECRET!).update(input).digest("base64url")}`;
  };

  try {
    const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    for (const role of ["CITIZEN", "OFFICER"]) {
      const token: string = signJwt("507f1f77bcf86cd799439011", role);
      for (const [method, path] of [
        ["POST", "/categories"],
        ["PATCH", "/categories/507f1f77bcf86cd799439011"],
        ["DELETE", "/categories/507f1f77bcf86cd799439011"],
      ] as const) {
        const res: Response = await fetch(`${baseUrl}${path}`, {
          method,
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: method === "DELETE" ? undefined : JSON.stringify({ name: "Test" }),
        });
        assert.equal(res.status, 403);
      }
    }

    const citizenToken: string = signJwt("507f1f77bcf86cd799439011", "CITIZEN");
    const badNearby: Response = await fetch(`${baseUrl}/nearby-check?lat=91&lng=106.7`, {
      headers: { authorization: `Bearer ${citizenToken}` },
    });
    assert.equal(badNearby.status, 400);
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  }
});

test("confirmAlert enforces CITIZEN role, blocks closed/own alerts, and returns minimal non-IDOR payload", async () => {
  const originals = {
    findById: alertRepository.findById,
    findOneAndUpdate: alertRepository.findOneAndUpdate,
    publishEvent: rabbitMQService.publishEvent,
  };
  const doc = new Alert({
    _id: "507f1f77bcf86cd799439020",
    citizenId: "owner-citizen",
    isAnonymous: true,
    status: AlertStatus.PENDING,
    confirmationsCount: 1,
    confirmations: [{ citizenId: "owner-citizen", confirmedAt: new Date() }],
  });

  try {
    alertRepository.findById = async () => doc;
    alertRepository.findOneAndUpdate = async () => {
      doc.confirmationsCount = 2;
      doc.confirmations = doc.confirmations || [];
      doc.confirmations.push({ citizenId: "other-citizen", confirmedAt: new Date() });
      return doc;
    };
    rabbitMQService.publishEvent = async () => {};

    await assert.rejects(
      () => alertService.confirmAlert(doc._id.toString(), { id: "officer-1", role: "OFFICER" }),
      /Không có quyền/,
    );
    await assert.rejects(
      () => alertService.confirmAlert(doc._id.toString(), { id: "owner-citizen", role: "CITIZEN" }),
      /chính mình/,
    );

    const confirmed = await alertService.confirmAlert(doc._id.toString(), {
      id: "other-citizen",
      role: "CITIZEN",
    });
    assert.deepEqual(confirmed, {
      alertId: "507f1f77bcf86cd799439020",
      confirmationsCount: 2,
    });
    assert.equal("citizenId" in confirmed, false);

    doc.status = AlertStatus.CLOSED;
    await assert.rejects(
      () => alertService.confirmAlert(doc._id.toString(), { id: "third-citizen", role: "CITIZEN" }),
      /đã đóng/,
    );
  } finally {
    alertRepository.findById = originals.findById;
    alertRepository.findOneAndUpdate = originals.findOneAndUpdate;
    rabbitMQService.publishEvent = originals.publishEvent;
  }
});
