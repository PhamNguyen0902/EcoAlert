const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");
const React = require("react");
const read = (file) =>
  fs.readFileSync(path.join(__dirname, "../src", file), "utf8");
function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(read(file), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      Date,
      setTimeout,
      clearTimeout,
      require: (name) => {
        assert.ok(name in imports, `Unexpected ${name} in ${file}`);
        return imports[name];
      },
    },
  );
  return exports;
}
const maps = load("utils/maps.ts", { "react-native": { Linking: {} } });
const presentation = load("utils/officerPresentation.ts", { "./maps": maps });
const workflow = load("utils/officerWorkflow.ts");
const profile = {
  _id: "officer-a",
  role: "OFFICER",
  fullName: "Cán bộ thực tế",
};
const task = {
  _id: "abcdef123456abcdef123456",
  assignedOfficerId: "officer-a",
  title: "Điểm rác thực tế",
  description: "Mô tả thực tế",
  address: "Đường Nguyễn Văn Bảo",
  status: "IN_PROGRESS",
  category: "illegal_dumping",
  mediaUrls: ["https://test.invalid/before.jpg"],
  location: { type: "Point", coordinates: [106.7, 10.8] },
};
test("ownership rejects missing, other-role and crafted unassigned tasks; populated owners work", () => {
  assert.equal(presentation.ownsOfficerTask(task, profile), true);
  assert.equal(
    presentation.ownsOfficerTask(
      { ...task, assignedOfficerId: { _id: profile._id } },
      profile,
    ),
    true,
  );
  for (const bad of [
    undefined,
    { ...profile, role: "CITIZEN" },
    { ...profile, _id: "other" },
  ])
    assert.equal(presentation.ownsOfficerTask(task, bad), false);
  assert.equal(
    presentation.ownsOfficerTask(
      { ...task, assignedOfficerId: undefined },
      profile,
    ),
    false,
  );
});
test("workflow timeline never completes future stages or infers arrival from arrivedAt", () => {
  assert.equal(
    presentation
      .officerTimeline({ ...task, arrivedAt: new Date().toISOString() })
      .filter((step) => step.done).length,
    0,
  );
  const date = "2026-10-12T02:30:00Z";
  const steps = presentation.officerTimeline({
    ...task,
    assignedAt: date,
    startedAt: date,
    checkIn: { verified: true, checkedInAt: date },
    resolvedAt: date,
  });
  assert.equal(steps.length, 6);
  assert.equal(steps[3].done, true);
  assert.equal(steps[4].done, true);
  assert.equal(steps[5].done, false);
  assert.equal(presentation.officerDate("bad"), "Chưa ghi nhận");
});
test("scoped task search handles Vietnamese and IDs without modifying actual category/status", () => {
  assert.equal(
    presentation.searchOfficerTasks([task], "nguyen van bao")[0],
    task,
  );
  assert.equal(presentation.searchOfficerTasks([task], "123456").length, 1);
  assert.equal(
    presentation.searchOfficerTasks([task], "không tồn tại").length,
    0,
  );
  assert.equal(presentation.taskDistance(task, null), null);
  assert.equal(
    presentation.taskDistance(task, { latitude: 10.8, longitude: 106.7 }),
    0,
  );
});
test("routing reuses GIS OSRM contract, validates GeoJSON order and propagates cancellation", async () => {
  let request;
  const payload = {
    distanceMeters: 1250,
    durationSeconds: 180,
    geometry: {
      type: "LineString",
      coordinates: [
        [106.7, 10.8],
        [106.71, 10.81],
      ],
    },
  };
  const routing = load("api/officerRouting.ts", {
    "./client": {
      api: {
        get: async (...args) => {
          request = args;
          return { data: { data: payload } };
        },
      },
    },
    "../utils/maps": maps,
  });
  const signal = new AbortController().signal;
  const result = await routing.getOfficerRoute(
    { latitude: 10.8, longitude: 106.7 },
    { latitude: 10.81, longitude: 106.71 },
    signal,
  );
  assert.equal(request[0], "/v1/gis/route");
  assert.equal(request[1].signal, signal);
  assert.equal(request[1].params.startLng, 106.7);
  assert.equal(result.points[0].longitude, 106.7);
  assert.equal(result.distanceMeters, 1250);
  for (const bad of [
    null,
    { ...payload, durationSeconds: NaN },
    { ...payload, distanceMeters: -1 },
    { ...payload, geometry: { type: "Point", coordinates: [] } },
    {
      ...payload,
      geometry: {
        type: "LineString",
        coordinates: [
          [106.7, 10.8],
          [200, 95],
        ],
      },
    },
  ])
    assert.throws(() => routing.parseOfficerRoute(bad));
});
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}
const colors = {
  background: "#07101F",
  surface: "#0B1628",
  elevated: "#101D31",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  textSecondary: "#CBD5E1",
  primary: "#22C55E",
  cyan: "#38BDF8",
  warning: "#F59E0B",
  danger: "#F87171",
  border: "#1E293B",
  greenSoft: "#102D23",
};
function fixture(file, extra = {}, state = {}) {
  let index = 0;
  const effects = [];
  const writes = [],
    navigationCalls = [];
  const navigation = {
    navigate: (...args) => navigationCalls.push(["navigate", ...args]),
    replace: (...args) => navigationCalls.push(["replace", ...args]),
    reset: (...args) => navigationCalls.push(["reset", ...args]),
    goBack() {},
  };
  const native = Object.fromEntries(
    [
      "View",
      "Text",
      "ScrollView",
      "Pressable",
      "ActivityIndicator",
      "KeyboardAvoidingView",
      "Modal",
      "FlatList",
      "RefreshControl",
    ].map((key) => [key, key]),
  );
  const imports = {
    react: {
      __esModule: true,
      default: React,
      useRef: (initial) => ({ current: initial }),
      useEffect: (effect) => effects.push(effect),
      useState: (initial) => {
        const at = index++;
        return [
          at in state ? state[at] : initial,
          (value) => writes.push([at, value]),
        ];
      },
    },
    "react-native": {
      ...native,
      AppState: { currentState: "active" },
      Platform: { OS: "ios" },
      Linking: { openSettings: async () => {} },
      StyleSheet: { create: (value) => value },
      Alert: { alert() {} },
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 44, bottom: 34 }),
    },
    "@react-navigation/native": { usePreventRemove() {} },
    "react-native-maps": {
      __esModule: true,
      default: "MapView",
      Marker: "Marker",
      Circle: "Circle",
      PROVIDER_GOOGLE: "google",
    },
    "lucide-react-native": Object.fromEntries(
      [
        "MapPin",
        "ShieldCheck",
        "Check",
        "CheckCircle2",
        "Clock3",
        "Bell",
        "CheckCheck",
        "ClipboardCheck",
      ].map((key) => [key, key]),
    ),
    "../../hooks/useAlerts": {
      useAlert: () => ({ data: task, refetch() {} }),
      useConfirmArrival: () => ({
        isPending: false,
        mutateAsync: async () => {},
      }),
      useStartHandling: () => ({ mutateAsync: async () => {} }),
      useAddOfficerNote: () => ({ mutateAsync: async () => {} }),
    },
    "../../hooks/useAuth": { useProfile: () => ({ data: profile }) },
    "../../hooks/useOfficerPosition": {
      useOfficerPosition: () => ({
        position: null,
        pending: false,
        error: null,
        refresh: async () => null,
      }),
    },
    "../../theme/useCivicTheme": {
      useCivicTheme: () => ({ colors, isDark: true }),
    },
    "../../theme/civicDesign": {
      civicStyles: { content: {} },
      civicType: { meta: {}, body: {}, section: {} },
    },
    "../../utils/maps": maps,
    "../../utils/officerPresentation": presentation,
    "../../utils/officerWorkflow": workflow,
    "../../utils/aiAnalysis": {
      getAlertDisplaySeverity: (value) => value.severity,
    },
    "../../utils/incidentPresentation": {
      getCategoryLabel: () => "Rác thải",
      getSeverityLabel: () => "Chưa có mức độ",
    },
    "../../utils/visionBoundingBox": {
      getWasteDetectionLabel: (value) => value,
    },
    "../../components/officer/OfficerUI": {
      OfficerHeader: "OfficerHeader",
      OfficerBadge: "OfficerBadge",
      OfficerCard: "OfficerCard",
      officerStyles: {},
    },
    "../../components/officer/OfficerTimeline": {
      OfficerTimeline: "OfficerTimeline",
    },
    "../../components/officer/OfficerEvidenceComparison": {
      OfficerEvidenceComparison: "OfficerEvidenceComparison",
    },
    "../../components/media/EvidenceImageFrame": {
      EvidenceImageFrame: "EvidenceImageFrame",
    },
    "../../components/ai/OverallAiAnalysisCard": {
      OverallAiAnalysisCard: "OverallAiAnalysisCard",
    },
    "../../components/ui/Button": { Button: "Button" },
    "../../components/ui/Input": { Input: "Input" },
    "../../components/ui/Card": { Card: "Card" },
    "../../features/report/components/stitch/FieldUI": {
      FieldEntrance: "FieldEntrance",
    },
    "../../components/officer/OfficerEntrance": {
      OfficerEntrance: "OfficerEntrance",
    },
    ...extra,
  };
  const exports = load(`screens/officer/${file}.tsx`, imports);
  const tree = exports[file]({
    route: { params: { id: task._id } },
    navigation,
  });
  return { tree, all: nodes(tree), writes, navigationCalls, effects };
}

test("mobile routing waits for map readiness, fits the actual points and surfaces HCMC region errors", async () => {
  const points = [
    { latitude: 10.7769, longitude: 106.7009 },
    { latitude: 10.78, longitude: 106.701 },
    { latitude: 10.84498, longitude: 106.708477 },
  ];
  let externalCalls = 0;
  const fits = [];
  const gps = {
    position: { ...points[0], recordedAt: new Date().toISOString() },
    pending: false,
    error: null,
    refresh: async () => points[0],
  };
  const base = {
    "react-native-maps": {
      __esModule: true,
      default: "MapView",
      Marker: "Marker",
      Polyline: "Polyline",
      PROVIDER_GOOGLE: "google",
    },
    "@react-navigation/native": {
      useNavigation: () => ({ navigate() {} }),
      useRoute: () => ({ params: { selectedId: task._id } }),
    },
    "../../hooks/useAlerts": {
      useOfficerTasks: () => ({ data: { items: [task] } }),
    },
    "../../hooks/useOfficerPosition": { useOfficerPosition: () => gps },
    "../../hooks/useForegroundScreen": {
      useForegroundScreen: () => true,
      useScreenClock: () => Date.now(),
    },
    "../../api/officerRouting": {
      getOfficerRoute: async () => ({
        points,
        distanceMeters: 10117.6,
        durationSeconds: 690.8,
      }),
    },
    "../../components/officer/OfficerTaskCard": {
      OfficerTaskCard: "OfficerTaskCard",
    },
    "../../components/officer/OfficerTaskFilters": {
      OfficerTaskFilters: "OfficerTaskFilters",
    },
    "../../utils/maps": {
      ...maps,
      openGoogleMaps: async () => {
        externalCalls++;
        return { success: true };
      },
    },
    "../../features/report/components/stitch/FieldUI": {
      useFieldReducedMotion: () => true,
    },
    "lucide-react-native": Object.fromEntries(
      ["Crosshair", "Minus", "Plus", "Search", "Flag", "RefreshCw"].map(
        (name) => [name, name],
      ),
    ),
  };
  const rendered = (ready, route) => {
    const effects = [];
    let index = 0;
    const state = { 3: true, 5: 500, 6: ready };
    const writes = [];
    const actual = fixture("OfficerOperationalMap", {
      ...base,
      "@tanstack/react-query": { useQuery: () => route },
      react: {
        __esModule: true,
        default: React,
        useState: (initial) => {
          const at = index++;
          return [
            at in state ? state[at] : initial,
            (value) => writes.push([at, value]),
          ];
        },
        useRef: (initial) => ({
          current:
            initial === null
              ? {
                  fitToCoordinates: (...args) => fits.push(args),
                  animateToRegion() {},
                }
              : initial,
        }),
        useEffect: (effect) => effects.push(effect),
      },
    });
    return { ...actual, effects, writes };
  };
  const route = {
    data: { points, distanceMeters: 10117.6, durationSeconds: 690.8 },
    isFetching: false,
  };
  rendered(false, route).effects.at(-1)();
  assert.equal(fits.length, 0);
  const ready = rendered(true, route);
  ready.effects.at(-1)();
  assert.equal(fits.length, 1);
  assert.equal(fits[0][0], points);
  assert.equal(
    ready.all.find((node) => node.type === "Polyline").props.coordinates,
    points,
  );
  assert.match(JSON.stringify(ready.tree), /10\.1/);
  await ready.all
    .find(
      (node) =>
        node.type === "Button" && node.props.title === "BẮT ĐẦU CHỈ ĐƯỜNG",
    )
    .props.onPress();
  assert.ok(ready.writes.some(([at, value]) => at === 3 && value === true));
  assert.equal(externalCalls, 0);
  const message = "Vị trí nằm ngoài vùng định tuyến TP.HCM được hỗ trợ";
  const failed = rendered(true, {
    data: undefined,
    isError: true,
    error: { response: { status: 422, data: { message } } },
  });
  assert.ok(JSON.stringify(failed.tree).includes(message));
  assert.equal(failed.all.filter((node) => node.type === "Polyline").length, 0);
});
test("detail renders one real AI card, real notes/timeline and GPS route; crafted ownership has no action", () => {
  const actual = fixture("OfficerAlertDetailScreen");
  const ai = actual.all.filter((node) => node.type === "OverallAiAnalysisCard");
  assert.equal(ai.length, 1);
  assert.equal(ai[0].props.alert, task);
  const gps = actual.all.find(
    (node) =>
      node.type === "Button" && node.props.title.includes("ĐIỂM DANH GPS"),
  );
  gps.props.onPress();
  assert.deepEqual(JSON.parse(JSON.stringify(actual.navigationCalls[0])), [
    "navigate",
    "OfficerGpsCheckIn",
    { id: task._id },
  ]);
  assert.ok(
    actual.all.some(
      (node) => node.type === "Input" && node.props.maxLength === 2000,
    ),
  );
  const crafted = fixture("OfficerAlertDetailScreen", {
    "../../hooks/useAuth": {
      useProfile: () => ({ data: { ...profile, _id: "other" } }),
    },
  });
  assert.equal(
    crafted.all.filter((node) => node.type === "OverallAiAnalysisCard").length,
    0,
  );
  assert.equal(
    crafted.all.filter(
      (node) =>
        node.type === "Button" &&
        /BẮT ĐẦU|ĐIỂM DANH|GHI NHẬN/.test(node.props.title),
    ).length,
    0,
  );
});
test("GPS confirmation acquires a new fix, preserves metadata and locks rapid taps", async () => {
  let fixes = 0,
    mutations = 0,
    payload;
  let release;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  const fresh = {
    latitude: 10.8,
    longitude: 106.7,
    accuracyMeters: 7,
    recordedAt: new Date().toISOString(),
  };
  const screen = fixture("OfficerGpsCheckInScreen", {
    "../../hooks/useOfficerPosition": {
      useOfficerPosition: () => ({
        position: null,
        pending: false,
        refresh: async () => {
          fixes++;
          await wait;
          return fresh;
        },
      }),
    },
    "../../hooks/useAlerts": {
      useAlert: () => ({ data: task }),
      useConfirmArrival: () => ({
        mutateAsync: async (data) => {
          mutations++;
          payload = data;
        },
      }),
    },
  });
  const button = screen.all.find(
    (node) =>
      node.type === "Button" &&
      node.props.title === "XÁC NHẬN ĐÃ ĐẾN HIỆN TRƯỜNG",
  );
  const first = button.props.onPress();
  button.props.onPress();
  release();
  await new Promise(setImmediate);
  assert.equal(fixes, 1);
  assert.equal(mutations, 1);
  assert.equal(payload.location.accuracyMeters, 7);
  assert.equal(payload.id, task._id);
  assert.equal(screen.navigationCalls.length, 0); // Only server-updated verified state enables next step.
});
test("GPS denied/failure never confirms, ASSIGNED/crafted route cannot bypass start handling", async () => {
  for (const data of [
    task,
    { ...task, status: "ASSIGNED" },
    { ...task, assignedOfficerId: "other" },
  ]) {
    let mutations = 0;
    const screen = fixture("OfficerGpsCheckInScreen", {
      "../../hooks/useAlerts": {
        useAlert: () => ({ data }),
        useConfirmArrival: () => ({ mutateAsync: async () => mutations++ }),
      },
    });
    const button = screen.all.find(
      (node) =>
        node.type === "Button" &&
        node.props.title === "XÁC NHẬN ĐÃ ĐẾN HIỆN TRƯỜNG",
    );
    button.props.onPress();
    await new Promise(setImmediate);
    assert.equal(mutations, 0);
    if (data !== task) assert.equal(button.props.disabled, true);
  }
});
test("submitted presentation requires real own RESOLVED/CLOSED; evidence comes from API only", () => {
  const pending = fixture("OfficerResolutionSubmittedScreen");
  assert.equal(
    pending.all.some((node) => node.type === "OfficerEvidenceComparison"),
    false,
  );
  const resolved = {
    ...task,
    status: "RESOLVED",
    resolvedAt: "2026-10-12T03:00:00Z",
    resolutionEvidence: [{ url: "https://test.invalid/after.jpg" }],
  };
  const screen = fixture("OfficerResolutionSubmittedScreen", {
    "../../hooks/useAlerts": { useAlert: () => ({ data: resolved }) },
  });
  assert.equal(
    screen.all.find((node) => node.type === "OfficerEvidenceComparison").props
      .afterUri,
    resolved.resolutionEvidence[0].url,
  );
  assert.ok(
    screen.all.some(
      (node) =>
        node.type === "OfficerBadge" && node.props.label === "CHỜ NGHIỆM THU",
    ),
  );
  assert.equal(
    screen.all.filter((node) => node.type === "CheckCircle2").length,
    1,
  );
});
test("navigation has all nine screens, exactly three tabs, no new Citizen/Admin entry", () => {
  const navigation = read("navigation/OfficerTabNavigator.tsx");
  assert.equal([...navigation.matchAll(/<Tab.Screen\s+name=/g)].length, 3);
  for (const name of [
    "OfficerTaskList",
    "OfficerGpsCheckIn",
    "OfficerResolutionSubmitted",
    "OfficerNotifications",
    "OfficerAlertDetail",
    "OfficerResolution",
  ])
    assert.ok(navigation.includes(`name="${name}"`));
  assert.match(
    read("screens/officer/OfficerMapScreen.tsx"),
    /mode === "admin" \?\s*\(\s*<LegacyOfficerMapScreen mode="admin" \/>\s*\)\s*:\s*\(\s*<OfficerOperationalMap \/>/,
  );
  const map = read("screens/officer/OfficerOperationalMap.tsx");
  assert.match(map, /getOfficerRoute\(gps.position!, destination!, signal\)/);
  assert.match(map, /Polyline\s+coordinates=\{route.data.points\}/);
  const startAction = map.slice(
    map.indexOf('title="BẮT ĐẦU CHỈ ĐƯỜNG"'),
    map.indexOf('title="MỞ GOOGLE MAPS"'),
  );
  assert.match(startAction, /await gps\.refresh\(\)/);
  assert.match(startAction, /setRouteRequested\(true\)/);
  assert.doesNotMatch(startAction, /external\(|openGoogleMaps|Linking\./);
  assert.doesNotMatch(
    read("api/officerRouting.ts"),
    /router\.project-osrm|https?:\/\//,
  );
  assert.match(map, /Platform.OS === "android" \? PROVIDER_GOOGLE : undefined/);
  assert.doesNotMatch(map, /coordinates=\{\[.*destination/);
});

test("Officer notifications reuse localized API data, mark read once and open only validated Officer alert IDs", async () => {
  const actualPresentation = load("utils/notificationPresentation.ts");
  const actualNavigation = load("utils/notificationNavigation.ts");
  let reads = 0;
  const item = {
    _id: "notification-1",
    title: "New incident assigned",
    message: "old transport text",
    type: "OFFICER_ASSIGNED",
    alertId: task._id,
    eventId: "event-is-not-an-alert",
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  const extra = {
    "date-fns": require("date-fns"),
    "date-fns/locale": require("date-fns/locale"),
    "../../utils/notificationPresentation": actualPresentation,
    "../../utils/notificationNavigation": actualNavigation,
    "../../hooks/useNotifications": {
      useInfiniteNotifications: () => ({
        data: {
          pages: [
            { items: [item, { ...item, _id: "notification-2", isRead: true }] },
          ],
        },
        refetch() {},
      }),
      useUnreadNotificationCount: () => ({ data: 1 }),
      useMarkNotificationRead: () => ({
        mutateAsync: async () => {
          reads++;
        },
      }),
      useMarkAllNotificationsRead: () => ({ mutateAsync: async () => {} }),
    },
  };
  const screen = fixture("OfficerNotificationsScreen", extra);
  const list = screen.all.find((node) => node.type === "FlatList");
  const row = list.props.renderItem({ item });
  assert.match(row.props.accessibilityLabel, /Bạn có nhiệm vụ mới/);
  const first = row.props.onPress();
  row.props.onPress();
  await new Promise(setImmediate);
  assert.equal(reads, 1);
  assert.equal(screen.navigationCalls.length, 1);
  assert.equal(screen.navigationCalls[0][1], "OfficerAlertDetail");
  assert.equal(screen.navigationCalls[0][2].id, task._id);
  const general = {
    ...item,
    _id: "notification-3",
    alertId: undefined,
    isRead: true,
  };
  list.props.renderItem({ item: general }).props.onPress();
  await new Promise(setImmediate);
  assert.equal(screen.navigationCalls.length, 1);
  const unread = fixture("OfficerNotificationsScreen", extra, { 0: "UNREAD" });
  assert.equal(
    unread.all.find((node) => node.type === "FlatList").props.data.length,
    1,
  );
  const read = fixture("OfficerNotificationsScreen", extra, { 0: "READ" });
  assert.equal(
    read.all.find((node) => node.type === "FlatList").props.data.length,
    1,
  );
});

test("native GPS adapter rejects denied/stale/unknown fixes, retains actual accuracy and suppresses unmounted results", async () => {
  const resolution = load("utils/officerResolution.ts");
  async function gpsCase({
    granted = true,
    age = 0,
    accuracy = 71,
    unmount = false,
    active = true,
  } = {}) {
    let calls = 0,
      cleanup;
    const writes = [];
    const module = load("hooks/useOfficerPosition.ts", {
      react: {
        useState: (value) => [value, (next) => writes.push(next)],
        useRef: (value) => ({ current: value }),
        useEffect: (effect) => {
          cleanup = effect();
        },
      },
      "react-native": { AppState: { currentState: "active" } },
      "expo-location": {
        Accuracy: { Highest: "Highest" },
        requestForegroundPermissionsAsync: async () => ({ granted }),
        getCurrentPositionAsync: async (options) => {
          calls++;
          assert.equal(options.accuracy, "Highest");
          if (unmount) cleanup();
          return {
            timestamp: Date.now() - age,
            coords: { latitude: 10.8, longitude: 106.7, accuracy },
          };
        },
      },
      "../utils/officerResolution": resolution,
      "./useForegroundScreen": { useForegroundScreen: () => active },
    });
    const result = await module.useOfficerPosition().refresh();
    return { result, calls, writes };
  }
  const denied = await gpsCase({ granted: false });
  assert.equal(denied.calls, 0);
  assert.equal(denied.result, null);
  assert.ok(
    denied.writes.some(
      (value) => typeof value === "string" && /quyền/.test(value),
    ),
  );
  assert.equal((await gpsCase({ age: 120000 })).result, null);
  assert.equal((await gpsCase({ accuracy: null })).result, null);
  assert.equal((await gpsCase({ active: false })).calls, 0);
  assert.equal((await gpsCase({ unmount: true })).result, null);
  assert.equal((await gpsCase()).result.accuracyMeters, 71); // No invented client-side server limit.
});

test("resolution form retains controlled fields, photo confirmation, duplicate lock and awaits success before replacing", async () => {
  const resolution = load("utils/officerResolution.ts");
  const realTask = { ...task, checkIn: { verified: true } };
  const photo = {
    originalLocalUri: "file:///real-after.jpg",
    capturedAt: new Date().toISOString(),
    location: { latitude: 10.8, longitude: 106.7, accuracyMeters: 8 },
  };
  let uploads = 0,
    resolves = 0,
    payload;
  const state = {
    1: photo,
    2: true,
    3: "Đã thu gom thực tế",
    4: "Thu gom và vận chuyển rác",
    5: ["Xe gom rác"],
  };
  const screen = fixture("OfficerResolutionScreen", {
    react: {
      __esModule: true,
      default: React,
      useRef: (value) => ({ current: value }),
      useState: (() => {
        let at = 0;
        return (value) => {
          const index = at++;
          return [index in state ? state[index] : value, () => {}];
        };
      })(),
      useEffect() {},
    },
    "../../utils/officerResolution": resolution,
    "./OfficerResolutionCamera": {
      OfficerResolutionCamera: "OfficerResolutionCamera",
    },
    "../../hooks/useAlerts": {
      useAlert: () => ({ data: realTask }),
      useUploadMedia: () => ({
        mutateAsync: async (data) => {
          assert.equal(data.fileUri, photo.originalLocalUri);
          uploads++;
          return "https://test.invalid/real-after.jpg";
        },
      }),
      useResolveIncident: () => ({
        mutateAsync: async (data) => {
          resolves++;
          payload = data;
        },
      }),
    },
  });
  const button = screen.all.find(
    (node) =>
      node.type === "Button" &&
      node.props.title === "GỬI KẾT QUẢ ĐỂ NGHIỆM THU",
  );
  assert.equal(button.props.disabled, false);
  button.props.onPress();
  button.props.onPress();
  await new Promise(setImmediate);
  assert.equal(uploads, 1);
  assert.equal(resolves, 1);
  assert.equal(payload.id, task._id);
  assert.equal(payload.data.evidence[0].capturedAt, photo.capturedAt);
  assert.equal(payload.data.evidence[0].location.accuracyMeters, 8);
  assert.equal(screen.navigationCalls.length, 0); // A subsequent render releases usePreventRemove then effects navigate.
  const source = read("screens/officer/OfficerResolutionScreen.tsx");
  assert.match(source, /submitted && !submitting/);
  assert.match(
    source,
    /if \(await submitter\(draft\)\)\s*\{\s*setSubmitted\(true\)/,
  );
  assert.match(source, /ownsOfficerTask\(task, profile\)/);
  const route = read("navigation/OfficerTabNavigator.tsx");
  assert.match(
    route,
    /name="OfficerResolution"[\s\S]*?getId=\{\(\{ params \}\) => params.id\}/,
  );
});
