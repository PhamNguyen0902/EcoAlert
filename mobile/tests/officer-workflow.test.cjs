const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");
const read = (p) => fs.readFileSync(path.join(__dirname, "../src", p), "utf8");
const exportsObject = {};
vm.runInNewContext(
  ts.transpileModule(read("utils/officerWorkflow.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: exportsObject },
);
const tasks = ["ASSIGNED", "in_progress", "RESOLVED", "closed", "PENDING"].map(
  (status, i) => ({ _id: String(i), status }),
);
test("task groups use ASSIGNED, IN_PROGRESS and RESOLVED+CLOSED; no PENDING task", () => {
  for (const [filter, count] of [
    ["ALL", 4],
    ["NEW", 1],
    ["ACTIVE", 1],
    ["COMPLETED", 2],
  ])
    assert.equal(exportsObject.filterOfficerTasks(tasks, filter).length, count);
});
test("operational CTA requires verified check-in, not merely arrivedAt", () => {
  const get = exportsObject.getOfficerTaskState;
  assert.equal(get({ status: "ASSIGNED" }).action, "START");
  assert.equal(
    get({ status: "IN_PROGRESS", arrivedAt: "today" }).action,
    "ARRIVE",
  );
  assert.equal(
    get({ status: "in_progress", checkIn: { verified: true } }).action,
    "RESOLVE",
  );
  for (const status of ["RESOLVED", "CLOSED", "PENDING"])
    assert.equal(get({ status }).action, "NONE");
});
test("explicit non-waste legacy tasks are excluded without reclassifying data", () => {
  const mixed = [
    "illegal_dumping",
    "illegal_construction_waste",
    "water_pollution",
    "flooding",
    "fallen_tree",
    "noise_pollution",
    "illegal_burning",
  ].map((category) => ({ status: "ASSIGNED", category }));
  const actual = exportsObject.filterOfficerTasks(mixed, "ALL");
  assert.equal(actual.length, 2);
  assert.equal(actual[0].category, "illegal_dumping");
});
test("Officer map disables general alerts query; tasks and map share full assigned task query", () => {
  const map = read("screens/officer/OfficerMapScreen.tsx");
  assert.match(map, /useAlerts\(1, 100, \{\}, isAdminMap\)/);
  assert.match(map, /enabled: !isAdminMap,\s*allPages: true/);
  assert.match(
    read("screens/officer/OfficerTasksScreen.tsx"),
    /useOfficerTasks\(1, 100, undefined, \{\s*allPages: true,?\s*\}\)/,
  );
  assert.match(map, /getGeoJsonMapCoordinates/);
  assert.match(map, /Xem nhiệm vụ/);
});
test("transport errors are not shown raw; Vietnamese backend validation is readable", () => {
  assert.equal(
    exportsObject.officerErrorMessage(
      new Error("Axios network details"),
      "Thử lại",
    ),
    "Thử lại",
  );
  assert.equal(
    exportsObject.officerErrorMessage(
      { response: { data: { message: "GPS chưa đủ chính xác" } } },
      "Thử lại",
    ),
    "GPS chưa đủ chính xác",
  );
});

test("assigned task pagination makes one call for small lists and fetches remaining pages when necessary", async () => {
  const module = {};
  const requests = [];
  const rows = Array.from({ length: 103 }, (_, i) => ({
    _id: String(i),
    status: "ASSIGNED",
  }));
  let total = 3;
  const api = {
    get: async (url) => {
      requests.push(url);
      const page = Number(
        new URL(url, "https://example.test").searchParams.get("page"),
      );
      return {
        data: {
          data: {
            items: rows.slice((page - 1) * 100, Math.min(page * 100, total)),
            total,
          },
        },
      };
    },
  };
  vm.runInNewContext(
    ts.transpileModule(read("api/alertService.ts"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    {
      exports: module,
      URLSearchParams,
      require: (name) => {
        assert.equal(name, "./client");
        return { api };
      },
    },
  );
  assert.equal(
    (await module.alertService.getAllOfficerTasks()).items.length,
    3,
  );
  assert.equal(requests.length, 1);
  requests.length = 0;
  total = 103;
  assert.equal(
    (await module.alertService.getAllOfficerTasks()).items.length,
    103,
  );
  assert.equal(requests.length, 2);
  assert.ok(
    requests.every((url) => url.startsWith("/v1/alerts/officer/tasks?")),
  );
});

test("workflow mutation success installs the server response and refreshes assigned task/map cache", () => {
  const module = {};
  const cached = [];
  const invalidated = [];
  vm.runInNewContext(
    ts.transpileModule(read("hooks/useAlerts.ts"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    {
      exports: module,
      require: (name) =>
        name === "@tanstack/react-query"
          ? {
              useMutation: (options) => options,
              useQueryClient: () => ({
                setQueryData: (key, data) => cached.push({ key, data }),
                invalidateQueries: (input) => invalidated.push(input.queryKey),
              }),
            }
          : name === "../api/alertService"
            ? { alertService: {} }
            : {},
    },
  );
  for (const [hook, variables] of [
    ["useStartHandling", "task-1"],
    ["useConfirmArrival", { id: "task-1" }],
    ["useResolveIncident", { id: "task-1" }],
  ]) {
    const server = {
      _id: "task-1",
      status: "IN_PROGRESS",
      checkIn: { verified: true },
    };
    module[hook]().onSuccess(server, variables);
    const entry = cached.at(-1);
    assert.equal(entry.key.join("/"), "alert/task-1");
    assert.equal(entry.data, server);
    assert.ok(invalidated.some((key) => key.join("/") === "officer-tasks"));
    invalidated.length = 0;
  }
});
