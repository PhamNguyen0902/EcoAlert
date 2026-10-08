const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");
const read = (p) => fs.readFileSync(path.join(__dirname, "../src", p), "utf8");
const util = {};
vm.runInNewContext(
  ts.transpileModule(read("utils/officerResolution.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: util },
);
const photo = {
  originalLocalUri: "file:///after.jpg",
  capturedAt: "2026-10-06T07:00:00.000Z",
  location: { latitude: 10.7769, longitude: 106.7009, accuracyMeters: 8 },
};
const draft = {
  photo,
  verifiedArrival: true,
  resolutionSummary: " Đã dọn rác ",
  treatmentMethod: " Thu gom rác ",
  materialsUsed: " Xe gom rác ",
  additionalNotes: " Ghi chú kết quả ",
};
test("requires own verified arrival, photo, summary, treatment and genuine GPS metadata", () => {
  assert.equal(util.validateOfficerResolution(draft), null);
  for (const invalid of [
    { ...draft, verifiedArrival: false },
    { ...draft, photo: undefined },
    { ...draft, resolutionSummary: "" },
    { ...draft, treatmentMethod: "" },
    {
      ...draft,
      photo: { ...photo, location: { ...photo.location, latitude: NaN } },
    },
    { ...draft, photo: { ...photo, capturedAt: "bad" } },
  ])
    assert.equal(typeof util.validateOfficerResolution(invalid), "string");
});
test("GPS permission denied never requests position", async () => {
  let calls = 0;
  await assert.rejects(
    util.acquireOfficerGps({
      permission: async () => false,
      position: async () => {
        calls++;
      },
    }),
    /Cần quyền GPS/,
  );
  assert.equal(calls, 0);
});
test("GPS unavailable/unknown accuracy cannot invent coordinates", async () => {
  await assert.rejects(
    util.acquireOfficerGps({
      permission: async () => true,
      position: async () => {
        throw new Error("unavailable");
      },
    }),
    /unavailable/,
  );
  for (const accuracyMeters of [null, NaN, -1])
    await assert.rejects(
      util.acquireOfficerGps({
        permission: async () => true,
        position: async () => ({ ...photo.location, accuracyMeters }),
      }),
      /GPS chưa/,
    );
});
test("fresh GPS data is preserved; server remains authority for accuracy/radius", async () => {
  const actual = await util.acquireOfficerGps({
    permission: async () => true,
    position: async () => ({ ...photo.location, accuracyMeters: 71 }),
  });
  assert.equal(actual.accuracyMeters, 71);
  assert.equal(actual.latitude, photo.location.latitude);
});
test("resolution submits actual metadata and trims fields; never sends invented distance", async () => {
  let payload,
    uploads = 0;
  const submit = util.createOfficerResolutionSubmitter({
    upload: async (uri) => {
      assert.equal(uri, photo.originalLocalUri);
      uploads++;
      return "https://example.test/after.jpg";
    },
    resolve: async (data) => {
      payload = data;
    },
  });
  assert.equal(await submit(draft), true);
  assert.equal(payload.resolutionSummary, "Đã dọn rác");
  assert.equal(payload.treatmentMethod, "Thu gom rác");
  assert.equal(payload.evidence[0].capturedAt, photo.capturedAt);
  assert.equal(payload.evidence[0].location, photo.location);
  assert.equal(payload.evidence[0].distanceFromIncidentMeters, undefined);
  assert.equal(await submit(draft), false);
  assert.equal(uploads, 1);
});
test("upload failure never resolves and allows retry", async () => {
  let uploads = 0,
    resolves = 0;
  const submit = util.createOfficerResolutionSubmitter({
    upload: async () => {
      if (++uploads === 1) throw new Error("offline");
      return "https://example.test/after.jpg";
    },
    resolve: async () => {
      resolves++;
    },
  });
  await assert.rejects(submit(draft), /offline/);
  assert.equal(resolves, 0);
  assert.equal(await submit(draft), true);
  assert.equal(resolves, 1);
});
test("failed resolution reuses completed upload", async () => {
  let uploads = 0,
    resolves = 0;
  const submit = util.createOfficerResolutionSubmitter({
    upload: async () => {
      uploads++;
      return "https://example.test/after.jpg";
    },
    resolve: async () => {
      if (++resolves === 1) throw new Error("bad GPS");
    },
  });
  await assert.rejects(submit(draft), /bad GPS/);
  await submit(draft);
  assert.equal(uploads, 1);
  assert.equal(resolves, 2);
});
test("retake invalidates prior upload after failed resolution", async () => {
  let uploads = 0;
  const submit = util.createOfficerResolutionSubmitter({
    upload: async () => {
      uploads++;
      return "https://example.test/after.jpg";
    },
    resolve: async () => {
      throw new Error("rejected");
    },
  });
  await assert.rejects(submit(draft));
  await assert.rejects(
    submit({
      ...draft,
      photo: { ...photo, originalLocalUri: "file:///retake.jpg" },
    }),
  );
  assert.equal(uploads, 2);
});
test("double submit while upload pending makes only one upload/resolve call", async () => {
  let release,
    uploads = 0,
    resolves = 0;
  const pending = new Promise((r) => {
    release = r;
  });
  const submit = util.createOfficerResolutionSubmitter({
    upload: async () => {
      uploads++;
      await pending;
      return "https://example.test/after.jpg";
    },
    resolve: async () => {
      resolves++;
    },
  });
  const first = submit(draft);
  assert.equal(await submit(draft), false);
  release();
  assert.equal(await first, true);
  assert.equal(uploads, 1);
  assert.equal(resolves, 1);
});
test("active officer evidence uses native camera only, review/retake and in-content CTA", () => {
  const detail = read("screens/officer/OfficerAlertDetailScreen.tsx");
  const screen = read("screens/officer/OfficerResolutionScreen.tsx");
  const camera = read("screens/officer/OfficerResolutionCamera.tsx");
  assert.doesNotMatch(
    detail + screen + camera,
    /launchImageLibraryAsync|requestMediaLibraryPermissionsAsync|ResolutionModal|navigation:\s*any|route:\s*any/,
  );
  assert.match(camera, /CameraView/);
  assert.match(camera, /skipProcessing: false/);
  assert.match(camera, /normalizeFieldCaptureImage/);
  assert.match(camera, /Accuracy.Highest/);
  assert.match(camera, /aspectRatio:\s*3\s*\/\s*4/);
  assert.match(camera, /AppState.addEventListener/);
  assert.match(screen, /CHỤP LẠI/);
  assert.match(screen, /SỬ DỤNG ẢNH NÀY/);
  assert.match(screen, /submittingRef/);
  assert.match(
    screen,
    /<Button[^>]*title="GỬI KẾT QUẢ XỬ LÝ"[\s\S]*?<\/ScrollView>/,
  );
  assert.match(detail, /ẢNH HIỆN TRƯỜNG · TRƯỚC XỬ LÝ/);
  assert.match(detail, /SAU XỬ LÝ/);
  assert.match(detail, /EvidenceImageFrame/);
});
test("treatments and equipment are waste-specific; no irrelevant legacy options", () => {
  assert.equal(util.WASTE_TREATMENTS.length, 6);
  assert.doesNotMatch(
    util.WASTE_TREATMENTS.join("|") + util.WASTE_MATERIALS.join("|"),
    /hóa chất|dòng chảy|cắt tỉa|dập cháy|tiếng ồn/i,
  );
});
const React = require("react");
function nodes(element) {
  if (!element || typeof element !== "object") return [];
  return [
    element,
    ...React.Children.toArray(element.props?.children).flatMap(nodes),
  ];
}
function nativeCameraFixture({
  cameraGranted = true,
  gpsGranted = true,
  pictureFails = false,
} = {}) {
  let refIndex = 0,
    stateIndex = 0;
  const calls = [],
    captures = [],
    stateWrites = [];
  const nativeCamera = {
    takePictureAsync: async (options) => {
      calls.push(["picture", options]);
      if (pictureFails) throw new Error("native failure");
      return { uri: "file:///camera.jpg" };
    },
  };
  const refs = [
    { current: nativeCamera },
    { current: false },
    { current: true },
  ];
  const exports = {};
  const dependencies = {
    react: {
      __esModule: true,
      default: React,
      useRef: () => refs[refIndex++],
      useState: (initial) => {
        const index = stateIndex++;
        return [
          index === 0 ? true : index === 4 ? 270 : initial,
          (value) => stateWrites.push([index, value]),
        ];
      },
      useEffect: (fn) => fn(),
    },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      ActivityIndicator: "ActivityIndicator",
      Linking: { openSettings: async () => {} },
      StyleSheet: { create: (v) => v, absoluteFill: {} },
      AppState: {
        currentState: "active",
        addEventListener: () => ({ remove() {} }),
      },
    },
    "expo-camera": {
      CameraView: "CameraView",
      useCameraPermissions: () => [
        { granted: cameraGranted, canAskAgain: true },
        async () => {
          calls.push(["cameraPermission"]);
        },
      ],
    },
    "expo-location": {
      Accuracy: { Highest: "Highest" },
      requestForegroundPermissionsAsync: async () => ({ granted: gpsGranted }),
      getCurrentPositionAsync: async (options) => {
        calls.push(["gps", options]);
        return {
          coords: {
            latitude: photo.location.latitude,
            longitude: photo.location.longitude,
            accuracy: 8,
          },
        };
      },
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 44, bottom: 34 }),
    },
    "lucide-react-native": {
      Camera: "Camera",
      X: "X",
      Flashlight: "Flashlight",
    },
    "../../utils/fieldCaptureImage": {
      normalizeFieldCaptureImage: async (uri) => {
        calls.push(["normalize", uri]);
        return { uri: "file:///normalized.jpg" };
      },
    },
    "../../utils/watermark": {
      persistOriginalFieldImage: async (uri, at) => {
        calls.push(["persist", uri, at]);
        return "file:///persisted.jpg";
      },
    },
    "../../theme/useCivicTheme": {
      useCivicTheme: () => ({
        colors: { background: "#07101F", text: "#F8FAFC", primary: "#22C55E" },
      }),
    },
    "../../utils/officerWorkflow": { officerErrorMessage: (_e, f) => f },
    "../../utils/officerResolution": util,
  };
  vm.runInNewContext(
    ts.transpileModule(read("screens/officer/OfficerResolutionCamera.tsx"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    {
      exports,
      Date,
      require: (name) => {
        assert.ok(dependencies[name], name);
        return dependencies[name];
      },
    },
  );
  const tree = exports.OfficerResolutionCamera({
    onCapture: (p) => captures.push(p),
    onClose() {},
  });
  return {
    tree,
    calls,
    captures,
    stateWrites,
    shutter: nodes(tree).find(
      (n) => n.props?.accessibilityLabel === "Chụp ảnh sau xử lý",
    ),
  };
}
test("native camera permission denied disables shutter and cannot select Gallery", () => {
  const fixture = nativeCameraFixture({ cameraGranted: false });
  assert.equal(fixture.shutter.props.disabled, true);
  assert.equal(
    nodes(fixture.tree).filter((n) => n.type === "CameraView").length,
    0,
  );
});
test("native camera capture gets fresh GPS, normalizes and persists original pixels for review", async () => {
  const fixture = nativeCameraFixture();
  fixture.shutter.props.onPress();
  await new Promise(setImmediate);
  assert.deepEqual(
    fixture.calls.map((c) => c[0]),
    ["gps", "picture", "normalize", "persist"],
  );
  assert.equal(fixture.calls[1][1].skipProcessing, false);
  assert.equal(fixture.captures.length, 1);
  assert.equal(fixture.captures[0].originalLocalUri, "file:///persisted.jpg");
  assert.equal(fixture.captures[0].location.accuracyMeters, 8);
  assert.ok(Number.isFinite(Date.parse(fixture.captures[0].capturedAt)));
});
test("denied GPS and failed native capture never advance to evidence review", async () => {
  for (const options of [{ gpsGranted: false }, { pictureFails: true }]) {
    const fixture = nativeCameraFixture(options);
    fixture.shutter.props.onPress();
    await new Promise(setImmediate);
    assert.equal(fixture.captures.length, 0);
    assert.ok(
      fixture.stateWrites.some(
        ([index, value]) => index === 2 && typeof value === "string",
      ),
    );
  }
});
