import test from "node:test";
import assert from "node:assert/strict";
import { AlertStatus } from "@ecoalert/shared";
import { Alert, IResolutionEvidence } from "../models/alert.model";
import { alertRepository } from "../repositories/alert.repository";
import { alertService } from "../services/alert.service";
import { rabbitMQService } from "../services/rabbitmq.service";
import { resolveAlertSchema, ResolveAlertDto } from "../dtos/alert.dto";
import { envConfig } from "../config/env.config";

const id = "507f1f77bcf86cd799439011";
const actor = { id: "officer-a", role: "OFFICER" };
const latitude = 10.7769,
  longitude = 106.7009;
const capturedAt = "2026-10-05T08:09:10.000Z";
const valid: ResolveAlertDto = {
  resolutionSummary: " Đã thu gom rác ",
  treatmentMethod: " Thu gom và vận chuyển rác ",
  materialsUsed: " Xe gom rác ",
  additionalNotes: " Đã vệ sinh ",
  evidence: [
    {
      url: "https://example.test/after.jpg",
      capturedAt,
      location: {
        latitude: latitude + 30 / 111195,
        longitude,
        accuracyMeters: 8,
      },
    },
  ],
};

test("resolution DTO accepts optional capture metadata and rejects invalid timestamp", () => {
  assert.equal(resolveAlertSchema.safeParse(valid).success, true);
  assert.equal(
    resolveAlertSchema.safeParse({
      ...valid,
      evidence: [{ url: valid.evidence[0].url }],
    }).success,
    true,
  );
  assert.equal(
    resolveAlertSchema.safeParse({
      ...valid,
      evidence: [{ ...valid.evidence[0], capturedAt: "bad" }],
    }).success,
    false,
  );
  assert.equal(
    resolveAlertSchema.safeParse({ ...valid, evidence: [] }).success,
    false,
  );
});
test("resolution requires verified own arrival and field evidence; stores real metadata", async (t) => {
  const originals = {
    find: alertRepository.findById,
    update: alertRepository.findOneAndUpdate,
    publish: rabbitMQService.publishEvent,
  };
  let task = new Alert({
    _id: id,
    status: AlertStatus.IN_PROGRESS,
    assignedOfficerId: actor.id,
    location: { type: "Point", coordinates: [longitude, latitude] },
  });
  let writes = 0,
    events = 0;
  let saved: IResolutionEvidence[] | undefined;
  try {
    alertRepository.findById = async () => task;
    alertRepository.findOneAndUpdate = async (filter, update) => {
      writes++;
      assert.equal(filter.assignedOfficerId, actor.id);
      assert.equal(filter["checkIn.verified"], true);
      assert.equal(filter["checkIn.officerId"], actor.id);
      assert.equal(update.$set?.status, AlertStatus.RESOLVED);
      assert.equal(
        update.$set?.resolutionSummary,
        valid.resolutionSummary.trim(),
      );
      assert.equal(update.$set?.materialsUsed, "Xe gom rác");
      assert.equal(update.$set?.resolutionNotes, "Đã vệ sinh");
      saved = update.$set?.resolutionEvidence as IResolutionEvidence[];
      task.status = AlertStatus.RESOLVED;
      task.resolvedAt = update.$set?.resolvedAt as Date;
      task.resolutionEvidence = saved;
      return task;
    };
    rabbitMQService.publishEvent = async () => {
      events++;
    };
    await t.test("without verified check-in fails", async () => {
      await assert.rejects(
        alertService.resolveIncident(id, actor, valid),
        /xác nhận đã đến/,
      );
      assert.equal(writes, 0);
    });
    task.checkIn = {
      officerId: actor.id,
      location: { type: "Point", coordinates: [longitude, latitude] },
      accuracyMeters: 8,
      distanceFromIncidentMeters: 0,
      checkedInAt: new Date(),
      verified: true,
    };
    await t.test("another officer cannot resolve", async () => {
      await assert.rejects(
        alertService.resolveIncident(
          id,
          { id: "officer-b", role: "OFFICER" },
          valid,
        ),
        /phân công/,
      );
      assert.equal(writes, 0);
    });
    await t.test("empty evidence, summary, method rejected", async () => {
      for (const payload of [
        { ...valid, evidence: [] },
        { ...valid, resolutionSummary: "" },
        { ...valid, treatmentMethod: "" },
      ])
        await assert.rejects(alertService.resolveIncident(id, actor, payload));
      assert.equal(writes, 0);
    });
    await t.test(
      "evidence without GPS rejected instead of inventing coordinates",
      async () => {
        await assert.rejects(
          alertService.resolveIncident(id, actor, {
            ...valid,
            evidence: [{ url: valid.evidence[0].url }],
          }),
          /cần GPS/,
        );
        assert.equal(writes, 0);
      },
    );
    await t.test("distant or inaccurate evidence rejected", async () => {
      await assert.rejects(
        alertService.resolveIncident(id, actor, {
          ...valid,
          evidence: [
            {
              ...valid.evidence[0],
              location: {
                latitude:
                  latitude +
                  (envConfig.officerEvidenceRadiusMeters + 200) / 111195,
                longitude,
                accuracyMeters: 8,
              },
            },
          ],
        }),
        /cách vị trí/,
      );
      await assert.rejects(
        alertService.resolveIncident(id, actor, {
          ...valid,
          evidence: [
            {
              ...valid.evidence[0],
              location: {
                latitude,
                longitude,
                accuracyMeters: envConfig.officerCheckinMaxAccuracyMeters + 1,
              },
            },
          ],
        }),
        /chính xác GPS/,
      );
      assert.equal(writes, 0);
      assert.equal(events, 0);
    });
    await t.test(
      "valid resolution preserves capture time and server-computed distance",
      async () => {
        await alertService.resolveIncident(id, actor, valid);
        assert.ok(saved);
        assert.equal(saved[0].capturedAt?.toISOString(), capturedAt);
        assert.ok(saved[0].uploadedAt instanceof Date);
        assert.notEqual(saved[0].uploadedAt.toISOString(), capturedAt);
        assert.ok(
          saved[0].distanceFromIncidentMeters! > 29 &&
            saved[0].distanceFromIncidentMeters! < 31,
        );
        assert.deepEqual(saved[0].location?.coordinates, [
          longitude,
          valid.evidence[0].location!.latitude,
        ]);
        assert.equal(saved[0].accuracyMeters, 8);
        assert.equal(saved[0].type, "AFTER_TREATMENT");
        assert.equal(task.status, AlertStatus.RESOLVED);
        assert.equal(events, 2);
      },
    );
    await t.test("RESOLVED cannot resolve twice", async () => {
      await assert.rejects(
        alertService.resolveIncident(id, actor, valid),
        /đang xử lý/,
      );
      assert.equal(writes, 1);
    });
  } finally {
    alertRepository.findById = originals.find;
    alertRepository.findOneAndUpdate = originals.update;
    rabbitMQService.publishEvent = originals.publish;
  }
});
