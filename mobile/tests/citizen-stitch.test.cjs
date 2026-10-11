const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const source = (file) =>
  fs.readFileSync(path.join(__dirname, "../src", file), "utf8");
function load(file, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(source(file), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
      },
    }).outputText,
    {
      exports,
      setTimeout,
      clearTimeout,
      ...globals,
      require: (name) => {
        assert.ok(name in imports, `Unexpected import ${name}`);
        return imports[name];
      },
    },
  );
  return exports;
}
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [
    tree,
    ...nodes(tree.props?.children),
    ...nodes(tree.props?.ListHeaderComponent),
    ...nodes(tree.props?.ListFooterComponent),
    ...nodes(tree.props?.ListEmptyComponent),
  ];
}
function text(tree) {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  return tree && typeof tree === "object"
    ? [
        tree.props?.children,
        tree.props?.ListHeaderComponent,
        tree.props?.ListFooterComponent,
        tree.props?.ListEmptyComponent,
      ]
        .map(text)
        .join(" ")
        .trim()
    : "";
}
const presentation = load("utils/citizenPresentation.ts", {
  "date-fns": require("date-fns"),
});
const incidents = load("utils/citizenIncidents.ts");
const profile = {
  _id: "citizen-1",
  fullName: "Nguyễn Văn An",
  email: "an@example.test",
  role: "CITIZEN",
  phone: "0901234567",
  isActive: true,
};
const alert = (id = "incident-1", status = "PENDING") => ({
  _id: id,
  title: "Rác trên đường",
  address: "12 Nguyễn Văn Bảo",
  citizenId: profile._id,
  location: { type: "Point", coordinates: [106.775, 10.823] },
  status,
  mediaUrls: ["https://example.test/photo.jpg"],
  createdAt: "2026-10-10T04:00:00Z",
});
const colors = {
  background: "#07101F",
  surface: "#0B1628",
  primary: "#22C55E",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  textSecondary: "#CBD5E1",
  cyan: "#38BDF8",
  warning: "#F59E0B",
  danger: "#F87171",
  greenSoft: "rgba(34,197,94,.12)",
  elevated: "#101D31",
};
const icons = new Proxy({}, { get: (_, name) => String(name) });
const ui = Object.fromEntries(
  [
    "CitizenTopBar",
    "CitizenAvatar",
    "CitizenActionTile",
    "CitizenSectionHeading",
    "CitizenSearch",
    "CitizenStat",
    "CitizenSettingsRow",
  ].map((name) => [name, name]),
);

function fixture(screen, overrides = {}) {
  const state = [],
    refs = [],
    effects = [],
    timers = [];
  let cursor = 0,
    tree;
  const calls = [],
    dialogs = [];
  const query = {
    data: { items: [alert()], pages: [{ items: [alert()], total: 75 }] },
    refetch: () => {
      calls.push("refetch");
      return Promise.resolve();
    },
    fetchNextPage: () => calls.push("next-page"),
    hasNextPage: true,
    ...overrides.query,
  };
  const user = Object.hasOwn(overrides, "profile")
    ? overrides.profile
    : profile;
  const logout = {
    mutate: () => calls.push("logout"),
    isPending: false,
    ...overrides.logout,
  };
  const device = {
    coords: null,
    fetchLocation: async () => null,
    ...overrides.device,
  };
  const root = {
    navigate: (...args) => calls.push(args),
    getParent: () => root,
  };
  const navigation = {
    navigate: (...args) => calls.push(args),
    getParent: () => root,
  };
  const theme = {
    colors,
    isDark: true,
    themeMode: "system",
    setThemeMode: async (mode) => calls.push(["theme", mode]),
  };
  const imports = {
    react: {
      __esModule: true,
      default: React,
      useMemo: (fn) => fn(),
      useCallback: (fn) => fn,
      useState: (initial) => {
        const index = cursor++;
        if (!Object.hasOwn(state, index)) state[index] = initial;
        return [
          state[index],
          (value) => {
            state[index] =
              typeof value === "function" ? value(state[index]) : value;
          },
        ];
      },
      useRef: (initial) => {
        const index = cursor++;
        return refs[index] ?? (refs[index] = { current: initial });
      },
      useEffect: (fn) => {
        effects.push(fn);
      },
    },
    "react-native": {
      ActivityIndicator: "ActivityIndicator",
      Alert: { alert: (...args) => dialogs.push(args) },
      Platform: { OS: "ios" },
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      TouchableOpacity: "TouchableOpacity",
      ScrollView: "ScrollView",
      FlatList: "FlatList",
      RefreshControl: "RefreshControl",
      Linking: { openSettings: async () => calls.push("permissions") },
      StyleSheet: { create: (s) => s, absoluteFill: {} },
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 44, bottom: 34 }),
    },
    "react-native-maps": {
      __esModule: true,
      default: "MapView",
      Marker: "Marker",
    },
    "react-native-svg": { __esModule: true, default: "Svg", Path: "Path" },
    "lucide-react-native": icons,
    "date-fns": require("date-fns"),
    "date-fns/locale": require("date-fns/locale"),
    "../../hooks/useAuth": {
      useProfile: () => ({ data: user }),
      useLogout: () => logout,
    },
    "../../hooks/useAlerts": {
      useAlerts: () => query,
      useCitizenReports: (id) => {
        calls.push(["reports", id]);
        return query;
      },
      useDeleteAlert: () => ({
        mutateAsync: async (id) => calls.push(["delete", id]),
      }),
    },
    "../../hooks/useNotifications": {
      useUnreadNotificationCount: () => ({ data: 2 }),
    },
    "../../hooks/useDashboardLocation": {
      useDashboardLocation: () => ({
        location: { latitude: 10.8, longitude: 106.7, source: "default" },
      }),
    },
    "../../hooks/useLocation": { useLocation: () => device },
    "../../hooks/useOfflineSync": {
      useOfflineSync: () => ({
        offlineCount: 0,
        isOffline: false,
        ...overrides.offline,
      }),
    },
    "../../theme/useCivicTheme": { useCivicTheme: () => theme },
    "../../theme/civicDesign": {
      civicStyles: {},
      civicType: {},
      civicSpace: {},
      civicRadius: {},
    },
    "../../context/LanguageContext": {
      useLanguage: () => ({ language: "vi", t: (_, fallback) => fallback }),
    },
    "../../components/citizen/v2/CitizenUI": ui,
    "../../components/citizen/hero/HomeHero": { HomeHero: "HomeHero" },
    "../../components/citizen/v2/CitizenReportProgress": {
      CitizenReportProgress: "CitizenReportProgress",
    },
    "../../components/citizen/CitizenReportCard": {
      CitizenReportCard: "CitizenReportCard",
    },
    "../../components/media/EvidenceImageFrame": {
      EvidenceImageFrame: "EvidenceImageFrame",
    },
    "../../components/ui/Card": { Card: "Card" },
    "../../components/ui/Button": { Button: "Button" },
    "../../components/ui/Badge": { Badge: "Badge" },
    "../../components/modals/EditAlertModal": {
      EditAlertModal: "EditAlertModal",
    },
    "../../utils/aiAnalysis": {
      getAiAnalysisState: () => "PENDING",
      getCategoryLabel: (value) => value || "Chờ phân loại",
      getSeverityLabel: (value) => value,
      getWorkflowStatusLabel: (value) => value,
    },
    "../../utils/citizenIncidents": incidents,
    "../../utils/citizenPresentation": presentation,
    "../../utils/maps": {
      openGoogleMaps: async (...args) => {
        calls.push(["maps", ...args]);
        return { success: true };
      },
    },
    "@react-navigation/native": { useFocusEffect: () => {} },
    "@tanstack/react-query": {
      useQuery: () => ({
        data: { gps: "granted", camera: "denied", drafts: 2 },
        refetch: async () => {},
      }),
    },
    "@react-native-community/netinfo": {
      useNetInfo: () => ({ isConnected: true, isInternetReachable: true }),
    },
    "expo-location": {},
    "expo-camera": { Camera: {} },
    "../../utils/offlineQueue": { offlineQueue: {} },
    "../../../app.json": { expo: { version: "1.0.0" } },
  };
  const component = load(`screens/citizen/${screen}.tsx`, imports, {
    setTimeout: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimeout: () => {},
  })[screen];
  function render() {
    cursor = 0;
    effects.length = 0;
    tree = component({ navigation });
    return tree;
  }
  render();
  return {
    render,
    get tree() {
      return tree;
    },
    calls,
    dialogs,
    query,
    device,
    flush: () => {
      effects.forEach((fn) => fn());
      timers.splice(0).forEach((fn) => fn());
    },
    find: (type, predicate = () => true) =>
      nodes(tree).find((n) => n.type === type && predicate(n.props)),
    all: (type) => nodes(tree).filter((n) => n.type === type),
    text: () => text(tree),
  };
}

test("presentation handles invalid dates and searches Vietnamese title/address/id without accents", () => {
  assert.equal(
    presentation.reportTime("invalid"),
    "Chưa có thời gian ghi nhận",
  );
  for (const query of ["rac tren", "NGUYỄN VĂN BẢO", "incident-1", "duong"])
    assert.ok(presentation.matchesReportSearch(alert(), query));
  assert.equal(
    presentation.matchesReportSearch(alert(), "không tồn tại"),
    false,
  );
  assert.equal(
    presentation.reportImage({
      ...alert(),
      fieldEvidence: [{ displayUrl: "display", originalUrl: "original" }],
    }),
    "display",
  );
});
test("progress never invents acceptance for pending, arrival for assigned or completion for rejected", () => {
  for (const status of ["PENDING", "AI_ANALYZING", "REJECTED", "unknown"])
    assert.equal(presentation.reportProgress(status), 0);
  assert.equal(presentation.reportProgress("VERIFIED"), 1);
  assert.equal(presentation.reportProgress("ASSIGNED"), 2);
  assert.equal(presentation.reportProgress("closed"), 3);
});
test("Home shows actual profile and routes all shortcuts, preview, bell and avatar", () => {
  const f = fixture("CitizenDashboardScreen");
  const hero = f.find("HomeHero");
  assert.equal(hero.props.user.fullName, profile.fullName);
  hero.props.onReport();
  hero.props.onTrack();
  const header = f.find("CitizenTopBar");
  assert.equal(header.props.unreadCount, 2);
  header.props.onNotifications();
  header.props.onProfile();
  for (const tile of f.all("CitizenActionTile")) tile.props.onPress();
  f.find(
    "Pressable",
    (p) => p.accessibilityLabel === "Mở bản đồ điểm rác",
  ).props.onPress();
  for (const route of [
    "Profile",
    "Notifications",
    "ReportTab",
    "MapTab",
    "MyReportsTab",
  ])
    assert.ok(f.calls.some((c) => c[0] === route));
  assert.ok(f.calls.some((c) => c[0] === "reports" && c[1] === profile._id));
});
test("Home does not place a fake user marker at its default map center", () => {
  const f = fixture("CitizenDashboardScreen", {
    profile: null,
    query: { data: { items: [], pages: [] } },
  });
  assert.equal(f.all("Marker").length, 0);
  assert.equal(f.find("HomeHero").props.user, null);
  assert.ok(f.text().includes("Chưa có điểm rác có tọa độ hợp lệ"));
});
test("Nearby excludes rejected/deleted/invalid coordinates and no GPS means no user marker", () => {
  const f = fixture("CitizenMapScreen", {
    query: {
      data: {
        items: [
          alert(),
          alert("rejected", "REJECTED"),
          { ...alert("deleted"), isDeleted: true },
          { ...alert("invalid"), location: { coordinates: [190, 95] } },
        ],
      },
    },
  });
  assert.equal(f.all("Marker").length, 1);
  assert.equal(f.all("Marker")[0].props.coordinate.latitude, 10.823);
});
test("Nearby status filtering, debounced search/clear and marker preview preserve real distance semantics", () => {
  const f = fixture("CitizenMapScreen", {
    query: { data: { items: [alert(), alert("done", "RESOLVED")] } },
  });
  f.find(
    "TouchableOpacity",
    (p) => text(p.children) === "Đã xử lý",
  ).props.onPress();
  f.render();
  assert.equal(f.all("Marker").length, 1);
  f.all("Marker")[0].props.onPress();
  f.render();
  assert.ok(!f.text().includes("đường thẳng"));
  f.find(
    "TouchableOpacity",
    (p) => text(p.children) === "Xem chi tiết",
  ).props.onPress();
  assert.ok(f.calls.some((c) => c[0] === "AlertDetail" && c[1].id === "done"));
  f.find("CitizenSearch").props.onChangeText("missing");
  f.render();
  f.flush();
  f.render();
  assert.equal(f.all("Marker").length, 0);
  f.find("CitizenSearch").props.onChangeText("");
  f.render();
  f.flush();
  f.render();
  assert.equal(f.all("Marker").length, 1);
});
test("Nearby denied GPS keeps incident markers; granted GPS renders actual green position", async () => {
  const f = fixture("CitizenMapScreen", { device: { error: "denied" } });
  f.find(
    "TouchableOpacity",
    (p) => p.accessibilityLabel === "Đến vị trí hiện tại",
  ).props.onPress();
  await Promise.resolve();
  f.render();
  assert.equal(f.all("Marker").length, 1);
  assert.ok(f.text().includes("cấp quyền GPS"));
  const g = fixture("CitizenMapScreen", {
    device: { coords: { type: "Point", coordinates: [106.78, 10.83] } },
  });
  const userMarker = g.find("Marker", (p) => p.title === "Bạn ở đây");
  assert.equal(userMarker.props.pinColor, "#22C55E");
  assert.equal(userMarker.props.coordinate.latitude, 10.83);
});
test("Nearby API failure offers a working retry", () => {
  const f = fixture("CitizenMapScreen", {
    query: { isError: true, data: { items: [] } },
  });
  f.find(
    "TouchableOpacity",
    (p) => text(p.children) === "Thử lại",
  ).props.onPress();
  assert.ok(f.calls.includes("refetch"));
});
test("My Reports scopes to citizen, exposes accurate server total and labels loaded status counts", () => {
  const f = fixture("MyReportsScreen");
  assert.ok(f.calls.some((c) => c[0] === "reports" && c[1] === profile._id));
  assert.equal(
    f.find("CitizenStat", (p) => p.label === "Tổng gửi").props.value,
    75,
  );
  assert.equal(
    f.find("CitizenStat", (p) => p.label === "Đang xử lý").props.value,
    0,
  );
  assert.ok(f.text().includes("báo cáo đã tải"));
  f.find(
    "TouchableOpacity",
    (p) => text(p.children) === "Tải thêm báo cáo",
  ).props.onPress();
  assert.ok(f.calls.includes("next-page"));
});
test("My Reports search, pending chip and guest state are distinct", () => {
  const f = fixture("MyReportsScreen");
  f.find("CitizenSearch").props.onChangeText("unknown");
  f.render();
  assert.equal(f.find("FlatList").props.data.length, 0);
  assert.ok(f.text().includes("Không tìm thấy báo cáo phù hợp"));
  f.find("CitizenSearch").props.onChangeText("");
  f.render();
  f.find("TouchableOpacity", (p) =>
    text(p.children).includes("Chờ tiếp nhận"),
  ).props.onPress();
  f.render();
  assert.equal(f.find("FlatList").props.data.length, 1);
  const guest = fixture("MyReportsScreen", { profile: null });
  assert.equal(guest.find("FlatList").props.data.length, 0);
  assert.ok(guest.calls.some((c) => c[0] === "reports" && c[1] === undefined));
});
test("My Reports preserves edit/delete permissions and prevents nested presses opening details", async () => {
  const f = fixture("MyReportsScreen");
  const list = f.find("FlatList");
  const tree = list.props.renderItem({ item: alert() });
  let stopped = 0;
  const edit = nodes(tree).find(
    (n) =>
      n.type === "TouchableOpacity" && text(n.props.children).trim() === "Edit",
  );
  edit.props.onPress({ stopPropagation: () => stopped++ });
  f.render();
  assert.equal(f.find("EditAlertModal").props.visible, true);
  const del = nodes(tree).find(
    (n) =>
      n.type === "TouchableOpacity" &&
      text(n.props.children).trim() === "Delete",
  );
  del.props.onPress({ stopPropagation: () => stopped++ });
  assert.equal(stopped, 2);
  await f.dialogs.at(-1)[2][1].onPress();
  assert.ok(f.calls.some((c) => c[0] === "delete"));
  const resolved = list.props.renderItem({
    item: {
      ...alert("done", "RESOLVED"),
      resolvedAt: "2026-10-10T05:00:00Z",
      resolutionEvidence: [{ url: "after" }],
    },
  });
  assert.ok(text(resolved).includes("Xem ảnh trước / sau"));
  assert.ok(!text(resolved).includes("Delete"));
  nodes(resolved)
    .find(
      (n) =>
        n.type === "TouchableOpacity" &&
        text(n.props.children).trim() === "Xem ảnh trước / sau xử lý →",
    )
    .props.onPress({ stopPropagation: () => stopped++ });
  f.render();
  const expanded = f
    .find("FlatList")
    .props.renderItem({
      item: {
        ...alert("done", "RESOLVED"),
        resolutionEvidence: [{ url: "after" }],
      },
    });
  assert.deepEqual(
    nodes(expanded)
      .filter((n) => n.type === "EvidenceImageFrame")
      .map((n) => n.props.imageUri),
    ["https://example.test/photo.jpg", "after"],
  );
});
test("My Reports offline banner keeps sync disabled without connectivity", () => {
  const f = fixture("MyReportsScreen", {
    offline: { offlineCount: 2, isOffline: true },
  });
  assert.ok(f.text().includes("ngoại tuyến"));
  assert.equal(
    f.find("TouchableOpacity", (p) =>
      text(p.children).includes("Chờ kết nối lại"),
    ).props.disabled,
    true,
  );
});
test("Settings shows real account, masked phone, real permissions and no fake identity claims", () => {
  const f = fixture("CitizenSettingsScreen");
  assert.ok(f.text().includes(profile.fullName));
  assert.ok(!f.text().includes(profile.phone));
  assert.ok(!f.text().includes("VNeID"));
  const gps = f.find("CitizenSettingsRow", (p) => p.title === "GPS & camera");
  assert.ok(gps.props.detail.includes("Chưa cấp quyền"));
  gps.props.onPress();
  assert.ok(f.calls.includes("permissions"));
  assert.equal(
    f.find("CitizenSettingsRow", (p) => p.title === "Ngôn ngữ").props.onPress,
    undefined,
  );
});
test("Settings changes real ThemeContext modes, not a cosmetic switch", async () => {
  const f = fixture("CitizenSettingsScreen");
  f.find("CitizenSettingsRow", (p) => p.title === "Giao diện").props.onPress();
  const choices = f.dialogs.at(-1)[2];
  assert.equal(choices.length, 3);
  for (const option of choices) option.onPress();
  await Promise.resolve();
  assert.deepEqual(
    f.calls.filter((c) => c[0] === "theme").map((c) => c[1]),
    ["light", "dark", "system"],
  );
  assert.match(
    source("context/ThemeContext.tsx"),
    /await storage\.setTheme\(mode\)/,
  );
});
test("Settings sign-out cancel/dismiss guards repeated taps and confirm uses shared logout", () => {
  const f = fixture("CitizenSettingsScreen");
  const button = f.find("Button", (p) => p.title === "Đăng xuất tài khoản");
  button.props.onPress();
  button.props.onPress();
  assert.equal(f.dialogs.length, 1);
  f.dialogs[0][2][0].onPress();
  assert.ok(!f.calls.includes("logout"));
  button.props.onPress();
  f.dialogs[1][3].onDismiss();
  button.props.onPress();
  f.dialogs[2][2][1].onPress();
  assert.equal(f.calls.filter((c) => c === "logout").length, 1);
  const pending = fixture("CitizenSettingsScreen", {
    logout: { isPending: true },
  });
  assert.equal(
    pending.find("Button", (p) => p.title === "Đăng xuất tài khoản").props
      .disabled,
    true,
  );
});
test("Settings guest sign-in reaches root Login, not an invalid Citizen route", () => {
  const f = fixture("CitizenSettingsScreen", { profile: null });
  f.find("Button", (p) => p.variant === "primary").props.onPress();
  assert.ok(f.calls.some((c) => c[0] === "Login"));
});

test("report launcher deduplicates rapid focus, returns Dashboard behind flow, and skips existing flow", () => {
  let focus,
    unmount,
    timer,
    active = "CitizenTabs";
  const calls = [];
  const ref = { current: null };
  const component = load(
    "features/report/ReportTabLauncherScreen.tsx",
    {
      react: {
        __esModule: true,
        default: React,
        useCallback: (fn) => fn,
        useRef: () => ref,
        useEffect: (fn) => {
          unmount = fn();
        },
      },
      "react-native": {
        View: "View",
        ActivityIndicator: "ActivityIndicator",
        StyleSheet: { create: (value) => value },
      },
      "@react-navigation/native": {
        useFocusEffect: (fn) => {
          focus = fn;
        },
      },
      "../../context/ThemeContext": { useTheme: () => ({ colors }) },
    },
    {
      setTimeout: (fn) => {
        timer = fn;
        return 1;
      },
      clearTimeout: () => {
        timer = undefined;
      },
    },
  ).ReportTabLauncherScreen;
  const root = {
    navigate: (name) => {
      calls.push(name);
      active = name;
    },
    getState: () => ({ index: 0, routes: [{ name: active }] }),
  };
  component({
    navigation: { navigate: (name) => calls.push(name), getParent: () => root },
  });
  focus();
  focus();
  timer();
  assert.equal(calls.filter((name) => name === "ReportFlow").length, 1);
  assert.equal(calls[0], "DashboardTab");
  focus();
  timer();
  assert.equal(calls.filter((name) => name === "ReportFlow").length, 1);
  active = "CitizenTabs";
  focus();
  unmount();
  assert.equal(timer, undefined);
});
