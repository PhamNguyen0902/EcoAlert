const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

function fixture({ language = "vi", pending = false, error = false } = {}) {
  const dialogs = [];
  let mutations = 0;
  const imports = {
    react: {
      __esModule: true, default: React,
      useMemo: (fn) => fn(), useRef: () => ({ current: false }),
      useState: (value) => [value, () => {}],
    },
    "react-native": {
      ActivityIndicator: "ActivityIndicator", FlatList: "FlatList",
      RefreshControl: "RefreshControl", Text: "Text", View: "View",
      TouchableOpacity: "TouchableOpacity",
      StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
      Alert: { alert: (...args) => dialogs.push(args) },
    },
    "lucide-react-native": Object.fromEntries(
      ["AlertTriangle", "ChevronRight", "Filter", "LogOut", "MapPin"].map((key) => [key, key]),
    ),
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 44 }) },
    "../../hooks/useAlerts": {
      useCategories: () => ({ data: [] }),
      useAlerts: () => ({ data: { items: [] }, isLoading: true, refetch: () => {} }),
    },
    "../../hooks/useAuth": {
      useLogout: () => ({ isPending: pending, isError: error, mutate: () => { mutations++; } }),
    },
    "../../components/ui/Badge": { Badge: "Badge" },
    "../../components/ui/Card": { Card: "Card" },
    "../../components/ui/Button": { Button: "Button" },
    "../../components/ui/InlineBanner": { InlineBanner: "InlineBanner" },
    "../../context/LanguageContext": { useLanguage: () => ({ language }) },
    "../../context/ThemeContext": {
      useTheme: () => ({ isDark: true, colors: { background: "#0E1726", surface: "#0E1726", text: "#fff", textMuted: "#94A3B8", border: "#334155" } }),
    },
    "../../utils/constants": { SEVERITY_COLORS: {}, STATUS_COLORS: {} },
    "../../utils/incidentPresentation": {
      getCategoryLabel: (value) => value,
      getSeverityLabel: (value) => value,
      getStatusLabel: (value) => value,
    },
  };
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, "../src/screens/admin/AdminIncidentsScreen.tsx"), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, {
    exports,
    require: (key) => {
      assert.ok(key in imports, `Unexpected dependency: ${key}`);
      return imports[key];
    },
  });
  const tree = exports.AdminIncidentsScreen({ navigation: {} });
  return {
    tree, dialogs, mutations: () => mutations,
    button: nodes(tree).find((node) => node.type === "Button" && node.props.variant === "destructive"),
  };
}

test("Admin can sign out from the header even while incidents are loading", () => {
  const screen = fixture();
  assert.equal(screen.button.props.title, "Đăng xuất");
  screen.button.props.onPress();
  screen.button.props.onPress();
  assert.equal(screen.dialogs.length, 1);
  assert.equal(screen.mutations(), 0);
  screen.dialogs[0][2].find((action) => action.style === "destructive").onPress();
  assert.equal(screen.mutations(), 1);
});

test("cancel or dismiss keeps the session and allows a later confirmation", () => {
  const screen = fixture();
  screen.button.props.onPress();
  screen.dialogs[0][2].find((action) => action.style === "cancel").onPress();
  assert.equal(screen.mutations(), 0);
  screen.button.props.onPress();
  screen.dialogs[1][3].onDismiss();
  screen.button.props.onPress();
  assert.equal(screen.dialogs.length, 3);
  assert.equal(screen.mutations(), 0);
});

test("pending sign-out prevents repeat requests and exposes loading state", () => {
  const screen = fixture({ pending: true });
  assert.equal(screen.button.props.disabled, true);
  assert.equal(screen.button.props.loading, true);
  assert.equal(screen.button.props.accessibilityState.busy, true);
  assert.equal(screen.button.props.title, "Đang đăng xuất...");
  screen.button.props.onPress();
  assert.equal(screen.dialogs.length, 0);
});

test("Admin sign-out supports English and displays mutation failures", () => {
  const screen = fixture({ language: "en", error: true });
  assert.equal(screen.button.props.title, "Sign out");
  const banner = nodes(screen.tree).find((node) => node.type === "InlineBanner");
  assert.equal(banner.props.message, "Unable to sign out. Please try again.");
  screen.button.props.onPress();
  assert.match(screen.dialogs[0][1], /continue managing incidents/);
});
