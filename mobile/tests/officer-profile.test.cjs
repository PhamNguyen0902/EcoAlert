const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { QueryClient, QueryObserver } = require("@tanstack/query-core");

function load(file, imports) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.React,
        },
      },
    ).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in imports, `unexpected dependency ${name}`);
        return imports[name];
      },
    },
  );
  return exports;
}
const colors = {
  background: "#07101F",
  surface: "#0B1628",
  primary: "#22C55E",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  divider: "rgba(148,163,184,.08)",
  greenSoft: "rgba(34,197,94,.12)",
};
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (typeof tree === "string") return tree;
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  return tree && typeof tree === "object" ? text(tree.props?.children) : "";
}
function screenFixture(overrides = {}) {
  const dialogs = [];
  let mutations = 0;
  const logout = {
    isPending: false,
    isError: false,
    mutate: () => {
      mutations++;
    },
    ...overrides.logout,
  };
  const ref = { current: false };
  const component = load("screens/officer/OfficerProfileScreen.tsx", {
    react: { __esModule: true, default: React, useRef: () => ref },
    "react-native": {
      View: "View",
      Text: "Text",
      ScrollView: "ScrollView",
      StyleSheet: { create: (value) => value, hairlineWidth: 1 },
      Alert: { alert: (...args) => dialogs.push(args) },
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 44, bottom: 34 }),
    },
    "lucide-react-native": {
      Leaf: "Leaf",
      LogOut: "LogOut",
      Mail: "Mail",
      ShieldCheck: "ShieldCheck",
    },
    "../../hooks/useAuth": {
      useProfile: () => ({
        data: {
          _id: "officer-user",
          fullName: "Nguyễn Văn Cán Bộ",
          email: "officer@example.test",
          role: "OFFICER",
        },
      }),
      useLogout: () => logout,
      ...overrides.auth,
    },
    "../../hooks/useServiceAreas": {
      useAssignedServiceAreas: () => ({
        isPending: false,
        isError: false,
        data: { pages: [{ items: [], total: 0 }] },
        hasNextPage: false,
        refetch: () => {},
        fetchNextPage: () => {},
        ...overrides.areas,
      }),
    },
    "../../context/LanguageContext": {
      useLanguage: () => ({ language: overrides.language || "vi" }),
    },
    "../../theme/useCivicTheme": { useCivicTheme: () => ({ colors }) },
    "../../components/ui/Card": { Card: "Card" },
    "../../components/ui/Button": { Button: "Button" },
    "../../components/ui/InlineBanner": { InlineBanner: "InlineBanner" },
    "../../theme/civicDesign": {
      civicRadius: { round: 999 },
      civicSpace: { lg: 16, md: 12, sm: 8, xs: 4 },
      civicStyles: { content: { padding: 16, gap: 24 } },
      civicType: {
        title: {},
        section: {},
        body: {},
        eyebrow: {},
        meta: {},
        cardTitle: {},
      },
    },
  }).OfficerProfileScreen;
  const tree = component();
  return {
    tree,
    dialogs,
    logout,
    mutations: () => mutations,
    button: nodes(tree).find(
      (node) => node.type === "Button" && node.props.variant === "destructive",
    ),
  };
}

test("Officer navigation adds typed Profile while preserving Tasks, Map and RAG assistant", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/navigation/OfficerTabNavigator.tsx"),
    "utf8",
  );
  const routes = [...source.matchAll(/<Tab\.Screen\s+name="([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(routes, [
    "OfficerTasksTab",
    "OfficerMapTab",
    "OfficerAssistantTab",
    "OfficerProfileTab",
  ]);
  assert.match(source, /createBottomTabNavigator<OfficerTabParamList>/);
  assert.match(source, /component=\{OfficerProfileScreen\}/);
  for (const label of ["Nhiệm vụ", "Bản đồ", "Cá nhân"])
    assert.ok(source.includes(label));
  assert.match(source, /UserCircle2 color=\{color\}/);
});

test("profile shows actual account name/email, officer role and no invented assigned area", () => {
  const screen = screenFixture();
  const content = text(screen.tree);
  assert.match(content, /Thông tin cán bộ/);
  assert.match(content, /Nguyễn Văn Cán Bộ/);
  assert.match(content, /officer@example.test/);
  assert.match(content, /Cán bộ/);
  assert.match(content, /Khu vực phụ trách/);
  assert.match(content, /Chưa được phân công khu vực/);
  assert.doesNotMatch(content, /Phường A|Phường B|gửi và theo dõi báo cáo/);
  assert.equal(screen.button.props.variant, "destructive");
});

test("assigned areas use actual API names, support errors/loading/pagination and preserve sign-out", () => {
  const screen = screenFixture({
    areas: {
      data: {
        pages: [
          {
            items: [
              {
                _id: "test-area",
                name: "Tên khu vực từ API",
                code: "TEST-AREA",
                administrativeLevel: "WARD",
              },
            ],
            total: 30,
          },
        ],
      },
      hasNextPage: true,
    },
  });
  assert.match(text(screen.tree), /Tên khu vực từ API/);
  assert.match(text(screen.tree), /TEST-AREA/);
  assert.ok(
    nodes(screen.tree).some(
      (n) => n.type === "Button" && n.props.title === "Xem thêm khu vực",
    ),
  );
  assert.equal(screen.button.props.title, "Đăng xuất");
  assert.match(
    text(screenFixture({ areas: { isPending: true } }).tree),
    /Đang tải khu vực/,
  );
  assert.equal(
    nodes(screenFixture({ areas: { isError: true } }).tree).find(
      (n) => n.type === "InlineBanner",
    ).props.message,
    "Không tải được khu vực. Vui lòng thử lại.",
  );
});

test("Cancel never logs out; Confirm invokes only the shared logout mutation", () => {
  const screen = screenFixture();
  screen.button.props.onPress();
  assert.equal(screen.mutations(), 0);
  assert.equal(screen.dialogs[0][0], "Đăng xuất khỏi EcoAlert?");
  assert.equal(
    screen.dialogs[0][1],
    "Bạn sẽ cần đăng nhập lại để tiếp tục xử lý nhiệm vụ.",
  );
  const cancel = screen.dialogs[0][2].find(
    (action) => action.style === "cancel",
  );
  cancel.onPress();
  assert.equal(screen.mutations(), 0);
  screen.button.props.onPress();
  const confirm = screen.dialogs[1][2].find(
    (action) => action.style === "destructive",
  );
  confirm.onPress();
  assert.equal(screen.mutations(), 1);
});

test("rapid taps cannot stack dialogs and Android dismissal allows retry", () => {
  const screen = screenFixture();
  screen.button.props.onPress();
  screen.button.props.onPress();
  assert.equal(screen.dialogs.length, 1);
  screen.dialogs[0][3].onDismiss();
  screen.button.props.onPress();
  assert.equal(screen.dialogs.length, 2);
});

test("pending logout disables the button and prevents another dialog/mutation", () => {
  const screen = screenFixture({ logout: { isPending: true } });
  assert.equal(screen.button.props.disabled, true);
  assert.equal(screen.button.props.loading, true);
  assert.equal(screen.button.props.title, "Đang đăng xuất...");
  screen.button.props.onPress();
  assert.equal(screen.dialogs.length, 0);
  assert.equal(screen.mutations(), 0);
});

test("future mutation errors show a simple retry message and English copy remains role-specific", () => {
  const screen = screenFixture({ logout: { isError: true } });
  const banner = nodes(screen.tree).find(
    (node) => node.type === "InlineBanner",
  );
  assert.equal(banner.props.message, "Không thể đăng xuất. Vui lòng thử lại.");
  const english = screenFixture({ language: "en" });
  assert.match(text(english.tree), /Officer profile/);
  english.button.props.onPress();
  assert.match(english.dialogs[0][1], /continue handling tasks/);
});

test("Officer profile does not duplicate storage, API calls or navigation on logout", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/screens/officer/OfficerProfileScreen.tsx"),
    "utf8",
  );
  assert.match(source, /useProfile, useLogout/);
  assert.match(source, /logout\.mutate\(\)/);
  assert.doesNotMatch(
    source,
    /storage\.|clearAll|removeToken|api\.|navigate\(|\bany\b|@ts-ignore|@ts-expect-error/,
  );
});

test("Officer confirmation reuses actual auth/storage/cache path even when Gateway is offline", async () => {
  const client = new QueryClient();
  const saved = new Map([
    ["ecoalert_access_token", "officer-token"],
    ["ecoalert_refresh_token", "officer-refresh"],
    ["ecoalert_user", JSON.stringify({ _id: "officer-user", role: "OFFICER" })],
    ["ecoalert_theme", "dark"],
    ["ecoalert_language", "vi"],
  ]);
  const storage = load("utils/storage.ts", {
    "react-native": { Platform: { OS: "ios" } },
    "expo-secure-store": {
      getItemAsync: async (key) => saved.get(key) ?? null,
      setItemAsync: async (key, value) => saved.set(key, value),
      deleteItemAsync: async (key) => saved.delete(key),
    },
  }).storage;
  const authService = load("api/authService.ts", {
    "./client": { api: {} },
    "../utils/storage": { storage },
    "../utils/constants": { API_BASE_URL: "http://test.invalid/api" },
    axios: {
      __esModule: true,
      default: {
        post: async () => {
          throw new Error("Gateway offline");
        },
      },
    },
  }).authService;
  client.setQueryData(["profile"], { _id: "officer-user", role: "OFFICER" });
  const observer = new QueryObserver(client, {
    queryKey: ["profile"],
    enabled: false,
    queryFn: async () => null,
  });
  const unsubscribe = observer.subscribe(() => {});
  let mutation;
  const auth = load("hooks/useAuth.ts", {
    "../api/authService": { authService },
    "../utils/storage": { storage },
    "@tanstack/react-query": {
      useQueryClient: () => client,
      useMutation: (options) => ({
        isPending: false,
        isError: false,
        mutate: () => {
          mutation = options.mutationFn().then(options.onSuccess);
        },
      }),
    },
  });
  const screen = screenFixture({
    auth: {
      useLogout: auth.useLogout,
      useProfile: () => ({
        data: { _id: "officer-user", fullName: "Officer", role: "OFFICER" },
      }),
    },
  });
  screen.button.props.onPress();
  screen.dialogs[0][2]
    .find((action) => action.style === "destructive")
    .onPress();
  await mutation;
  assert.equal(await storage.getToken(), null);
  assert.equal(await storage.getRefreshToken(), null);
  assert.equal(await storage.getUser(), null);
  assert.equal(client.getQueryData(["profile"]), null);
  assert.equal(observer.getCurrentResult().data, null); // Root auth branch becomes Login.
  assert.equal(await storage.getTheme(), "dark");
  assert.equal(await storage.getLanguage(), "vi");
  auth.useLogin(); // Existing login hook remains available; session suite covers all roles.
  unsubscribe();
  client.clear();
});
