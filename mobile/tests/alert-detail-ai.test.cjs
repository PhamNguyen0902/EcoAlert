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
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 } },
    ).outputText,
    { exports, require(name) {
      assert.ok(name in imports, `Unexpected import: ${name}`);
      return imports[name];
    } },
  );
  return exports;
}
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children), ...nodes(tree.props?.trailing)];
}
function text(tree) {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  if (!tree || typeof tree !== "object") return "";
  // Render the real summary card's pure Metric components too.
  if (typeof tree.type === "function") return text(tree.type(tree.props));
  return text(tree.props?.children);
}
const presentation = load("utils/incidentPresentation.ts");
const ai = load("utils/aiAnalysis.ts", { "./incidentPresentation": presentation });
const colors = { text: "#FFF", textMuted: "#94A3B8", primary: "#10B981", surface: "#0E1726" };
const design = { civicStyles: {}, civicType: {}, civicSpace: { lg: 16, xl: 20, sm: 8, md: 12, xs: 4 }, civicRadius: { card: 16 }, getCivicColors: () => colors };
const native = {
  View: "View", Text: "Text", ScrollView: "ScrollView", TouchableOpacity: "TouchableOpacity",
  ActivityIndicator: "ActivityIndicator", StyleSheet: { create: (value) => value },
};
const icons = new Proxy({}, { get: (_, key) => String(key) });
function fixture(options = {}) {
  const calls = [], dialogs = [], states = [];
  let cursor = 0;
  const alert = {
    _id: "report-1", citizenId: "citizen-1", title: "Điểm rác", description: "Mô tả của người dân",
    status: "PENDING", category: "illegal_dumping", severity: "MEDIUM", aiAnalysisStatus: "COMPLETED",
    aiSummary: "Tóm tắt cũ không được render thêm",
    location: { type: "Point", coordinates: [106.775, 10.823] }, address: "Nguyễn Văn Bảo",
    mediaUrls: ["https://example.test/original.jpg"],
    aiOverallAnalysis: {
      overallSummary: "Tóm tắt tổng quan từ API", shortReason: "Có vật liệu rác tại hiện trường",
      categorySuggestion: "illegal_dumping", categoryConfidence: 0.7, severity: "MEDIUM",
      confidenceTier: "REVIEW_REQUIRED", isIncident: true,
    },
    visionEvidence: [{ imageUrl: "https://example.test/original.jpg", detections: [
      { materialClass: "cardboard" }, { materialClass: "plastic_bag" }, { materialClass: "cardboard" },
    ] }],
    ...options.alert,
  };
  const language = { useLanguage: () => ({ language: "vi", t: (key, fallback) => key === "aiAnalysis.title" ? "Phân tích AI" : fallback }) };
  const { OverallAiAnalysisCard } = load("components/ai/OverallAiAnalysisCard.tsx", {
    react: React, "react-native": native, "lucide-react-native": icons,
    "../../theme/civicDesign": design,
    "../../context/ThemeContext": { useTheme: () => ({ colors, isDark: true }) },
    "../../context/LanguageContext": language, "../ui/Card": { Card: "Card" },
    "../../utils/incidentPresentation": presentation,
  });
  const mutation = { mutate() {}, isPending: false };
  const imports = {
    react: { ...React, useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = value; }];
    } },
    "react-native": { ...native, Platform: { OS: options.platform || "ios" }, Alert: { alert: (...args) => dialogs.push(args) } },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) },
    "react-native-maps": { __esModule: true, default: "MapView", Marker: "Marker", PROVIDER_GOOGLE: "google" },
    "lucide-react-native": icons,
    "../../hooks/useAlerts": {
      useAlert: (id) => { calls.push(["get", id]); return { data: alert }; },
      useAssignOfficer: () => mutation,
      useDeleteAlert: () => ({ ...mutation, mutateAsync: async (id) => calls.push(["delete", id]) }),
      useRestoreAlert: () => mutation,
    },
    "../../hooks/useAuth": { useProfile: () => ({ data: { _id: options.userId || "citizen-1", role: "CITIZEN" } }) },
    "../../hooks/useUsers": { useUser: () => ({}), useOfficers: () => ({ data: [] }) },
    "../../theme/civicDesign": design,
    "../../components/ui/Card": { Card: "Card" }, "../../components/ui/Badge": { Badge: "Badge" },
    "../../components/ui/Button": { Button: "Button" },
    "../../components/ai/OverallAiAnalysisCard": { OverallAiAnalysisCard },
    "../../utils/visionBoundingBox": { matchVisionEvidence: () => [] },
    "../../theme/useCivicTheme": { useCivicTheme: () => ({ colors, isDark: true }) },
    "../../context/LanguageContext": language,
    "../../utils/constants": { SEVERITY_COLORS: {} }, "../../utils/aiAnalysis": ai,
    "date-fns": require("date-fns"), "date-fns/locale": require("date-fns/locale"),
  };
  for (const [folder, name] of [
    ["admin", "OfficerPickerModal"], ["modals", "CloseIncidentModal"], ["modals", "EditAlertModal"],
    ["citizen", "CitizenHeader"], ["media", "EvidenceImageFrame"], ["vision", "WasteDetectionEvidence"],
  ]) imports[`../../components/${folder}/${name}`] = { [name]: name };
  const { AlertDetailScreen } = load("screens/citizen/AlertDetailScreen.tsx", imports);
  const render = () => {
    cursor = 0;
    return AlertDetailScreen({ route: { params: { id: alert._id } }, navigation: { goBack: () => calls.push(["back"]) } });
  };
  return { alert, render, tree: render(), calls, dialogs, OverallAiAnalysisCard };
}

for (const platform of ["ios", "android"]) {
  test(`${platform}: only original overall AI card renders directly after description with real API fields`, () => {
    const f = fixture({ platform });
    const scroll = nodes(f.tree).find((node) => node.type === "ScrollView");
    const children = scroll.props.children.flat().filter(Boolean);
    const cards = children.filter((node) => node.type === f.OverallAiAnalysisCard);
    assert.equal(cards.length, 1);
    const index = children.indexOf(cards[0]);
    assert.equal(children[index - 1].type, "Card");
    assert.equal(text(children[index - 1]), "Mô tả Mô tả của người dân");
    assert.equal(cards[0].props.alert, f.alert);
    assert.equal(cards[0].props.appearance, "civic");
    const content = text(cards[0]).replace(/\s+/g, " ").replace(/\s+:/g, ":");
    assert.match(content, /AI phân tích tổng quan/);
    assert.doesNotMatch(text(f.tree), /Phân tích AI|Tóm tắt cũ không được render thêm|AI supports incident triage/);
    for (const value of ["YOLO phát hiện: 3", "cardboard, plastic_bag", "Tóm tắt tổng quan từ API",
      "Có vật liệu rác tại hiện trường", "Danh mục AI", "Xả rác không đúng nơi quy định", "70%", "Trung bình", "Cần xác nhận"]) {
      assert.ok(content.includes(value), `Missing real summary field: ${value}`);
    }
    assert.deepEqual(f.calls[0], ["get", f.alert._id]);
  });
}

test("missing/failed AI keeps the unchanged overall-card behavior without inventing data", () => {
  const legacy = fixture({ alert: { aiOverallAnalysis: undefined, aiAnalysisMode: "YOLO" } });
  assert.doesNotMatch(text(legacy.tree), /Phân tích AI|70%|Tóm tắt cũ không được render thêm/);
  const failed = fixture({ alert: { aiOverallAnalysis: undefined, aiAnalysisMode: "FAILED", aiFailureReason: "Dịch vụ tạm thời gián đoạn" } });
  assert.match(text(failed.tree), /AI phân tích tổng quan/);
  assert.match(text(failed.tree), /Dịch vụ tạm thời gián đoạn/);
});

test("removing duplicate UI preserves citizen edit/delete permissions and handlers", async () => {
  const f = fixture();
  const edit = nodes(f.tree).find((node) => node.props?.accessibilityLabel === "Sửa báo cáo");
  edit.props.onPress();
  const modal = nodes(f.render()).find((node) => node.type === "EditAlertModal");
  assert.equal(modal.props.visible, true);
  assert.equal(modal.props.alert, f.alert);
  nodes(f.tree).find((node) => node.props?.accessibilityLabel === "Xóa báo cáo").props.onPress();
  assert.equal(f.dialogs.length, 1);
  await f.dialogs[0][2].find((button) => button.style === "destructive").onPress();
  assert.deepEqual(f.calls.slice(-2), [["delete", f.alert._id], ["back"]]);
  const other = fixture({ userId: "another-citizen" });
  assert.equal(nodes(other.tree).some((node) => ["Sửa báo cáo", "Xóa báo cáo"].includes(node.props?.accessibilityLabel)), false);
});
