const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.React,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      require(name) {
        assert.ok(name in imports, name);
        return imports[name];
      },
    },
  );
  return exports;
}
const presentation = load("utils/notificationPresentation.ts");
test("cached fallback catalog stays aligned with the canonical backend templates", () => {
  const output = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(
        path.resolve(
          __dirname,
          "../../backend/notification-service/src/utils/notification-content.ts",
        ),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    { exports: output },
  );
  for (const [type, [title, message]] of Object.entries(
    output.contentCatalog,
  )) {
    const actual = presentation.notificationPresentation({
      type,
      title: "old",
      message: "old",
    });
    assert.equal(actual.title, title);
    assert.equal(actual.message, message);
  }
});
const navigationUtils = load("utils/notificationNavigation.ts");
const item = (extra = {}) => ({
  _id: "notice",
  recipientId: "citizen",
  title: "Incident resolved",
  message: "Incident 507f1f77bcf86cd799439015 resolved",
  alertId: "507f1f77bcf86cd799439015",
  eventId: "uuid",
  isRead: false,
  createdAt: new Date().toISOString(),
  ...extra,
});
const nodes = (tree) =>
  !tree || typeof tree !== "object"
    ? []
    : Array.isArray(tree)
      ? tree.flatMap(nodes)
      : [
          tree,
          ...nodes(tree.props?.children),
          ...nodes(tree.props?.ListEmptyComponent),
          ...nodes(tree.props?.ListFooterComponent),
        ];
const text = (tree) =>
  typeof tree === "string" || typeof tree === "number"
    ? String(tree)
    : Array.isArray(tree)
      ? tree.map(text).join(" ")
      : tree && typeof tree === "object"
        ? text(tree.props?.children)
        : "";
function fixture(options = {}) {
  const calls = [],
    dialogs = [],
    state = [],
    refs = [];
  let s = 0,
    r = 0,
    tree;
  const hookReact = {
    __esModule: true,
    default: React,
    useMemo: (fn) => fn(),
    useRef: (value) => (refs[r++] ||= { current: value }),
    useState: (initial) => {
      const index = s++;
      if (!(index in state)) state[index] = initial;
      return [
        state[index],
        (value) => {
          state[index] =
            typeof value === "function" ? value(state[index]) : value;
        },
      ];
    },
  };
  const query = {
    data: { pages: [{ items: [item()] }] },
    refetch: async () => calls.push("refresh"),
    fetchNextPage: async () => calls.push("next"),
    hasNextPage: true,
    ...options.query,
  };
  const mark = options.mark || (async (id) => calls.push(["read", id]));
  const native = Object.fromEntries(
    [
      "ActivityIndicator",
      "FlatList",
      "RefreshControl",
      "Text",
      "TouchableOpacity",
      "View",
    ].map((name) => [name, name]),
  );
  const { CitizenNotificationsScreen: Screen } = load(
    "screens/citizen/CitizenNotificationsScreen.tsx",
    {
      react: hookReact,
      "react-native": {
        ...native,
        StyleSheet: { create: (v) => v },
        Alert: { alert: (...args) => dialogs.push(args) },
      },
      "lucide-react-native": new Proxy(
        {},
        { get: (_target, name) => String(name) },
      ),
      "date-fns": require("date-fns"),
      "date-fns/locale": require("date-fns/locale"),
      "react-native-safe-area-context": {
        useSafeAreaInsets: () => ({ top: 0, bottom: 34 }),
      },
      "../../components/citizen/CitizenHeader": {
        CitizenHeader: "CitizenHeader",
      },
      "../../hooks/useAuth": {
        useProfile: () => ({ data: { _id: "citizen" } }),
      },
      "../../context/LanguageContext": {
        useLanguage: () => ({ language: "vi" }),
      },
      "../../theme/useCivicTheme": {
        useCivicTheme: () => ({
          colors: {
            primary: "#22C55E",
            danger: "#F87171",
            cyan: "#38BDF8",
            warning: "#F59E0B",
          },
        }),
      },
      "../../theme/civicDesign": { civicStyles: {}, civicType: {} },
      "../../utils/notificationNavigation": navigationUtils,
      "../../utils/notificationPresentation": presentation,
      "../../hooks/useNotifications": {
        useInfiniteNotifications: () => query,
        useUnreadNotificationCount: () => ({
          data: 1,
          refetch: () => calls.push("unread"),
        }),
        useMarkNotificationRead: () => ({ mutateAsync: mark }),
        useMarkAllNotificationsRead: () => ({
          mutateAsync: async () => calls.push("all"),
        }),
        useDeleteNotification: () => ({
          mutateAsync: async (id) => calls.push(["delete", id]),
        }),
      },
    },
  );
  const render = () => {
    s = r = 0;
    tree = Screen({
      navigation: {
        navigate: (...args) => calls.push(["navigate", ...args]),
        goBack() {},
      },
    });
    return tree;
  };
  const list = () => nodes(tree).find((n) => n.type === "FlatList");
  const card = (value) => list().props.renderItem({ item: value || item() });
  render();
  return { render, list, card, calls, dialogs, tree: () => tree };
}
test("legacy and unknown presentation hide technical values without inferring unknown states", () => {
  for (const title of [
    "Incident resolved",
    "Incident closed",
    "New incident assigned",
    "Alert Status Update",
    "Officer Alert: UNCLASSIFIED",
  ]) {
    const value = presentation.notificationPresentation(item({ title }));
    assert.doesNotMatch(
      value.title + value.message,
      /[a-f\d]{24}|UNCLASSIFIED|Incident/,
    );
  }
  assert.equal(
    presentation.notificationPresentation(item({ title: "unknown" })).type,
    "GENERAL",
  );
  assert.match(
    presentation.notificationPresentation(item()).message,
    /chờ quản trị viên/,
  );
  assert.equal(
    presentation.notificationPresentation(item({ type: "REJECTED" })).tone,
    "danger",
  );
  assert.equal(
    presentation.notificationPresentation(
      item({ type: "OFFICER_STARTED_HANDLING" }),
    ).tone,
    "info",
  );
});

test("notification pagination waits for current requests and never cancels background refetch", () => {
  for (const flag of ["isFetching", "isRefetching", "isFetchingNextPage"]) {
    const f = fixture({ query: { [flag]: true } });
    const footer = f.list().props.ListFooterComponent;
    assert.equal(footer.props.disabled, true);
    assert.equal(footer.props.accessibilityState.busy, true);
    footer.props.onPress();
    assert.equal(f.calls.includes("next"), false);
    assert.equal(f.calls.includes("refresh"), false);
  }
  let options;
  const f = fixture({ query: { fetchNextPage: (value) => { options = value; } } });
  f.list().props.ListFooterComponent.props.onPress();
  assert.equal(options.cancelRefetch, false);
});
test("notification card displays localized text, type icon, unread marker and valid detail CTA", () => {
  const f = fixture(),
    card = f.card();
  assert.match(text(card), /Điểm rác đã được xử lý/);
  assert.match(text(card), /Xem báo cáo/);
  assert.ok(nodes(card).some((n) => n.type === "CheckCircle2"));
  assert.ok(
    nodes(card).some((n) => n.props?.accessibilityLabel === "Chưa đọc"),
  );
  assert.equal(
    nodes(card).find((n) => n.type === "Text" && n.props.numberOfLines === 2)
      .props.numberOfLines,
    2,
  );
  assert.doesNotMatch(text(card), /507f1f|Incident resolved/);
  assert.equal(f.list().props.contentContainerStyle[1].paddingBottom, 58);
});
test("tap marks read then opens actual alert; rapid duplicate taps are guarded", async () => {
  let release;
  const calls = [];
  const f = fixture({
    mark: async (id) => {
      calls.push(id);
      await new Promise((resolve) => (release = resolve));
    },
  });
  const tap = nodes(f.card()).find((n) => n.type === "TouchableOpacity").props
    .onPress;
  tap();
  tap();
  assert.equal(calls.length, 1);
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.calls.filter((c) => c[0] === "navigate").length, 1);
  assert.equal(f.calls.at(-1)[1], "AlertDetail");
});
test("missing entity marks read without using eventId as report ID; delete requires confirmation", async () => {
  const f = fixture(),
    card = f.card(
      item({ alertId: undefined, eventId: "507f1f77bcf86cd799439015" }),
    );
  assert.doesNotMatch(text(card), /Xem báo cáo/);
  nodes(card)
    .find((n) => n.type === "TouchableOpacity")
    .props.onPress();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    f.calls.some((c) => c[0] === "navigate"),
    false,
  );
  nodes(card)
    .find((n) => n.props?.accessibilityLabel?.startsWith("Xóa thông báo:"))
    .props.onPress();
  assert.equal(
    f.calls.some((c) => c[0] === "delete"),
    false,
  );
  assert.equal(f.dialogs[0][0], "Xóa thông báo này?");
  f.dialogs[0][2][1].onPress();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(f.calls.some((c) => c[0] === "delete"));
});
test("refresh, pagination, mark-all, loading, error/retry and empty states remain functional", async () => {
  const f = fixture();
  f.list().props.refreshControl.props.onRefresh();
  f.list().props.ListFooterComponent.props.onPress();
  nodes(f.tree())
    .find((n) => n.type === "CitizenHeader")
    .props.trailing.props.onPress();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.calls, ["refresh", "unread", "next", "all"]);
  for (const [query, expected] of [
    [{ isLoading: true }, "Đang tải thông báo"],
    [{ isError: true }, "Không tải được thông báo"],
    [{}, "Chưa có thông báo"],
  ]) {
    const state = fixture({ query });
    assert.match(
      text(state.list().props.ListEmptyComponent),
      new RegExp(expected),
    );
    if (query.isError) {
      state.list().props.ListFooterComponent.props.onPress();
      assert.ok(state.calls.includes("refresh"));
    }
  }
});
test("long body can expand and collapse without opening a report", () => {
  const f = fixture();
  const base = presentation.notificationPresentation(
    item({ type: "AI_ANALYZED" }),
  );
  const longItem = item({
    type: "AI_ANALYZED",
    title: base.title,
    message: `${base.message} Báo cáo: “Rác tập trung ven đường Nguyễn Văn Bảo, cần kiểm tra và xử lý”.`,
  });
  const toggle = nodes(f.card(longItem)).find(
    (n) => n.props?.accessibilityLabel === "Xem đầy đủ nội dung",
  );
  assert.ok(toggle);
  toggle.props.onPress();
  f.render();
  assert.ok(
    nodes(f.card(longItem)).some(
      (n) => n.props?.accessibilityLabel === "Thu gọn nội dung",
    ),
  );
  assert.equal(f.calls.length, 0);
});
