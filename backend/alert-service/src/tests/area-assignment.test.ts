import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import {
  AlertCategory,
  AlertStatus,
  Severity,
  EVENTS,
  type AreaMatchResult,
} from "@ecoalert/shared";
import { Alert } from "../models/alert.model";
import { OfficerShift } from "../models/officer-shift.model";
import { AssignmentLock } from "../models/assignment-lock.model";
import {
  officerAssignmentService,
  rankAreaOfficers,
} from "../services/officer-assignment.service";
import { alertService } from "../services/alert.service";
import { userDirectoryService } from "../services/user-directory.service";
import { serviceAreaDirectory } from "../services/service-area-directory.service";
import { rabbitMQService } from "../services/rabbitmq.service";
import { assignmentDelivery } from "../services/assignment-delivery.service";
import { processAssignmentJobs } from "../services/assignment-worker.service";
import { withAssignmentLock } from "../services/assignment-lock.service";
import { envConfig } from "../config/env.config";
import type { OfficerAvailability } from "../services/officer-shift.service";
const a = "507f1f77bcf86cd799439011",
  b = "507f1f77bcf86cd799439012",
  outside = "507f1f77bcf86cd799439013";
const admin = {
  id: "test-admin",
  role: "ADMIN",
  correlationId: "assignment-test",
};
const match: AreaMatchResult = {
  area: {
    _id: "507f1f77bcf86cd799439014",
    code: "TEST-WARD",
    name: "Test area",
    administrativeLevel: "WARD",
    priority: 0,
    isActive: true,
    assignedOfficerIds: [a, b],
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
  },
  overlaps: [],
};
const row = (
  id: string,
  count = 0,
  shiftStatus: "ON_SHIFT" | "OFF_SHIFT" = "ON_SHIFT",
): OfficerAvailability => ({
  officer: {
    _id: id,
    fullName: `Test ${id}`,
    email: `${id}@example.test`,
    role: "OFFICER",
    isActive: true,
    isDeleted: false,
  },
  shiftStatus,
  activeTaskCount: count,
  assignedCount: count,
  inProgressCount: 0,
  workloadLevel: "NORMAL",
});
test("candidate selection: geography, account/role, shift, capacity, workload and deterministic history", async (t) => {
  const previous = { ...envConfig };
  envConfig.autoAssignRequireActiveShift = true;
  envConfig.autoAssignMaxActiveTasks = 5;
  try {
    await t.test("no area", () =>
      assert.equal(
        rankAreaOfficers({ area: null, overlaps: [] }, []).reason,
        "AREA_NOT_FOUND",
      ),
    );
    await t.test("area without officers", () =>
      assert.equal(
        rankAreaOfficers(
          { ...match, area: { ...match.area!, assignedOfficerIds: [] } },
          [],
        ).reason,
        "NO_OFFICER_IN_AREA",
      ),
    );
    await t.test("outside-area Officer never selected", () =>
      assert.equal(
        rankAreaOfficers(match, [row(outside)]).reason,
        "NO_ELIGIBLE_OFFICER",
      ),
    );
    await t.test("missing/deleted/inactive/wrong role excluded", () => {
      for (const change of [
        { isActive: false },
        { isDeleted: true },
        { role: "CITIZEN" },
        { role: "ADMIN" },
      ])
        assert.equal(
          rankAreaOfficers(match, [
            { ...row(a), officer: { ...row(a).officer, ...change } },
          ]).reason,
          "NO_ELIGIBLE_OFFICER",
        );
      assert.equal(rankAreaOfficers(match, []).reason, "NO_ELIGIBLE_OFFICER");
    });
    await t.test("off shift excluded", () =>
      assert.equal(
        rankAreaOfficers(match, [row(a, 0, "OFF_SHIFT")]).reason,
        "NO_ACTIVE_SHIFT",
      ),
    );
    await t.test("all full", () =>
      assert.equal(
        rankAreaOfficers(match, [row(a, 5), row(b, 7)]).reason,
        "CAPACITY_REACHED",
      ),
    );
    await t.test("fewest active tasks wins", () =>
      assert.equal(
        rankAreaOfficers(match, [row(a, 4), row(b, 1)]).selectedOfficerId,
        b,
      ),
    );
    await t.test("ON_SHIFT wins over fewer tasks OFF_SHIFT", () =>
      assert.equal(
        rankAreaOfficers(match, [row(a, 3), row(b, 0, "OFF_SHIFT")])
          .selectedOfficerId,
        a,
      ),
    );
    await t.test("tie uses ID for incomplete history", () =>
      assert.equal(
        rankAreaOfficers(match, [row(b, 2), row(a, 2)]).selectedOfficerId,
        a,
      ),
    );
    await t.test("reliable historical assignment timestamp breaks tie", () =>
      assert.equal(
        rankAreaOfficers(match, [
          { ...row(a, 2), lastAssignedAt: new Date("2026-10-01") },
          { ...row(b, 2), lastAssignedAt: new Date("2026-09-01") },
        ]).selectedOfficerId,
        b,
      ),
    );
    await t.test("shift feature flag", () => {
      envConfig.autoAssignRequireActiveShift = false;
      assert.equal(
        rankAreaOfficers(match, [row(a, 0, "OFF_SHIFT")]).selectedOfficerId,
        a,
      );
    });
  } finally {
    Object.assign(envConfig, previous);
  }
});
test(
  "real Mongo assignment CAS/lease/outbox/verification/manual fallback",
  { skip: !process.env.TEST_MONGO_URI },
  async (t) => {
    const uri = process.env.TEST_MONGO_URI!;
    if (!/\/ecoalert_assignment_test_[\w-]+(?:\?|$)/.test(uri))
      throw new Error("Refusing a non-test database");
    const original = {
      match: serviceAreaDirectory.match,
      list: userDirectoryService.listOfficers,
      require: userDirectoryService.requireOfficer,
      publish: rabbitMQService.publishEvent,
      enabled: envConfig.autoAssignEnabled,
      shift: envConfig.autoAssignRequireActiveShift,
      max: envConfig.autoAssignMaxActiveTasks,
    };
    const published: Array<{ name: string; id?: string; data: unknown }> = [];
    const create = (
      status = AlertStatus.VERIFIED,
      assignedOfficerId?: string,
    ) =>
      Alert.create({
        title: "Test assignment report",
        description: "Synthetic test data only",
        citizenId: "test-citizen",
        category: AlertCategory.ILLEGAL_DUMPING,
        severity: Severity.LOW,
        location: { type: "Point", coordinates: [106.5, 10.5] },
        mediaUrls: ["https://example.test/original.jpg"],
        status,
        assignedOfficerId,
        assignedAt: assignedOfficerId ? new Date() : undefined,
      });
    const shift = (officerId: string) =>
      OfficerShift.create({
        officerId,
        status: "ACTIVE",
        startedAt: new Date(),
        startLocation: {
          type: "Point",
          coordinates: [106.5, 10.5],
          accuracyMeters: 10,
        },
      });
    const clear = async () => {
      await Promise.all([
        Alert.deleteMany({}),
        OfficerShift.deleteMany({}),
        AssignmentLock.deleteMany({}),
      ]);
      published.length = 0;
      serviceAreaDirectory.match = async () => match;
      await Promise.all([shift(a), shift(b)]);
    };
    await mongoose.connect(uri);
    try {
      await Promise.all([
        Alert.init(),
        OfficerShift.init(),
        AssignmentLock.init(),
      ]);
      envConfig.autoAssignEnabled = true;
      envConfig.autoAssignRequireActiveShift = true;
      envConfig.autoAssignMaxActiveTasks = 5;
      userDirectoryService.listOfficers = async (_actor, ids) =>
        [row(a).officer, row(b).officer, row(outside).officer].filter(
          (u) => !ids || ids.includes(u._id),
        );
      userDirectoryService.requireOfficer = async (id) => row(id).officer;
      rabbitMQService.publishEvent = async (name, data, _correlation, id) => {
        published.push({ name, data, id });
      };
      await t.test(
        "verification enqueues durable dispatch, worker assigns least-busy officer and keeps audit",
        async () => {
          await clear();
          await create(AlertStatus.ASSIGNED, a);
          const report = await create(AlertStatus.PENDING);
          const verified = await alertService.updateStatus(
            String(report._id),
            admin,
            { status: AlertStatus.VERIFIED },
          );
          assert.equal(verified.status, AlertStatus.VERIFIED);
          assert.equal(verified.autoAssignmentJob?.pending, true);
          await processAssignmentJobs();
          const saved = await Alert.findById(report._id);
          assert.equal(saved?.assignedOfficerId, b);
          assert.equal(saved?.assignmentMethod, "AUTO");
          assert.equal(saved?.assignedAreaCode, "TEST-WARD");
          assert.equal(saved?.assignmentAudit?.activeTaskCountAtSelection, 0);
          assert.equal(
            saved?.assignmentAudit?.triggeredBy,
            "ADMIN_VERIFICATION",
          );
          assert.ok(saved?.assignmentEvent?.deliveredAt);
          assert.equal(
            published.filter((p) => p.name === EVENTS.OFFICER_ASSIGNED).length,
            1,
          );
        },
      );
      await t.test(
        "pending/AI/rejected cannot auto assign; reject creates no dispatch job",
        async () => {
          await clear();
          for (const status of [
            AlertStatus.PENDING,
            AlertStatus.AI_ANALYZING,
            AlertStatus.REJECTED,
          ]) {
            const r = await create(status);
            assert.equal(
              (
                await officerAssignmentService.autoAssignOfficer(
                  String(r._id),
                  admin,
                )
              ).reason,
              "NOT_VERIFIED",
            );
          }
          const r = await create(AlertStatus.PENDING);
          const rejected = await alertService.updateStatus(
            String(r._id),
            admin,
            { status: AlertStatus.REJECTED },
          );
          assert.equal(rejected.autoAssignmentJob, undefined);
        },
      );
      await t.test(
        "GIS unavailable leaves VERIFIED and visible failure reason; verification still succeeds without broker",
        async () => {
          await clear();
          serviceAreaDirectory.match = async () => {
            throw new Error("GIS offline");
          };
          rabbitMQService.publishEvent = async () => {
            throw new Error("Broker offline");
          };
          const r = await create(AlertStatus.PENDING);
          await alertService.updateStatus(String(r._id), admin, {
            status: AlertStatus.VERIFIED,
          });
          const result = await officerAssignmentService.autoAssignOfficer(
            String(r._id),
            admin,
          );
          assert.equal(result.reason, "DEPENDENCY_UNAVAILABLE");
          const saved = await Alert.findById(r._id);
          assert.equal(saved?.status, AlertStatus.VERIFIED);
          assert.equal(
            saved?.lastAssignmentAttempt?.reason,
            "DEPENDENCY_UNAVAILABLE",
          );
          rabbitMQService.publishEvent = original.publish;
          rabbitMQService.publishEvent = async (
            name,
            data,
            _correlation,
            id,
          ) => {
            published.push({ name, data, id });
          };
        },
      );
      await t.test(
        "simultaneous manual+auto+auto: exactly one assignment and one assignment event",
        async () => {
          await clear();
          const r = await create();
          await Promise.allSettled([
            officerAssignmentService.autoAssignOfficer(String(r._id), admin),
            officerAssignmentService.autoAssignOfficer(String(r._id), admin),
            alertService.assignOfficer(String(r._id), admin, { officerId: a }),
          ]);
          const saved = await Alert.findById(r._id);
          assert.equal(saved?.status, AlertStatus.ASSIGNED);
          assert.equal(
            saved?.timeline.filter((e) => e.eventType === "OFFICER_ASSIGNED")
              .length,
            1,
          );
          assert.equal(
            published.filter((e) => e.name === EVENTS.OFFICER_ASSIGNED).length,
            1,
          );
          const assigned = saved?.assignedOfficerId;
          assert.equal(
            (
              await officerAssignmentService.autoAssignOfficer(
                String(r._id),
                admin,
              )
            ).reason,
            "ALREADY_ASSIGNED",
          );
          assert.equal(
            (await Alert.findById(r._id))?.assignedOfficerId,
            assigned,
          );
          assert.equal(
            published.filter((e) => e.name === EVENTS.OFFICER_ASSIGNED).length,
            1,
          );
        },
      );
      await t.test(
        "different reports cannot silently exceed capacity under concurrent dispatch",
        async () => {
          await clear();
          await OfficerShift.updateMany(
            { officerId: b },
            { $set: { status: "COMPLETED" } },
          );
          await Promise.all(
            Array.from({ length: 4 }, () => create(AlertStatus.ASSIGNED, a)),
          );
          const [r1, r2] = await Promise.all([create(), create()]);
          await Promise.all([
            officerAssignmentService.autoAssignOfficer(String(r1._id), admin),
            officerAssignmentService.autoAssignOfficer(String(r2._id), admin),
          ]);
          for (const r of [r1, r2])
            await officerAssignmentService.autoAssignOfficer(
              String(r._id),
              admin,
            );
          assert.equal(
            await Alert.countDocuments({
              assignedOfficerId: a,
              status: AlertStatus.ASSIGNED,
            }),
            5,
          );
          assert.equal(
            await Alert.countDocuments({ status: AlertStatus.VERIFIED }),
            1,
          );
        },
      );
      await t.test(
        "no active shift keeps VERIFIED and manual outside-area override requires reason",
        async () => {
          await clear();
          await OfficerShift.updateMany({}, { $set: { status: "COMPLETED" } });
          const r = await create();
          assert.equal(
            (
              await officerAssignmentService.autoAssignOfficer(
                String(r._id),
                admin,
              )
            ).reason,
            "NO_ACTIVE_SHIFT",
          );
          await assert.rejects(
            alertService.assignOfficer(String(r._id), admin, {
              officerId: outside,
            }),
          );
          const assigned = await alertService.assignOfficer(
            String(r._id),
            admin,
            {
              officerId: outside,
              overrideConfirmed: true,
              assignmentReason: "Hỗ trợ liên khu vực theo điều phối Admin",
            },
          );
          assert.equal(assigned.assignmentMethod, "MANUAL");
          assert.equal(assigned.assignmentAudit?.outsideAreaOverride, true);
        },
      );
      await t.test(
        "publication failure preserves assignment, stable event retries without another assignment",
        async () => {
          await clear();
          const r = await create();
          const attemptedIds: string[] = [];
          rabbitMQService.publishEvent = async (
            _name,
            _data,
            _correlation,
            id,
          ) => {
            attemptedIds.push(id!);
            throw new Error("Broker offline");
          };
          const result = await officerAssignmentService.autoAssignOfficer(
            String(r._id),
            admin,
          );
          assert.equal(result.assigned, true);
          let saved = await Alert.findById(r._id);
          assert.equal(saved?.status, AlertStatus.ASSIGNED);
          assert.equal(saved?.assignmentEvent?.deliveredAt, undefined);
          assert.equal(saved?.assignmentEvent?.attempts, 1);
          rabbitMQService.publishEvent = async (
            name,
            data,
            _correlation,
            id,
          ) => {
            published.push({ name, id, data });
          };
          await Alert.updateOne(
            { _id: r._id },
            { $set: { "assignmentEvent.nextAttemptAt": new Date(0) } },
          );
          await assignmentDelivery.deliver(String(r._id));
          saved = await Alert.findById(r._id);
          assert.ok(saved?.assignmentEvent?.deliveredAt);
          assert.equal(
            published.find((p) => p.name === EVENTS.OFFICER_ASSIGNED)?.id,
            attemptedIds[0],
          );
          assert.equal(
            saved?.timeline.filter((e) => e.eventType === "OFFICER_ASSIGNED")
              .length,
            1,
          );
        },
      );
      await t.test(
        "manual fallback remains possible with unavailable GIS after explicit acknowledgement",
        async () => {
          await clear();
          serviceAreaDirectory.match = async () => {
            throw new Error("GIS offline");
          };
          const r = await create();
          await assert.rejects(
            alertService.assignOfficer(String(r._id), admin, { officerId: a }),
          );
          const assigned = await alertService.assignOfficer(
            String(r._id),
            admin,
            {
              officerId: a,
              overrideConfirmed: true,
              assignmentReason:
                "GIS gián đoạn; Admin đã xác nhận cán bộ phụ trách",
            },
          );
          assert.equal(assigned.status, AlertStatus.ASSIGNED);
          assert.equal(assigned.assignedAreaId, undefined);
        },
      );
      await t.test(
        "completed tasks do not count toward capacity; historical timestamp remains available",
        async () => {
          await clear();
          await Promise.all(
            Array.from({ length: 8 }, () => create(AlertStatus.CLOSED, a)),
          );
          const r = await create();
          const preview = await officerAssignmentService.preview(
            String(r._id),
            admin,
          );
          assert.equal(
            preview.candidates?.find((c) => c.officer._id === a)
              ?.activeTaskCount,
            0,
          );
          assert.ok(
            preview.candidates?.find((c) => c.officer._id === a)
              ?.lastAssignedAt,
          );
        },
      );
      await t.test(
        "no area or empty roster retains VERIFIED with failure audit and no assignment event",
        async () => {
        const cases: Array<[AreaMatchResult, string]> = [
            [{ area: null, overlaps: [] }, "AREA_NOT_FOUND"],
            [
              { ...match, area: { ...match.area!, assignedOfficerIds: [] } },
              "NO_OFFICER_IN_AREA",
            ],
        ];
        for (const [result, reason] of cases) {
            await clear();
          serviceAreaDirectory.match = async () => result;
            const report = await create();
            const response = await officerAssignmentService.autoAssignOfficer(
              String(report._id),
              admin,
            );
            assert.equal(response.reason, reason);
            const saved = await Alert.findById(report._id);
            assert.equal(saved?.status, AlertStatus.VERIFIED);
            assert.equal(saved?.lastAssignmentAttempt?.reason, reason);
            assert.equal(saved?.assignedOfficerId, undefined);
            assert.equal(saved?.assignmentEvent, undefined);
            assert.equal(published.length, 0);
          }
        },
      );
      await t.test(
        "disabled flag preserves manual dispatch and creates no verification dispatch job",
        async () => {
          await clear();
          envConfig.autoAssignEnabled = false;
          try {
            const report = await create(AlertStatus.PENDING);
            const verified = await alertService.updateStatus(
              String(report._id),
              admin,
              { status: AlertStatus.VERIFIED },
            );
            assert.equal(verified.autoAssignmentJob, undefined);
            assert.equal(
              (
                await officerAssignmentService.autoAssignOfficer(
                  String(report._id),
                  admin,
                )
              ).reason,
              "DISABLED",
            );
            assert.equal(
              (
                await alertService.assignOfficer(String(report._id), admin, {
                  officerId: a,
                })
              ).assignmentMethod,
              "MANUAL",
            );
          } finally {
            envConfig.autoAssignEnabled = true;
          }
        },
      );
      await t.test(
        "expired dispatch lease recovers and changed report coordinates reject stale assignment CAS",
        async () => {
          await clear();
          await AssignmentLock.create({
            _id: "officer-dispatch",
            owner: "crashed-process",
            expiresAt: new Date(0),
          });
          await withAssignmentLock(async (assertOwned) => {
            await assertOwned();
          });
          const report = await create();
          await Alert.updateOne(
            { _id: report._id },
            { $set: { "location.coordinates": [106.6, 10.6] } },
          );
          await assert.rejects(
            alertService.commitOfficerAssignment(
              String(report._id),
              admin,
              row(a).officer,
              {
                method: "AUTO",
                reason: "Stale test selection",
                triggeredBy: "TEST",
                expectedCoordinates: [106.5, 10.5],
              },
            ),
          );
          const saved = await Alert.findById(report._id);
          assert.equal(saved?.status, AlertStatus.VERIFIED);
          assert.equal(saved?.assignmentEvent, undefined);
          assert.equal(published.length, 0);
        },
      );
    } finally {
      serviceAreaDirectory.match = original.match;
      userDirectoryService.listOfficers = original.list;
      userDirectoryService.requireOfficer = original.require;
      rabbitMQService.publishEvent = original.publish;
      envConfig.autoAssignEnabled = original.enabled;
      envConfig.autoAssignRequireActiveShift = original.shift;
      envConfig.autoAssignMaxActiveTasks = original.max;
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
