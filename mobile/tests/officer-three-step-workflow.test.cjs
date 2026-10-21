const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");

function loadTsModule(relativePath, mockedImports = {}) {
  const fullPath = path.join(__dirname, "../src", relativePath);
  const code = fs.readFileSync(fullPath, "utf8");
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;

  const exports = {};
  const moduleObj = { exports };
  const fn = new Function("require", "module", "exports", transpiled);
  fn(
    (id) => {
      if (id in mockedImports) return mockedImports[id];
      throw new Error(`Unmocked import "${id}" in ${relativePath}`);
    },
    moduleObj,
    exports,
  );
  return moduleObj.exports;
}

const workflow = loadTsModule("officer/utils/officerWorkflow.ts");
const presentation = loadTsModule("officer/utils/officerPresentation.ts", {
  "../../shared/utils/maps": {
    getGeoJsonMapCoordinates: (coords) =>
      coords ? { latitude: coords[1], longitude: coords[0] } : null,
  },
});
const resolution = loadTsModule("officer/utils/officerResolution.ts", {
  "./officerPresentation": presentation,
});

function flattenNodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(flattenNodes);
  if (!tree || typeof tree !== "object") return [tree];
  return [
    tree,
    ...React.Children.toArray(tree.props?.children).flatMap(flattenNodes),
  ];
}

test("getOfficerWorkflowStep maps task states accurately across the 3-step field workflow", () => {
  // Step 1: Newly assigned task
  const assignedStep = workflow.getOfficerWorkflowStep({
    status: "ASSIGNED",
  });
  assert.equal(assignedStep.currentStep, 1);
  assert.equal(assignedStep.allCompleted, false);
  assert.deepEqual(
    assignedStep.steps.map((s) => ({
      step: s.step,
      label: s.label,
      done: s.done,
      active: s.active,
    })),
    [
      { step: 1, label: "Check-in (Điểm danh)", done: false, active: true },
      { step: 2, label: "Xử lý sự cố", done: false, active: false },
      { step: 3, label: "Check-out (Hoàn thành)", done: false, active: false },
    ],
  );

  // Step 1: IN_PROGRESS but not yet verified check-in
  const unverifiedInProgress = workflow.getOfficerWorkflowStep({
    status: "IN_PROGRESS",
    checkIn: { verified: false },
  });
  assert.equal(unverifiedInProgress.currentStep, 1);
  assert.equal(unverifiedInProgress.steps[0].active, true);
  assert.equal(unverifiedInProgress.steps[0].done, false);

  // Step 2: IN_PROGRESS and verified arrival check-in -> Step 1 done (✓), Step 2 active
  const verifiedStep2 = workflow.getOfficerWorkflowStep({
    status: "IN_PROGRESS",
    checkIn: {
      verified: true,
      checkedInAt: "2026-10-20T08:00:00.000Z",
      accuracyMeters: 8,
      distanceFromIncidentMeters: 15,
    },
  });
  assert.equal(verifiedStep2.currentStep, 2);
  assert.equal(verifiedStep2.allCompleted, false);
  assert.deepEqual(
    verifiedStep2.steps.map((s) => ({
      step: s.step,
      done: s.done,
      active: s.active,
    })),
    [
      { step: 1, done: true, active: false },
      { step: 2, done: false, active: true },
      { step: 3, done: false, active: false },
    ],
  );

  // Step 3 (Active during resolution capture/screen before submit): Steps 1 & 2 done (✓), Step 3 active
  const activeStep3 = workflow.getOfficerWorkflowStep(
    {
      status: "IN_PROGRESS",
      checkIn: {
        verified: true,
        checkedInAt: "2026-10-20T08:00:00.000Z",
        accuracyMeters: 8,
        distanceFromIncidentMeters: 15,
      },
    },
    3,
  );
  assert.equal(activeStep3.currentStep, 3);
  assert.equal(activeStep3.allCompleted, false);
  assert.deepEqual(
    activeStep3.steps.map((s) => ({
      step: s.step,
      done: s.done,
      active: s.active,
    })),
    [
      { step: 1, done: true, active: false },
      { step: 2, done: true, active: false },
      { step: 3, done: false, active: true },
    ],
  );

  // Step 3 Completed: RESOLVED and CLOSED mark all 3 steps done (✓)
  for (const status of ["RESOLVED", "CLOSED"]) {
    const completed = workflow.getOfficerWorkflowStep({
      status,
      checkIn: {
        verified: true,
        checkedInAt: "2026-10-20T08:00:00.000Z",
        accuracyMeters: 8,
        distanceFromIncidentMeters: 15,
      },
    });
    assert.equal(completed.currentStep, 3);
    assert.equal(completed.allCompleted, true);
    assert.deepEqual(
      completed.steps.map((s) => ({
        step: s.step,
        done: s.done,
        active: s.active,
      })),
      [
        { step: 1, done: true, active: false },
        { step: 2, done: true, active: false },
        { step: 3, done: true, active: false },
      ],
    );
  }
});

test("getOfficerTaskState maps task actions cleanly to CHECK_IN, RESOLVE, and NONE", () => {
  assert.deepEqual(workflow.getOfficerTaskState({ status: "ASSIGNED" }), {
    action: "CHECK_IN",
    step: 1,
    label: "CHỜ CHECK-IN",
    color: "#F59E0B",
  });
  assert.deepEqual(
    workflow.getOfficerTaskState({
      status: "IN_PROGRESS",
      checkIn: { verified: false },
    }),
    {
      action: "CHECK_IN",
      step: 1,
      label: "CHỜ CHECK-IN",
      color: "#F59E0B",
    },
  );
  assert.deepEqual(
    workflow.getOfficerTaskState({
      status: "IN_PROGRESS",
      checkIn: {
        verified: true,
        checkedInAt: "2026-10-20T08:00:00.000Z",
        accuracyMeters: 10,
        distanceFromIncidentMeters: 12,
      },
    }),
    {
      action: "RESOLVE",
      step: 2,
      label: "ĐANG XỬ LÝ TẠI HIỆN TRƯỜNG",
      color: "#38BDF8",
    },
  );
  assert.deepEqual(workflow.getOfficerTaskState({ status: "RESOLVED" }), {
    action: "NONE",
    step: 3,
    label: "ĐÃ HOÀN THÀNH",
    color: "#22C55E",
  });
  assert.deepEqual(workflow.getOfficerTaskState({ status: "CLOSED" }), {
    action: "NONE",
    step: 3,
    label: "ĐÃ NGHIỆM THU",
    color: "#22C55E",
  });
});

test("OfficerStepProgressBar renders 3 fixed steps with checkmarks (✓) for completed steps", () => {
  const ui = loadTsModule("officer/components/OfficerUI.tsx", {
    react: React,
    "react-native": {
      Image: "Image",
      Pressable: "Pressable",
      StyleSheet: { create: (x) => x, hairlineWidth: 1, absoluteFill: {} },
      Text: "Text",
      View: "View",
    },
    "lucide-react-native": {
      ArrowLeft: "ArrowLeft",
      Bell: "Bell",
      ChevronRight: "ChevronRight",
      Leaf: "Leaf",
      UserRound: "UserRound",
    },
    "expo-linear-gradient": { LinearGradient: "LinearGradient" },
    "react-native-svg": { __esModule: true, default: "Svg", Path: "Path" },
    "@react-navigation/native": { useNavigation: () => ({ navigate() {} }) },
    "../../auth/hooks/useAuth": { useProfile: () => ({ data: null }) },
    "../../shared/hooks/useNotifications": {
      useUnreadNotificationCount: () => ({ data: 0 }),
    },
    "../../shared/hooks/useReducedMotion": {
      useReducedMotion: () => true,
    },
    "../../shared/theme/useCivicTheme": {
      useCivicTheme: () => ({
        isDark: true,
        colors: {
          primary: "#22C55E",
          cyan: "#38BDF8",
          surface: "#0B1628",
          background: "#07101F",
          elevated: "#132238",
          border: "#1E293B",
          borderStrong: "#334155",
          text: "#F8FAFC",
          textSecondary: "#CBD5E1",
          textMuted: "#64748B",
          greenSoft: "#052E16",
        },
      }),
    },
    "../../shared/theme/civicDesign": { civicType: { meta: {} } },
    "../../shared/utils/notificationNavigation": {
      unreadBadgeLabel: (n) => String(n),
    },
    "../utils/officerWorkflow": workflow,
  });

  // Render Step 2 (Step 1 completed, Step 2 active)
  const treeStep2 = ui.OfficerStepProgressBar({
    task: {
      status: "IN_PROGRESS",
      checkIn: {
        verified: true,
        checkedInAt: "2026-10-20T08:00:00.000Z",
        accuracyMeters: 5,
        distanceFromIncidentMeters: 10,
      },
    },
  });
  assert.deepEqual(treeStep2.props.accessibilityValue, {
    min: 1,
    max: 3,
    now: 2,
  });
  const textContentStep2 = flattenNodes(treeStep2)
    .filter((n) => typeof n === "string" || typeof n === "number")
    .join(" ");
  assert.ok(textContentStep2.includes("Check-in (Điểm danh)"));
  assert.ok(textContentStep2.includes("Xử lý sự cố"));
  assert.ok(textContentStep2.includes("Check-out (Hoàn thành)"));
  assert.ok(textContentStep2.includes("✓"));

  // Render Completed (All 3 steps completed with ✓)
  const treeCompleted = ui.OfficerStepProgressBar({
    task: { status: "RESOLVED" },
  });
  const checkmarks = flattenNodes(treeCompleted).filter((n) => n === "✓");
  assert.equal(checkmarks.length, 3);
});

test("evaluateResolutionVerification evaluates all 3 automated verification checklist criteria (GPS Match, Angle Consistency, Resolution Verification)", () => {
  // 1. Pending state when no photo captured yet
  const pending = resolution.evaluateResolutionVerification({});
  assert.equal(pending.isAcceptable, false);
  assert.equal(pending.gpsMatch.status, "PENDING");
  assert.equal(pending.angleConsistency.status, "PENDING");
  assert.equal(pending.resolutionClean.status, "PENDING");

  // 2. Passed all 3 criteria: GPS within radius (±Xm), valid 3:4 portrait frame + ghost overlay, clean AI/Vision result
  const incidentLocation = { latitude: 10.7769, longitude: 106.7009 };
  const validPhoto = {
    originalLocalUri: "file:///after-clean.jpg",
    capturedAt: "2026-10-20T09:00:00.000Z",
    location: {
      latitude: 10.77695,
      longitude: 106.70095,
      accuracyMeters: 8,
    },
    width: 900,
    height: 1200,
    usedGhostOverlay: true,
  };
  const passed = resolution.evaluateResolutionVerification({
    photo: validPhoto,
    incidentLocation,
    beforeDimensions: { width: 900, height: 1200 },
    angleConfirmed: true,
    visionStatus: "VERIFIED",
    visionResult: {
      imageUrl: "https://cdn.ecoalert.vn/after-clean.jpg",
      status: "no_detection",
      detections: [],
      requiresManualReview: false,
    },
  });

  assert.equal(passed.isAcceptable, true);
  assert.equal(passed.needsRetake, false);
  assert.equal(passed.gpsMatch.status, "PASSED");
  assert.match(passed.gpsMatch.badgeLabel, /±\d+m/);
  assert.equal(passed.angleConsistency.status, "PASSED");
  assert.equal(passed.angleConsistency.badgeLabel, "Góc chụp hợp lệ");
  assert.equal(passed.resolutionClean.status, "PASSED");
  assert.equal(
    passed.resolutionClean.badgeLabel,
    "Đánh giá tự động: Đã dọn dẹp sạch sẽ",
  );

  // 3. GPS too far from incident (> 100m) -> GPS_MATCH fails and blocks acceptance
  const farPhoto = {
    ...validPhoto,
    location: {
      latitude: 10.78, // > 300m away
      longitude: 106.705,
      accuracyMeters: 10,
    },
  };
  const failedGps = resolution.evaluateResolutionVerification({
    photo: farPhoto,
    incidentLocation,
    angleConfirmed: true,
  });
  assert.equal(failedGps.gpsMatch.status, "FAILED");
  assert.equal(failedGps.isAcceptable, false);
  assert.equal(failedGps.needsRetake, true);

  // 4. Angle flagged as misaligned/blurry -> ANGLE_CONSISTENCY warns and requires retake
  const angleFlagged = resolution.evaluateResolutionVerification({
    photo: validPhoto,
    incidentLocation,
    angleConfirmed: false,
  });
  assert.equal(angleFlagged.angleConsistency.status, "WARNING");
  assert.equal(angleFlagged.isAcceptable, false);
  assert.equal(angleFlagged.needsRetake, true);

  // 5. Remaining waste detected by Vision -> RESOLUTION_CLEAN warns with count
  const remainingWaste = resolution.evaluateResolutionVerification({
    photo: validPhoto,
    incidentLocation,
    angleConfirmed: true,
    visionStatus: "VERIFIED",
    visionResult: {
      imageUrl: "https://cdn.ecoalert.vn/after-dirty.jpg",
      status: "ok",
      detections: [
        {
          materialClass: "plastic_bag",
          confidence: 0.82,
          bbox: [10, 10, 100, 100],
        },
      ],
      requiresManualReview: true,
    },
  });
  assert.equal(remainingWaste.resolutionClean.status, "WARNING");
  assert.equal(remainingWaste.resolutionClean.remainingWasteCount, 1);
  assert.equal(remainingWaste.needsRetake, true);
});

test("Officer workflow screens embed OfficerStepProgressBar, Ghost Overlay, Evidence Comparison, and Verification Checklist", () => {
  const screensDir = path.join(__dirname, "../src/officer/screens");
  const componentsDir = path.join(__dirname, "../src/officer/components");

  for (const screenFile of [
    "OfficerAlertDetailScreen.tsx",
    "OfficerGpsCheckInScreen.tsx",
    "OfficerResolutionCamera.tsx",
    "OfficerResolutionScreen.tsx",
    "OfficerResolutionSubmittedScreen.tsx",
  ]) {
    const source = fs.readFileSync(path.join(screensDir, screenFile), "utf8");
    assert.ok(
      source.includes("<OfficerStepProgressBar"),
      `${screenFile} must embed <OfficerStepProgressBar />`,
    );
  }

  // Step 2 Detail screen CTA
  const detailSource = fs.readFileSync(
    path.join(screensDir, "OfficerAlertDetailScreen.tsx"),
    "utf8",
  );
  assert.ok(detailSource.includes('"Check-in hiện trường"'));
  assert.ok(
    detailSource.includes('"Tiếp tục: Chụp ảnh kết quả (Check-out)"'),
  );
  assert.ok(detailSource.includes("Đang xử lý tại hiện trường"));

  // Step 3 Camera Clean Live View
  const cameraSource = fs.readFileSync(
    path.join(screensDir, "OfficerResolutionCamera.tsx"),
    "utf8",
  );
  assert.ok(cameraSource.includes("CameraView"));
  assert.ok(cameraSource.includes("CHỤP ẢNH KẾT QUẢ (SAU XỬ LÝ)"));
  assert.ok(!cameraSource.includes("showGhost"));

  // Step 3 Evidence Comparison labels
  const comparisonSource = fs.readFileSync(
    path.join(componentsDir, "OfficerEvidenceComparison.tsx"),
    "utf8",
  );
  assert.ok(comparisonSource.includes("Ảnh sự cố ban đầu (Trước)"));
  assert.ok(comparisonSource.includes("Ảnh kết quả dọn dẹp (Sau)"));

  // Step 3 Resolution screen Verification Checklist, Retake button, and Check-out CTA
  const resolutionSource = fs.readFileSync(
    path.join(screensDir, "OfficerResolutionScreen.tsx"),
    "utf8",
  );
  assert.ok(
    resolutionSource.includes("Danh sách kiểm tra nghiệm thu tự động"),
  );
  assert.ok(resolutionSource.includes('"Chụp lại ảnh kết quả"'));
  assert.ok(resolutionSource.includes('"Xác nhận Check-out (Hoàn thành)"'));
});

test("Step 3 resolution validator and submitter enforce arrival check-in, live photo GPS, and preserve API payload", async () => {
  const missingCheckIn = resolution.validateOfficerResolution({
    verifiedArrival: false,
    photo: {
      originalLocalUri: "file:///after.jpg",
      capturedAt: new Date().toISOString(),
      location: { latitude: 10.77, longitude: 106.69, accuracyMeters: 8 },
    },
    resolutionSummary: "Đã thu gom sạch sẽ",
    treatmentMethod: "Thu gom và vận chuyển rác",
  });
  assert.match(missingCheckIn, /đến hiện trường/);

  let uploadedUri = null;
  let resolvedPayload = null;
  const submitter = resolution.createOfficerResolutionSubmitter({
    upload: async (uri) => {
      uploadedUri = uri;
      return "https://cdn.ecoalert.vn/after-clean.jpg";
    },
    resolve: async (data) => {
      resolvedPayload = data;
      return { status: "RESOLVED" };
    },
  });

  const capturedAt = "2026-10-20T09:15:00.000Z";
  const ok = await submitter({
    verifiedArrival: true,
    photo: {
      originalLocalUri: "file:///after-clean.jpg",
      capturedAt,
      location: { latitude: 10.776, longitude: 106.701, accuracyMeters: 6 },
    },
    resolutionSummary: "Đã dọn sạch điểm rác tự phát",
    treatmentMethod: "Thu gom và vận chuyển rác",
    materialsUsed: "Bao tải / túi thu gom, Xe gom rác",
    additionalNotes: "Khu vực đã thông thoáng",
  });

  assert.equal(ok, true);
  assert.equal(uploadedUri, "file:///after-clean.jpg");
  assert.deepEqual(resolvedPayload, {
    resolutionSummary: "Đã dọn sạch điểm rác tự phát",
    treatmentMethod: "Thu gom và vận chuyển rác",
    materialsUsed: "Bao tải / túi thu gom, Xe gom rác",
    additionalNotes: "Khu vực đã thông thoáng",
    evidence: [
      {
        url: "https://cdn.ecoalert.vn/after-clean.jpg",
        capturedAt,
        location: { latitude: 10.776, longitude: 106.701, accuracyMeters: 6 },
      },
    ],
  });
});

test("officerElapsedTime formats elapsed check-in duration in natural Vietnamese", () => {
  const start = Date.parse("2026-10-20T08:00:00.000Z");
  assert.equal(
    presentation.officerElapsedTime("2026-10-20T08:00:00.000Z", start + 25_000),
    "Vừa xong",
  );
  assert.equal(
    presentation.officerElapsedTime(
      "2026-10-20T08:00:00.000Z",
      start + 15 * 60_000,
    ),
    "15 phút",
  );
  assert.equal(
    presentation.officerElapsedTime(
      "2026-10-20T08:00:00.000Z",
      start + 75 * 60_000,
    ),
    "1 giờ 15 phút",
  );
});
