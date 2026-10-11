require("ts-node/register");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  contentCatalog,
  contentForType,
  buildNotificationContent,
  formatNotificationContent,
  safeAlertTitle,
  statusLabels,
} = require("../src/utils/notification-content");
const { notificationService } = require("../src/services/notification.service");
const {
  notificationRepository,
} = require("../src/repositories/notification.repository");
const { socketService } = require("../src/services/socket.service");
const { rabbitMQService } = require("../src/services/rabbitmq.service");
const { EVENTS } = require("@ecoalert/shared");
const alertId = "6aba37a5932b5c69f65c360c";
const eventId = "16e52d49-bfd7-422c-8ecb-cbd1eae7677";

test("all workflow templates are Vietnamese, IDs and technical enums are never interpolated", () => {
  const types = [
    EVENTS.ALERT_CREATED,
    EVENTS.AI_ANALYZED,
    EVENTS.OFFICER_ASSIGNED,
    EVENTS.ALERT_STARTED,
    EVENTS.ALERT_ARRIVED,
    EVENTS.ALERT_RESOLVED,
    EVENTS.ALERT_CLOSED,
  ];
  for (const eventType of types)
    for (const recipientRole of ["CITIZEN", "OFFICER", "ADMIN"]) {
      const content = buildNotificationContent({
        eventType,
        recipientRole,
        alertTitle: `${alertId} ${eventId} UNCLASSIFIED`,
      });
      if (content) {
        assert.match(content.title, /[à-ỹ]/);
        assert.doesNotMatch(
          content.title + content.message,
          /[a-f\d]{24}|[A-Z]+_[A-Z]+|16e52d49/,
        );
      }
    }
  assert.match(contentForType("RESOLVED").message, /chờ quản trị viên/);
  assert.match(contentForType("CLOSED").message, /đã được xác nhận/);
  assert.equal(Object.keys(statusLabels).length, 8);
  assert.equal(
    buildNotificationContent({
      eventType: "unknown",
      recipientRole: "CITIZEN",
    }),
    null,
  );
});
test("report names are trimmed, bounded and unsafe inputs are omitted", () => {
  assert.equal(safeAlertTitle("  Rác   ven đường  "), "Rác ven đường");
  for (const title of [
    alertId,
    eventId,
    "<b>Rác</b>",
    "a@example.com",
    "Bearer secret",
    "token=secret",
    "UNCLASSIFIED",
  ])
    assert.equal(safeAlertTitle(title), undefined);
  assert.ok(safeAlertTitle("Rác ven đường ".repeat(20)).length <= 90);
  assert.match(
    buildNotificationContent({
      eventType: EVENTS.ALERT_STARTED,
      recipientRole: "CITIZEN",
      alertTitle: "Rác ven đường",
    }).message,
    /Rác ven đường/,
  );
});
test("exact legacy templates localize without altering identity or claiming unknown workflow states", () => {
  const titles = [
    "Alert Analyzed",
    "Officer started handling your report",
    "Officer arrived at the scene",
    "Incident resolved",
    "Incident closed",
    "New incident assigned",
    "Incident ready for review",
    "Alert Status Update",
  ];
  for (const title of titles) {
    const record = {
      _id: "notice",
      eventId,
      alertId,
      recipientId: "citizen",
      isRead: true,
      createdAt: "2026-10-01",
      title,
      message: `Your alert ${alertId} is now IN_PROGRESS`,
    };
    const before = JSON.stringify(record);
    const formatted = { ...record, ...formatNotificationContent(record) };
    assert.doesNotMatch(
      formatted.title + formatted.message,
      /IN_PROGRESS|[a-f\d]{24}/,
    );
    for (const key of [
      "_id",
      "eventId",
      "alertId",
      "recipientId",
      "isRead",
      "createdAt",
    ])
      assert.equal(formatted[key], record[key]);
    assert.equal(JSON.stringify(record), before);
  }
  assert.equal(
    formatNotificationContent({
      title: "Random resolved keyword",
      message: "CLOSED",
    }).type,
    "GENERAL",
  );
  assert.equal(
    formatNotificationContent({ title: "constructor" }).type,
    "GENERAL",
  );
  assert.equal(
    buildNotificationContent({
      eventType: "constructor",
      recipientRole: "CITIZEN",
    }),
    null,
  );
  assert.equal(
    formatNotificationContent({
      title: "Incident closed",
      recipientRole: "OFFICER",
    }).type,
    "OFFICER_CLOSED",
  );
  assert.equal(
    formatNotificationContent({ type: "RESOLVED", title: "Incident closed" })
      .type,
    "RESOLVED",
  );
});
test("real consumer routes role-specific workflow content and suppresses generic edits/companion events", async () => {
  const calls = [];
  const originalNotify = notificationService.notify;
  const originalAll = socketService.emitToAll;
  const originalRooms = socketService.emitToRooms;
  const originalRoom = socketService.emitToRoom;
  notificationService.notify = async (...args) => calls.push(args);
  socketService.emitToAll = (_name, data) =>
    assert.deepEqual(Object.keys(data), ["type"]);
  socketService.emitToRooms = () => {};
  socketService.emitToRoom = () => {};
  try {
    const event = (eventType, extra = {}) =>
      rabbitMQService.handleEvent({
        eventType,
        eventId,
        data: {
          alertId,
          citizenId: "citizen",
          assignedOfficerId: "officer",
          analysisMode: "IMAGE_AND_TEXT",
          ...extra,
        },
      });
    await event(EVENTS.ALERT_CREATED);
    assert.deepEqual(
      calls.splice(0).map((c) => [c[0], c[1].type]),
      [
        ["citizen", "REPORT_RECEIVED"],
        ["admins", "ADMIN_VERIFICATION"],
      ],
    );
    await event(EVENTS.AI_ANALYZED);
    assert.deepEqual(
      calls.splice(0).map((c) => [c[0], c[1].type]),
      [["citizen", "AI_ANALYZED"]],
    );
    await event(EVENTS.AI_ANALYZED, { analysisMode: "FAILED" });
    assert.equal(calls.length, 0);
    await event(EVENTS.OFFICER_ASSIGNED);
    assert.deepEqual(
      calls.splice(0).map((c) => [c[0], c[1].type]),
      [
        ["citizen", "ASSIGNED"],
        ["officer", "OFFICER_ASSIGNED"],
      ],
    );
    for (const type of [
      EVENTS.ALERT_STARTED,
      EVENTS.ALERT_ARRIVED,
      EVENTS.ALERT_RESOLVED,
      EVENTS.ALERT_CLOSED,
    ])
      await event(type);
    assert.deepEqual(
      calls.map((c) => c[1].type),
      [
        "OFFICER_STARTED_HANDLING",
        "OFFICER_ARRIVED",
        "RESOLVED",
        "ADMIN_REVIEW",
        "CLOSED",
        "OFFICER_CLOSED",
      ],
    );
    for (const c of calls) {
      assert.equal(c[2], eventId);
      assert.equal(c[3], alertId);
    }
    calls.length = 0;
    await event(EVENTS.ALERT_UPDATED, { status: "verified" });
    await event(EVENTS.ALERT_UPDATED, {
      status: "verified",
      previousStatus: "verified",
    });
    await event(EVENTS.ALERT_UPDATED, {
      status: "verified",
      previousStatus: "pending",
      workflowNotificationHandled: true,
    });
    assert.equal(calls.length, 0);
    for (const status of ["verified", "rejected"])
      await event(EVENTS.ALERT_UPDATED, { status, previousStatus: "pending" });
    assert.deepEqual(
      calls.map((c) => c[1].type),
      ["VERIFIED", "REJECTED"],
    );
  } finally {
    notificationService.notify = originalNotify;
    socketService.emitToAll = originalAll;
    socketService.emitToRooms = originalRooms;
    socketService.emitToRoom = originalRoom;
  }
});
test("service preserves separate event/entity IDs and emits after persistence for every recipient", async () => {
  const order = [];
  const persist = notificationRepository.createOnce,
    emit = socketService.emitToRoom;
  notificationRepository.createOnce = async (data) => {
    order.push(["persist", data]);
    return { _id: "notice" };
  };
  socketService.emitToRoom = (...args) => order.push(["socket", ...args]);
  try {
    for (const recipient of ["citizen", "officer", "admins"])
      await notificationService.notify(
        recipient,
        contentForType("RESOLVED"),
        eventId,
        alertId,
      );
    for (let i = 0; i < order.length; i += 2) {
      assert.equal(order[i][0], "persist");
      assert.equal(order[i][1].eventId, eventId);
      assert.equal(order[i][1].alertId, alertId);
      assert.equal(order[i + 1][0], "socket");
    }
    assert.equal(order.at(-1)[1], "role:ADMIN");
  } finally {
    notificationRepository.createOnce = persist;
    socketService.emitToRoom = emit;
  }
});
