const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");

const ROOT = path.join(__dirname, "../src/features/report");
function load(file, imports) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path.join(ROOT, file), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    {
      exports,
      Date,
      console,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      require: (name) => {
        assert.ok(name in imports, `Unexpected import ${name}`);
        return imports[name];
      },
    },
  );
  return exports;
}
const fieldTypes = load("types.ts", {});
const presentation = load("components/stitch/fieldPresentation.ts", {
  "../../types": fieldTypes,
});
const rn = {
  StyleSheet: { create: (v) => v, absoluteFill: {} },
  Platform: { OS: "ios" },
  Animated: {
    View: "AnimatedView",
    Value: class {
      constructor(v) {
        this.value = v;
      }
      setValue(v) {
        this.value = v;
      }
      interpolate() {
        return 0;
      }
    },
    timing: () => ({ start() {}, stop() {} }),
  },
};
for (const name of [
  "View",
  "Text",
  "TextInput",
  "ScrollView",
  "Pressable",
  "TouchableOpacity",
  "ActivityIndicator",
  "KeyboardAvoidingView",
  "Image",
  "Modal",
])
  rn[name] = name;
const icons = new Proxy({}, { get: (_, name) => String(name) });
const { fieldColors: colors, fieldStyles } = load(
  "components/stitch/fieldDesign.ts",
  { "react-native": rn },
);
Object.assign(colors, {
  card: colors.elevated,
  textMuted: colors.muted,
  textSecondary: colors.secondary,
  accent: colors.amber,
  destructive: colors.red,
  greenSoft: "#123",
  cyanSoft: "#123",
});
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  return tree && typeof tree === "object" ? text(tree.props?.children) : "";
}
const plain = (v) => JSON.parse(JSON.stringify(v));
const tick = () => new Promise((resolve) => setImmediate(resolve));
const id = "6aba312e932b5c69f65c2958";
const location = () => ({
  latitude: 10.823,
  longitude: 106.775,
  accuracyMeters: 12,
  capturedAt: new Date(Date.now() - 1000).toISOString(),
  source: "DEVICE_GPS",
  address: "27 Nguyễn Văn Bảo, Thành phố Hồ Chí Minh",
});
function draft() {
  return {
    location: location(),
    capture: {
      originalLocalUri: "file:///original.jpg",
      displayLocalUri: "file:///display.jpg",
      capturedAt: new Date().toISOString(),
      width: 1200,
      height: 1600,
    },
    title: "Điểm rác tại hiện trường",
    description: "Rác thải tập kết bên đường cần thu gom.",
    imageValidation: {
      state: "VALID",
      detectedObjects: [
        { label: "plastic_bag", confidence: 0.82, bbox: [100, 100, 300, 300] },
      ],
      backendValidation: {
        decision: "VALID",
        confidence: 0.82,
        model: "YOLO",
        validatedAt: new Date().toISOString(),
      },
    },
  };
}
function fixture(screen, options = {}) {
  let current = options.draft || draft(),
    tree,
    cursor = 0,
    refCursor = 0;
  const states = [],
    refs = [],
    effects = [],
    calls = [];
  const hooks = {
    ...React,
    useState: (initial) => {
      const index = cursor++;
      if (!(index in states))
        states[index] = typeof initial === "function" ? initial() : initial;
      return [
        states[index],
        (value) => {
          states[index] =
            typeof value === "function" ? value(states[index]) : value;
        },
      ];
    },
    useRef: (initial) => {
      const index = refCursor++;
      return refs[index] || (refs[index] = { current: initial });
    },
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useEffect: (fn) => effects.push(fn),
  };
  const record =
    (name) =>
    async (...args) => {
      calls.push([name, ...args]);
      return options[name] ? options[name](...args) : undefined;
    };
  const created = {
    _id: id,
    status: "PENDING",
    address: current.location?.address,
    createdAt: new Date().toISOString(),
  };
  const context = {
    useFieldReport: () => ({
      draft: current,
      setDraft: (update) => {
        current = typeof update === "function" ? update(current) : update;
      },
      resetDraft: () => {
        calls.push(["reset"]);
        current = fieldTypes.createEmptyFieldReportDraft();
      },
    }),
  };
  const service = {
    uploadMedia: async (...args) => {
      calls.push(["upload", ...args]);
      return options.upload
        ? options.upload(...args)
        : "https://example.test/original.jpg";
    },
    analyzeUploadedImage: async () =>
      options.vision || {
        status: "ok",
        detections: [
          {
            materialClass: "plastic_bag",
            confidence: 0.8,
            bbox: [100, 100, 300, 300],
          },
        ],
        requiresManualReview: options.manual || false,
      },
    validateImageSemantics: async () => {
      if (options.semanticError) throw Error("semantic down");
      return (
        options.semantic || {
          category: "illegal_dumping",
          severity: "HIGH",
          incidentConfidence: 0.9,
          overallSummary: "Rác bị tập kết bên đường",
          model: "vision",
        }
      );
    },
  };
  const locationState = {
    coords: null,
    accuracyMeters: null,
    capturedAt: null,
    source: null,
    address: "",
    addressResolved: false,
    loading: false,
    error: null,
    fetchLocation: record("fetchLocation"),
    ...options.locationState,
  };
  const components = [
    "ReportHeader",
    "ReportProgress",
    "ReportScreenIntro",
    "ReportBottomActions",
    "ReportEvidenceImage",
    "WasteDetectionChips",
  ];
  const imports = {
    react: hooks,
    "react-native": {
      ...rn,
      useWindowDimensions: () => ({
        width: options.width || 390,
        height: options.height || 844,
      }),
      Linking: { openSettings: record("settings") },
    },
    "lucide-react-native": icons,
    "expo-linear-gradient": { LinearGradient: "LinearGradient" },
    "expo-clipboard": { setStringAsync: record("copy") },
    "expo-camera": {
      CameraView: "CameraView",
      useCameraPermissions: () => [
        options.permission === undefined
          ? { granted: true }
          : options.permission,
        record("permission"),
      ],
    },
    "@react-navigation/native": { useIsFocused: () => true },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 44, bottom: 34 }),
    },
    "../../../theme/civicDesign": {
      civicSpace: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, section: 24 },
      civicRadius: { card: 16, major: 18, round: 999, button: 12 },
      civicType: {},
      civicStyles: {},
    },
    "../useReportTheme": { useReportTheme: () => ({ colors }) },
    "../FieldReportContext": context,
    "../types": fieldTypes,
    "../utils": {
      formatAlertReference: (v) => `#ECO-${v.slice(-6).toUpperCase()}`,
    },
    "../../../hooks/useLocation": { useLocation: () => locationState },
    "../../../hooks/useOfflineSync": {
      useOfflineSync: () => ({ isOffline: options.offline || false }),
    },
    "../../../hooks/useAlerts": {
      useCheckNearbyAlerts: () => ({ data: options.nearby || [] }),
      useConfirmAlert: () => ({
        mutateAsync: record("confirmExisting"),
        isPending: false,
      }),
      useCreateAlert: () => ({
        mutateAsync: async (data) => {
          calls.push(["create", data]);
          return options.create ? options.create(data) : created;
        },
      }),
      useAlert: (queriedId) => {
        calls.push(["getAlert", queriedId]);
        return { data: options.serverAlert };
      },
    },
    "../../../api/alertService": { alertService: service },
    "../../../utils/offlineQueue": {
      offlineQueue: { saveOfflineDraft: record("queue") },
    },
    "../../../utils/aiAnalysis": {
      getCategoryLabel: (v) => v,
      getSeverityLabel: (v) => v,
      getWorkflowStatusLabel: (v) => v,
    },
    "../../../utils/citizenPresentation": {
      reportTime: (v) => v || "Chưa có thời gian ghi nhận",
    },
    "../../../utils/watermark": {
      formatCaptureTimestamp: (date) => date.toISOString(),
      formatWatermarkData: () => ({
        brandStr: "ECOALERT FIELD CAPTURE",
        locationStr: "GPS",
        addressStr: current.location?.address,
        dateTimeStr: "Captured: today",
      }),
      persistOriginalFieldImage: async (uri) => {
        calls.push(["persistOriginal", uri]);
        return "file:///persisted-original.jpg";
      },
      persistWatermarkedDisplayImage: async (uri) => {
        calls.push(["persistDisplay", uri]);
        return "file:///persisted-display.jpg";
      },
    },
    "../../../utils/fieldCaptureImage": {
      normalizeFieldCaptureImage: async (uri) => {
        calls.push(["normalize", uri]);
        return { uri: "file:///normalized.jpg", width: 1200, height: 1600 };
      },
    },
    "react-native-view-shot": {
      default: "ViewShot",
      captureRef: async () => {
        calls.push(["watermark"]);
        if (options.watermarkError) throw Error("watermark down");
        return "file:///watermark-temp.jpg";
      },
    },
    "../../../components/media/EvidenceImageFrame": {
      EvidenceImageFrame: "EvidenceImageFrame",
    },
    "../../../components/media/ZoomableImageViewer": {
      ZoomableImageViewer: "ZoomableImageViewer",
    },
    "../../../components/vision/WasteDetectionImage": {
      WasteDetectionImage: "WasteDetectionImage",
    },
    "../components/stitch/FieldUI": {
      FieldNotice: "FieldNotice",
      FieldEntrance: "FieldEntrance",
      FieldEvidenceMetaOverlay: "FieldEvidenceMetaOverlay",
      FieldScanLine: "FieldScanLine",
      useFieldReducedMotion: () => true,
    },
    "../components/stitch/fieldDesign": { fieldColors: colors, fieldStyles },
    "../components/stitch/fieldPresentation": presentation,
  };
  for (const name of components)
    imports[`../components/${name}`] = { [name]: name };
  for (const name of [
    "FieldMapPreview",
    "FieldAiResultCard",
    "FieldReportSummary",
    "FieldProcessingTimeline",
  ])
    imports[`../components/stitch/${name}`] = { [name]: name };
  const Component = load(`screens/${screen}.tsx`, imports)[screen];
  const navigate = (route, params) => calls.push(["navigate", route, params]);
  const navigation = {
    navigate,
    goBack: () => calls.push(["back"]),
    getParent: () => ({ navigate }),
  };
  const render = () => {
    cursor = refCursor = 0;
    effects.length = 0;
    tree = Component({ navigation, route: { params: options.route || {} } });
    return tree;
  };
  render();
  const find = (predicate) => nodes(tree).find(predicate);
  const button = (label) =>
    find(
      (node) =>
        node.props?.onPress &&
        (node.props.accessibilityLabel === label || text(node).includes(label)),
    );
  return {
    render,
    find,
    button,
    refs,
    calls,
    effects,
    get tree() {
      return tree;
    },
    get draft() {
      return current;
    },
    setDraft: (value) => {
      current = value;
    },
  };
}

test("GPS eligibility keeps 50m threshold, source, coordinates and five-minute freshness", () => {
  const valid = location(),
    now = Date.now();
  assert.equal(presentation.fieldLocationReady(valid, now), true);
  for (const change of [
    { accuracyMeters: 51 },
    { accuracyMeters: NaN },
    { accuracyMeters: -1 },
    { latitude: 91 },
    { longitude: 181 },
    { source: "MANUAL" },
    { capturedAt: "invalid" },
    { capturedAt: new Date(now - 300001).toISOString() },
    { capturedAt: new Date(now + 10000).toISOString() },
  ])
    assert.equal(
      presentation.fieldLocationReady({ ...valid, ...change }, now),
      false,
    );
  assert.equal(
    presentation.fieldLocationReady({ ...valid, accuracyMeters: 50 }, now),
    true,
  );
});
test("integrity badges check actual data at capture time, not all green by default", () => {
  assert.deepEqual(plain(presentation.fieldIntegrity()), {
    camera: false,
    gps: false,
    time: false,
  });
  const d = draft();
  assert.deepEqual(plain(presentation.fieldIntegrity(d.capture, d.location)), {
    camera: true,
    gps: true,
    time: true,
  });
  d.capture.capturedAt = new Date(Date.now() + 600000).toISOString();
  assert.equal(presentation.fieldIntegrity(d.capture, d.location).gps, false);
});
test("missing/malformed confidence and reverse-geocoding fallback are not fake conclusions", () => {
  for (const value of [null, undefined, NaN, Infinity, -1, 94.2])
    assert.equal(presentation.fieldConfidence(value), null);
  assert.equal(presentation.fieldConfidence(0.942), 0.942);
  assert.equal(
    presentation.readableFieldAddress("10.82300, 106.77500"),
    "Đã ghi nhận vị trí GPS",
  );
  assert.equal(
    presentation.readableFieldAddress("27 Nguyễn Văn Bảo"),
    "27 Nguyễn Văn Bảo",
  );
});
test("GPS screen blocks weak, expired and permission-denied locations, preserves retry", () => {
  for (const opts of [
    { draft: { ...draft(), location: { ...location(), accuracyMeters: 70 } } },
    {
      draft: {
        ...draft(),
        location: {
          ...location(),
          capturedAt: new Date(Date.now() - 600000).toISOString(),
        },
      },
    },
    { locationState: { error: "denied", errorCode: "PERMISSION_DENIED" } },
  ]) {
    const f = fixture("ReportLocationScreen", opts);
    assert.equal(Boolean(f.button("Tiếp tục chụp ảnh").props.disabled), true);
    assert.ok(f.button("LẤY LẠI GPS"));
  }
  const f = fixture("ReportLocationScreen");
  assert.equal(Boolean(f.button("Tiếp tục chụp ảnh").props.disabled), false);
  f.button("Tiếp tục chụp ảnh").props.onPress();
  assert.ok(f.calls.some((c) => c[1] === "ReportCamera"));
});
test("GPS map receives only real coordinates and address fallback remains readable", () => {
  const f = fixture("ReportLocationScreen", {
    draft: {
      ...draft(),
      location: { ...location(), address: "10.82300, 106.77500" },
    },
  });
  assert.match(text(f.tree), /Đã ghi nhận vị trí GPS/);
  assert.equal(
    f.find((n) => n.type === "FieldMapPreview").props.location.latitude,
    10.823,
  );
});
test("camera blocks permissions and expired GPS without introducing a library picker", () => {
  const denied = fixture("ReportCameraScreen", {
    permission: { granted: false, canAskAgain: false },
  });
  assert.ok(denied.button("MỞ CÀI ĐẶT"));
  assert.equal(
    denied.find((n) => n.type === "CameraView"),
    undefined,
  );
  const expired = fixture("ReportCameraScreen", {
    draft: {
      ...draft(),
      location: {
        ...location(),
        capturedAt: new Date(Date.now() - 600000).toISOString(),
      },
    },
  });
  assert.ok(expired.button("QUAY LẠI LẤY GPS"));
});
test("camera uses full-width 3:4 preview across phone widths and waits for native ready", () => {
  for (const width of [320, 360, 390, 430]) {
    const f = fixture("ReportCameraScreen", { width });
    assert.equal(f.button("Chụp ảnh hiện trường").props.disabled, true);
    const camera = f.find((n) => n.type === "CameraView");
    assert.equal(camera.props.ratio, "4:3");
    const frame = f.find(
      (n) =>
        Array.isArray(n.props?.style) &&
        n.props.style.some((v) => v?.width === width - 32),
    );
    assert.ok(frame);
    assert.equal(frame.props.style[0].aspectRatio, 3 / 4);
    camera.props.onCameraReady();
    f.render();
    assert.equal(f.button("Chụp ảnh hiện trường").props.disabled, false);
  }
});
test("rapid camera presses capture once and normalize/persist original before review", async () => {
  const f = fixture("ReportCameraScreen");
  f.find((n) => n.type === "CameraView").props.onCameraReady();
  f.render();
  let resolvePhoto,
    count = 0;
  f.refs.find((r) => r.current === null).current = {
    takePictureAsync: () => {
      count++;
      return new Promise((resolve) => {
        resolvePhoto = resolve;
      });
    },
  };
  f.button("Chụp ảnh hiện trường").props.onPress();
  f.button("Chụp ảnh hiện trường").props.onPress();
  assert.equal(count, 1);
  resolvePhoto({ uri: "file:///camera.jpg" });
  await tick();
  assert.equal(
    f.draft.capture.originalLocalUri,
    "file:///persisted-original.jpg",
  );
  assert.equal(f.draft.capture.width / f.draft.capture.height, 3 / 4);
  assert.ok(f.calls.some((c) => c[0] === "normalize"));
  assert.ok(f.calls.some((c) => c[1] === "ReportPhotoReview"));
});
test("camera capture errors are recoverable and never navigate to review", async () => {
  const f = fixture("ReportCameraScreen");
  f.find((n) => n.type === "CameraView").props.onCameraReady();
  f.render();
  f.refs.find((r) => r.current === null).current = {
    takePictureAsync: async () => {
      throw Error("camera failed");
    },
  };
  f.button("Chụp ảnh hiện trường").props.onPress();
  await tick();
  f.render();
  assert.match(text(f.tree), /Không thể chụp ảnh/);
  assert.equal(
    f.calls.some((c) => c[1] === "ReportPhotoReview"),
    false,
  );
});
test("photo review displays watermarked evidence without applying watermark twice", async () => {
  const f = fixture("ReportPhotoReviewScreen");
  assert.equal(
    f.find((n) => n.type === "EvidenceImageFrame").props.imageUri,
    "file:///display.jpg",
  );
  f.refs.find((r) => r.current === null).current = {};
  f.find((n) => n.type === "Image").props.onLoad();
  await tick();
  assert.equal(
    f.calls.some((c) => c[0] === "watermark"),
    false,
  );
  f.button("DÙNG ẢNH NÀY").props.onPress();
  assert.ok(f.calls.some((c) => c[1] === "ReportImageValidation"));
});
test("watermark generation keeps original, waits before continue and persists display separately", async () => {
  const d = draft();
  delete d.capture.displayLocalUri;
  const f = fixture("ReportPhotoReviewScreen", { draft: d });
  assert.equal(f.button("DÙNG ẢNH NÀY").props.disabled, true);
  f.refs.find((r) => r.current === null).current = {};
  f.find((n) => n.type === "Image").props.onLoad();
  await tick();
  f.render();
  assert.equal(f.draft.capture.originalLocalUri, "file:///original.jpg");
  assert.equal(
    f.draft.capture.displayLocalUri,
    "file:///persisted-display.jpg",
  );
  assert.equal(f.button("DÙNG ẢNH NÀY").props.disabled, false);
});
test("retake clears only capture/analysis while keeping GPS", () => {
  const f = fixture("ReportPhotoReviewScreen"),
    gps = f.draft.location;
  f.button("CHỤP LẠI").props.onPress();
  assert.equal(f.draft.location, gps);
  assert.equal(f.draft.capture, undefined);
  assert.equal(f.draft.imageValidation.state, "IDLE");
});
test("AI processing uses real original image API and preserves bbox coordinates", async () => {
  const d = draft();
  d.imageValidation.state = "IDLE";
  const f = fixture("ReportImageValidationScreen", { draft: d });
  f.effects[0]();
  await tick();
  f.render();
  assert.equal(f.draft.imageValidation.state, "VALID");
  assert.deepEqual(
    plain(f.draft.imageValidation.detectedObjects[0].bbox),
    [100, 100, 300, 300],
  );
  assert.equal(
    f.calls.find((c) => c[0] === "upload")[1],
    "file:///original.jpg",
  );
  assert.ok(f.button("TIẾP TỤC XÁC NHẬN"));
  assert.ok(f.find((n) => n.type === "FieldAiResultCard"));
});
test("AI keeps INVALID, UNAVAILABLE, PROCESSING and UNCERTAIN routes truthful", async () => {
  for (const [options, expected] of [
    [{ vision: { status: "no_detection", detections: [] } }, "INVALID"],
    [{ vision: { status: "error", detections: [] } }, "UNAVAILABLE"],
    [{ offline: true }, "UNAVAILABLE"],
    [{ manual: true }, "VALID"],
  ]) {
    const d = draft();
    d.imageValidation.state = "IDLE";
    const f = fixture("ReportImageValidationScreen", { draft: d, ...options });
    f.effects[0]();
    await tick();
    f.render();
    assert.equal(f.draft.imageValidation.state, expected);
    if (options.manual)
      assert.equal(
        f.draft.imageValidation.backendValidation.decision,
        "UNCERTAIN",
      );
    else assert.equal(f.button("TIẾP TỤC XÁC NHẬN"), undefined);
  }
  const d = draft();
  d.imageValidation.state = "PROCESSING";
  const f = fixture("ReportImageValidationScreen", { draft: d });
  assert.equal(f.button("TIẾP TỤC XÁC NHẬN"), undefined);
});
test("semantic failure does not fabricate a category or severity", async () => {
  const d = draft();
  d.imageValidation.state = "IDLE";
  const f = fixture("ReportImageValidationScreen", {
    draft: d,
    semanticError: true,
  });
  f.effects[0]();
  await tick();
  assert.equal(f.draft.imageValidation.suggestedCategory, null);
  assert.equal(f.draft.imageValidation.severity, null);
});
test("confirmation edits title/description and preserves validation plus acknowledgement", () => {
  const f = fixture("ReportConfirmScreen");
  f.find(
    (n) => n.props?.accessibilityLabel === "Tiêu đề sự cố",
  ).props.onChangeText("abc");
  f.render();
  assert.equal(f.button("GỬI BÁO CÁO NGAY").props.disabled, true);
  f.find(
    (n) => n.props?.accessibilityLabel === "Tiêu đề sự cố",
  ).props.onChangeText("Báo cáo rác mới");
  f.render();
  f.find(
    (n) => n.props?.accessibilityLabel === "Mô tả hiện trường",
  ).props.onChangeText("quá ngắn");
  f.render();
  assert.equal(f.button("GỬI BÁO CÁO NGAY").props.disabled, true);
  f.find(
    (n) => n.props?.accessibilityLabel === "Mô tả hiện trường",
  ).props.onChangeText("Rác thải cần được thu gom tại đường này.");
  f.render();
  assert.equal(f.button("GỬI BÁO CÁO NGAY").props.disabled, false);
  f.find((n) => n.props?.accessibilityRole === "checkbox").props.onPress();
  f.render();
  assert.equal(f.button("GỬI BÁO CÁO NGAY").props.disabled, true);
});
test("confirmation duplicate warning view and confirm actions use existing report API", async () => {
  const f = fixture("ReportConfirmScreen", {
    nearby: [{ _id: id, title: "Rác gần đây", status: "PENDING" }],
  });
  assert.match(text(f.tree), /Có báo cáo tương tự/);
  f.button("XEM BÁO CÁO").props.onPress();
  f.button("SỰ CỐ VẪN CÒN").props.onPress();
  await tick();
  assert.ok(f.calls.some((c) => c[0] === "confirmExisting" && c[1] === id));
  assert.ok(f.calls.some((c) => c[1] === "AlertDetail"));
});
test("submit keeps GeoJSON order, evidence/GPS/AI payload and guards double submit", async () => {
  let resolveCreate;
  const f = fixture("ReportConfirmScreen", {
    create: () =>
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
  });
  f.button("GỬI BÁO CÁO NGAY").props.onPress();
  f.button("GỬI BÁO CÁO NGAY").props.onPress();
  await tick();
  const creates = f.calls.filter((c) => c[0] === "create");
  assert.equal(creates.length, 1);
  const data = creates[0][1];
  assert.deepEqual(plain(data.location.coordinates), [106.775, 10.823]);
  assert.equal(data.captureMetadata.method, "LIVE_CAMERA");
  assert.equal(data.imageValidation.decision, "VALID");
  assert.equal(data.fieldEvidence.length, 1);
  resolveCreate({ _id: id, status: "PENDING" });
  await tick();
  assert.ok(
    f.calls.some((c) => c[1] === "ReportSuccess" && c[2].alertId === id),
  );
});
test("failed submit preserves draft and shows retryable error", async () => {
  const f = fixture("ReportConfirmScreen", {
    create: async () => {
      throw Error("server down");
    },
  });
  f.button("GỬI BÁO CÁO NGAY").props.onPress();
  await tick();
  f.render();
  assert.match(text(f.tree), /Dữ liệu của bạn vẫn được giữ lại/);
  assert.equal(f.draft.capture.originalLocalUri, "file:///original.jpg");
  assert.equal(
    f.calls.some((c) => c[1] === "ReportSuccess"),
    false,
  );
});
test("offline submit queues both local evidence files and does not call server create", async () => {
  const f = fixture("ReportConfirmScreen", { offline: true });
  f.button("LƯU BÁO CÁO NGOẠI TUYẾN").props.onPress();
  await tick();
  const queued = f.calls.find((c) => c[0] === "queue")[1];
  assert.equal(queued.originalLocalUri, "file:///original.jpg");
  assert.equal(queued.displayLocalUri, "file:///display.jpg");
  assert.deepEqual(plain(queued.location.coordinates), [106.775, 10.823]);
  assert.equal(
    f.calls.some((c) => c[0] === "create"),
    false,
  );
  assert.ok(f.calls.some((c) => c[1] === "ReportSuccess" && c[2].queued));
});
test("success only claims server success with actual report data; queued has no server reference", async () => {
  const d = draft();
  d.createdAlert = {
    _id: id,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  const f = fixture("ReportSuccessScreen", {
    draft: d,
    route: { alertId: id },
  });
  assert.match(text(f.tree), /đã gửi thành công/);
  f.button("Sao chép mã báo cáo").props.onPress();
  await tick();
  assert.equal(f.calls.find((c) => c[0] === "copy")[1], "#ECO-5C2958");
  const q = fixture("ReportSuccessScreen", {
    draft: d,
    route: { queued: true, alertId: id },
  });
  assert.match(text(q.tree), /đã được lưu trên thiết bị/);
  assert.doesNotMatch(text(q.tree), /#ECO-|đã gửi thành công/);
  assert.equal(q.button("Sao chép mã báo cáo"), undefined);
  assert.equal(q.calls.find((c) => c[0] === "getAlert")[1], "");
  const unknown = fixture("ReportSuccessScreen", { route: { alertId: id } });
  assert.doesNotMatch(text(unknown.tree), /đã gửi thành công/);
});
test("success routes to own reports/detail or Home and clears only in-memory draft", () => {
  for (const queued of [true, false]) {
    const d = draft();
    d.createdAlert = { _id: id };
    const f = fixture("ReportSuccessScreen", {
      draft: d,
      route: queued ? { queued } : { alertId: id },
    });
    f.button(
      queued ? "XEM BÁO CÁO NGOẠI TUYẾN" : "XEM BÁO CÁO CỦA TÔI",
    ).props.onPress();
    assert.ok(f.calls.some((c) => c[0] === "reset"));
    assert.ok(
      f.calls.some((c) => c[1] === (queued ? "CitizenTabs" : "AlertDetail")),
    );
  }
  const f = fixture("ReportSuccessScreen", { route: { queued: true } });
  f.button("VỀ TRANG CHỦ").props.onPress();
  assert.ok(f.calls.some((c) => c[2]?.screen === "DashboardTab"));
  assert.equal(
    f.calls.some((c) => c[0] === "queue"),
    false,
  );
});

test("GPS failure/timeout retry runs acquisition again and saves device coordinates without swapping", async () => {
  const d = draft();
  delete d.location;
  const f = fixture("ReportLocationScreen", {
    draft: d,
    locationState: { error: "timeout", errorCode: "UNAVAILABLE" },
    fetchLocation: async () => ({
      coords: { coordinates: [106.775, 10.823] },
      accuracyMeters: 10,
      capturedAt: new Date().toISOString(),
      address: "Nguyễn Văn Bảo",
    }),
  });
  assert.match(text(f.tree), /Chưa thể lấy GPS/);
  f.button("LẤY LẠI GPS").props.onPress();
  await tick();
  assert.equal(f.draft.location.latitude, 10.823);
  assert.equal(f.draft.location.longitude, 106.775);
  assert.equal(f.draft.location.source, "DEVICE_GPS");
});
test("watermark failure leaves original evidence usable and exposes retry", async () => {
  const d = draft();
  delete d.capture.displayLocalUri;
  const f = fixture("ReportPhotoReviewScreen", {
    draft: d,
    watermarkError: true,
  });
  f.refs.find((r) => r.current === null).current = {};
  f.find((n) => n.type === "Image").props.onLoad();
  await tick();
  f.render();
  assert.match(text(f.tree), /Ảnh gốc vẫn được giữ nguyên/);
  assert.ok(f.button("THỬ TẠO LẠI"));
  assert.equal(f.draft.capture.originalLocalUri, "file:///original.jpg");
  assert.equal(f.draft.capture.displayLocalUri, undefined);
});
test("real AI result card keeps null confidence/mass pending and distinguishes manual review", () => {
  const Component = load("components/stitch/FieldAiResultCard.tsx", {
    react: React,
    "react-native": rn,
    "lucide-react-native": icons,
    "../../../../utils/aiAnalysis": {
      getCategoryLabel: (v) => `Loại ${v}`,
      getSeverityLabel: (v) => v,
    },
    "../WasteDetectionChips": { WasteDetectionChips: "WasteDetectionChips" },
    "./fieldPresentation": presentation,
    "./fieldDesign": { fieldColors: colors, fieldStyles },
    "./FieldUI": {
      FieldEntrance: "FieldEntrance",
      useFieldReducedMotion: () => true,
    },
  }).FieldAiResultCard;
  const analysis = {
    ...draft().imageValidation,
    suggestedCategory: null,
    severity: null,
    backendValidation: { decision: "UNCERTAIN", confidence: null },
  };
  const tree = Component({ analysis });
  assert.match(text(tree), /Chờ cán bộ xác nhận phân loại/);
  assert.match(text(tree), /CẦN KIỂM TRA/);
  assert.match(text(tree), /Chưa có dữ liệu/);
  assert.match(text(tree), /Chưa có ước tính/);
  assert.doesNotMatch(text(tree), /100%|25–35|20 EcoPoint/);
  analysis.suggestedCategory = "illegal_dumping";
  analysis.severity = "HIGH";
  analysis.backendValidation.confidence = 0.942;
  assert.match(text(Component({ analysis })), /94\.2%/);
});
test("timeline only completes milestones with real timestamps and keeps offline entirely pending", () => {
  const Component = load("components/stitch/FieldProcessingTimeline.tsx", {
    react: React,
    "react-native": rn,
    "lucide-react-native": icons,
    "../../../../utils/citizenPresentation": { reportTime: (v) => v },
    "./fieldDesign": { fieldColors: colors, fieldStyles },
  }).FieldProcessingTimeline;
  const alert = { createdAt: new Date().toISOString(), status: "PENDING" };
  const tree = Component({ alert, queued: false });
  assert.equal((text(tree).match(/ĐÃ GHI NHẬN/g) || []).length, 1);
  assert.equal((text(tree).match(/CHƯA HOÀN TẤT/g) || []).length, 2);
  const offline = Component({ alert, queued: true });
  assert.doesNotMatch(text(offline), /ĐÃ GHI NHẬN/);
  assert.equal((text(offline).match(/CHỜ ĐỒNG BỘ/g) || []).length, 3);
});
test("footer is a normal sibling of scroll content, not an overlay hiding the final fields", () => {
  for (const screen of [
    "ReportPhotoReviewScreen",
    "ReportImageValidationScreen",
    "ReportConfirmScreen",
  ]) {
    const f = fixture(screen),
      scroll = f.find((n) => n.type === "ScrollView");
    assert.ok(f.find((n) => n.type === "ReportBottomActions"));
    assert.equal(
      nodes(scroll).some((n) => n.type === "ReportBottomActions"),
      false,
    );
  }
  const confirm = fixture("ReportConfirmScreen");
  assert.equal(confirm.tree.type, "KeyboardAvoidingView");
  assert.equal(confirm.tree.props.behavior, "padding");
});

test("Android GPS map waits for loaded tiles; MapKit uses its supported ready callback", () => {
  for (const os of ["android", "ios"]) {
    let ready = false,
      cursor = 0;
    const Component = load("components/stitch/FieldMapPreview.tsx", {
      react: {
        ...React,
        useRef: () => ({ current: null }),
        useEffect: () => {},
        useState: (initial) => {
          const index = cursor++;
          return index === 0
            ? [
                ready,
                (value) => {
                  ready = value;
                },
              ]
            : [initial, () => {}];
        },
      },
      "react-native": {
        ...rn,
        Platform: { OS: os },
        useWindowDimensions: () => ({ width: 390 }),
      },
      "react-native-maps": {
        __esModule: true,
        default: "MapView",
        Circle: "Circle",
        Marker: "Marker",
        PROVIDER_GOOGLE: "google",
      },
      "lucide-react-native": icons,
      "./fieldDesign": { fieldColors: colors },
    }).FieldMapPreview;
    const render = () => {
      cursor = 0;
      return Component({ location: location(), loading: false });
    };
    const tree = render(),
      map = nodes(tree).find((n) => n.type === "MapView");
    assert.match(text(tree), /Đang tải bản đồ/);
    map.props.onMapReady();
    assert.equal(ready, os === "ios");
    if (os === "android") {
      assert.match(text(render()), /Đang tải bản đồ/);
      map.props.onMapLoaded();
    }
    assert.doesNotMatch(text(render()), /Đang tải bản đồ/);
  }
});
