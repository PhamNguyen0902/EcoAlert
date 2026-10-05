const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const load = (file, imports = {}) => {
  const output = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      },
    ).outputText,
    {
      exports: output,
      require: (name) => {
        assert.ok(name in imports, `unexpected dependency ${name}`);
        return imports[name];
      },
    },
  );
  return output;
};
const { getNotificationAlertId, unreadBadgeLabel, NotificationTapQueue } = load(
  "utils/notificationNavigation.ts",
);
const alertId = "6aba37a5932b5c69f65c360c";
test("notification entity mapping rejects UUID eventId, fake IDs and absent targets", () => {
  assert.equal(getNotificationAlertId({ alertId }), alertId);
  for (const value of [
    null,
    {},
    "string",
    { eventId: "3f403186-2278-4c36-8b5e-5f10f225f0a6" },
    { eventId: alertId },
    { alertId: "sample_alert_test" },
    { alertId: 123 },
  ])
    assert.equal(getNotificationAlertId(value), null);
});
test("unread badge is hidden for zero and caps at 9+", () => {
  assert.equal(unreadBadgeLabel(0), null);
  assert.equal(unreadBadgeLabel(1), "1");
  assert.equal(unreadBadgeLabel(9), "9");
  assert.equal(unreadBadgeLabel(10), "9+");
  assert.equal(unreadBadgeLabel(NaN), null);
});
test("cold-start tap waits for navigation and login, then navigates once", () => {
  const queue = new NotificationTapQueue();
  const opened = [];
  queue.enqueue({ alertId }, "request-1");
  assert.equal(
    queue.flush(false, ["CitizenApp"], (target) => opened.push(target)),
    false,
  );
  assert.equal(
    queue.flush(true, ["Login", "CitizenAppGuest"], (target) =>
      opened.push(target),
    ),
    false,
  );
  assert.equal(opened.length, 0);
  assert.equal(
    queue.flush(true, ["CitizenApp"], (target) => opened.push(target)),
    true,
  );
  assert.equal(opened[0].alertId, alertId);
  queue.enqueue({ alertId }, "request-1");
  assert.equal(
    queue.flush(true, ["CitizenApp"], (target) => opened.push(target)),
    false,
  );
  assert.equal(opened.length, 1);
});
test("foreground/background taps use the same target; missing entity opens only center", () => {
  const queue = new NotificationTapQueue();
  const opened = [];
  for (const id of ["foreground", "background"]) {
    queue.enqueue({ alertId }, id);
    assert.ok(
      queue.flush(true, ["CitizenApp"], (target) => opened.push(target)),
    );
  }
  queue.enqueue({ eventId: "a-uuid" }, "non-report");
  queue.flush(true, ["CitizenApp"], (target) => opened.push(target));
  assert.equal(opened.length, 3);
  assert.equal(opened[2].alertId, null);
});
test("Citizen push never redirects Officer/Admin", () => {
  for (const route of ["OfficerApp", "AdminApp"]) {
    const queue = new NotificationTapQueue();
    queue.enqueue({ alertId }, route);
    queue.flush(true, [route], () => assert.fail("must not navigate"));
    assert.equal(
      queue.flush(true, ["CitizenApp"], () => assert.fail("stale tap")),
      false,
    );
  }
});
test("notification API reuses the existing authenticated client and real gateway paths", async () => {
  const requests = [];
  const api = Object.fromEntries(
    ["get", "patch", "delete"].map((method) => [
      method,
      async (...args) => {
        requests.push([method, ...args]);
        return { data: { data: { count: 7, items: [] } } };
      },
    ]),
  );
  const { notificationService: service } = load("api/notificationService.ts", {
    "./client": { api },
  });
  await service.getNotifications(2, 20);
  assert.equal(await service.getUnreadCount(), 7);
  await service.markAsRead("notice-1");
  await service.markAllAsRead();
  await service.deleteNotification("notice-1");
  assert.deepEqual(
    requests.map((r) => r.slice(0, 2)),
    [
      ["get", "/v1/notifications"],
      ["get", "/v1/notifications/unread-count"],
      ["patch", "/v1/notifications/notice-1/read"],
      ["patch", "/v1/notifications/mark-all-read"],
      ["delete", "/v1/notifications/notice-1"],
    ],
  );
  assert.equal(requests[0][2].params.page, 2);
});
test("query cache is user-scoped, enabled only for signed-in users and mutations invalidate both keys", async () => {
  let profile = { _id: "citizen-1" };
  const invalidated = [];
  const service = {
    getNotifications: async () => ({}),
    getUnreadCount: async () => 3,
    markAsRead: async () => ({}),
    markAllAsRead: async () => {},
    deleteNotification: async () => {},
  };
  const hooks = load("hooks/useNotifications.ts", {
    "@tanstack/react-query": {
      useQuery: (options) => options,
      useInfiniteQuery: (options) => options,
      useMutation: (options) => options,
      useQueryClient: () => ({
        invalidateQueries: async ({ queryKey }) => {
          invalidated.push(Array.from(queryKey));
        },
      }),
    },
    "../api/notificationService": { notificationService: service },
    "./useAuth": { useProfile: () => ({ data: profile }) },
  });
  assert.equal(hooks.useNotifications(2, 20).queryKey.at(-1), "citizen-1");
  assert.equal(hooks.useUnreadNotificationCount().staleTime, 45000);
  await hooks.useMarkNotificationRead().onSuccess();
  await hooks.useMarkAllNotificationsRead().onSuccess();
  await hooks.useDeleteNotification().onSuccess();
  assert.equal(invalidated.length, 6);
  for (let i = 0; i < 6; i += 2)
    assert.deepEqual(invalidated.slice(i, i + 2), [
      ["notifications"],
      ["notifications-unread-count"],
    ]);
  profile = null;
  assert.equal(hooks.useNotifications().enabled, false);
  assert.equal(hooks.useUnreadNotificationCount().enabled, false);
});
