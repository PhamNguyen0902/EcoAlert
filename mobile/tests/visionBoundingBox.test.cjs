const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
// Transpile this dependency-free utility only. The entire app is typechecked separately.
const source = fs.readFileSync(
  path.join(__dirname, "../src/utils/visionBoundingBox.ts"),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});
const utils = {};
new Function("exports", compiled.outputText)(utils);
const {
  calculateContainedImageRect: contain,
  transformBoundingBox: transform,
  positionDetectionLabel: labelPosition,
  groupDetectionsByClass: group,
  formatDetectionConfidence: confidence,
  matchVisionEvidence: match,
} = utils;

test("square bbox maps to exactly 30/30/120/120", () => {
  const original = { width: 1000, height: 1000 };
  assert.deepEqual(
    transform(
      [100, 100, 500, 500],
      original,
      contain(original, { width: 300, height: 300 }),
    ),
    { left: 30, top: 30, width: 120, height: 120 },
  );
});
test("landscape contain includes vertical letterbox offset", () => {
  const original = { width: 1920, height: 1080 };
  const rect = contain(original, { width: 390, height: 300 });
  assert.equal(rect.offsetX, 0);
  assert.equal(rect.offsetY, 40.3125);
  assert.deepEqual(transform([0, 0, 1920, 1080], original, rect), {
    left: 0,
    top: 40.3125,
    width: 390,
    height: 219.375,
  });
});
test("portrait contain includes horizontal letterbox offset", () => {
  const original = { width: 1080, height: 1920 };
  const rect = contain(original, { width: 390, height: 300 });
  assert.equal(rect.offsetX, 110.625);
  assert.equal(rect.offsetY, 0);
  assert.deepEqual(transform([0, 0, 1080, 1920], original, rect), {
    left: 110.625,
    top: 0,
    width: 168.75,
    height: 300,
  });
});
test("clamp outside bounds and discard fully outside boxes", () => {
  const original = { width: 1000, height: 1000 },
    rect = contain(original, { width: 300, height: 300 });
  assert.deepEqual(transform([-50, -10, 1100, 1500], original, rect), {
    left: 0,
    top: 0,
    width: 300,
    height: 300,
  });
  assert.equal(transform([1100, 100, 1200, 200], original, rect), null);
});
test("invalid/missing bbox never produces invalid views", () => {
  const original = { width: 1000, height: 1000 },
    rect = contain(original, { width: 300, height: 300 });
  [
    undefined,
    null,
    [],
    [0, 1, 2],
    [0, 0, 10, 10, 20],
    [0, 0, NaN, 10],
    [0, 0, Infinity, 10],
    [0, 0, "10", 10],
    [5, 1, 4, 2],
    [1, 5, 2, 4],
    [1, 1, 1, 2],
  ].forEach((box) => assert.equal(transform(box, original, rect), null));
});
test("unknown/zero/invalid dimensions wait for a valid layout", () => {
  [0, -1, NaN, Infinity].forEach((width) =>
    assert.equal(
      contain({ width, height: 100 }, { width: 300, height: 300 }),
      null,
    ),
  );
  assert.equal(
    contain({ width: 100, height: 100 }, { width: 0, height: 300 }),
    null,
  );
});
test("layout/orientation change recomputes boxes", () => {
  const original = { width: 1000, height: 1000 };
  assert.equal(
    transform(
      [100, 100, 500, 500],
      original,
      contain(original, { width: 600, height: 300 }),
    ).left,
    180,
  );
});
test("labels at top/right/bottom stay within the rendered image", () => {
  const rect = contain(
    { width: 1080, height: 1920 },
    { width: 390, height: 300 },
  );
  const top = labelPosition(
    { left: 275, top: 0, width: 4, height: 20 },
    { width: 120, height: 22 },
    rect,
  );
  assert.deepEqual(top, { left: 159.375, top: 0, width: 120 });
  const bottom = labelPosition(
    { left: 111, top: 299, width: 4, height: 1 },
    { width: 120, height: 22 },
    rect,
  );
  assert.equal(bottom.top, 275);
});
test("duplicate classes use counts and highest (not average) confidence", () => {
  assert.deepEqual(
    group([
      { materialClass: "plastic_bag", confidence: 0.98 },
      { materialClass: "plastic_bag", confidence: 0.7 },
      { materialClass: "plastic_bottle", confidence: 0.94 },
    ]),
    [
      { materialClass: "plastic_bag", count: 2, maxConfidence: 0.98 },
      { materialClass: "plastic_bottle", count: 1, maxConfidence: 0.94 },
    ],
  );
});
test("missing bbox still participates in grouping; invalid confidences omitted", () => {
  assert.deepEqual(
    group([
      { materialClass: "paper", confidence: NaN },
      { materialClass: "paper", count: 3 },
    ]),
    [{ materialClass: "paper", count: 4, maxConfidence: null }],
  );
  assert.deepEqual(group([]), []);
});
test("confidence formatting rounds and validates range", () => {
  assert.equal(confidence(0.984), "98%");
  assert.equal(confidence(0), "0%");
  assert.equal(confidence(1), "100%");
  [undefined, NaN, Infinity, -1, 1.1].forEach((value) =>
    assert.equal(confidence(value), null),
  );
});
test("match evidence by original URL, not index or watermark URL", () => {
  const evidence = [
    { imageUrl: "https://host/b.jpg", detections: ["b"] },
    { imageUrl: "https://host/a.jpg", detections: ["a"] },
  ];
  assert.deepEqual(
    match(["https://host/a.jpg", "https://host/b.jpg"], evidence),
    [evidence[1], evidence[0]],
  );
  assert.deepEqual(match(["https://host/a-display.jpg"], evidence), []);
  assert.deepEqual(match(["https://host/a.jpg?token=other"], evidence), []);
  assert.deepEqual(
    match(["https://host/a.jpg", "https://host/a.jpg"], evidence),
    [evidence[1]],
  );
});
test("known classes translated centrally, unknown class preserved", () => {
  assert.equal(utils.getWasteDetectionLabel("plastic_bag"), "Túi nhựa");
  assert.equal(utils.getWasteDetectionLabel("metal_can"), "Lon kim loại");
  assert.equal(utils.getWasteDetectionLabel("unknown_class"), "unknown_class");
});

test("extreme numeric inputs cannot create infinite or collapsed rectangles", () => {
  assert.equal(
    contain(
      { width: Number.MIN_VALUE, height: Number.MIN_VALUE },
      { width: 300, height: 300 },
    ),
    null,
  );
  assert.equal(
    transform(
      [1, 1, 10, 10],
      { width: 100, height: 100 },
      {
        width: 100,
        height: 100,
        scale: Number.MAX_VALUE,
        offsetX: 0,
        offsetY: 0,
      },
    ),
    null,
  );
});

test("image height adapts to portrait/landscape and stays capped at four mobile widths", () => {
  for (const screenWidth of [360, 390, 412, 430]) {
    const width = screenWidth - 32;
    const portrait = { width: 1080, height: 1920 };
    const landscape = { width: 1920, height: 1080 };
    assert.equal(utils.calculateReportImageHeight(portrait, width), 440);
    assert.equal(utils.calculateReportImageHeight(landscape, width), 240);
    assert.equal(
      utils.calculateReportImageHeight(portrait, width, "confirmation"),
      420,
    );
    const rect = contain(portrait, { width, height: 440 });
    const box = transform([100, 200, 900, 1700], portrait, rect);
    assert.equal(box.left, rect.offsetX + 100 * rect.scale);
    assert.equal(box.top, 200 * rect.scale);
    assert.ok(box.left + box.width <= width);
    assert.ok(box.top + box.height <= 440);
  }
  assert.equal(utils.calculateReportImageHeight(null, 390), 240);
  assert.equal(
    utils.calculateReportImageHeight({ width: 0, height: 0 }, 390),
    240,
  );
  assert.equal(
    utils.calculateReportImageHeight({ width: 100, height: 200 }, NaN),
    240,
  );
});

test("confirm portrait/landscape/tall fit keeps ratio without crop or stretch", () => {
  const width = 358;
  for (const original of [
    { width: 1080, height: 1920 },
    { width: 1920, height: 1080 },
    { width: 600, height: 4000 },
  ]) {
    const height = utils.calculateReportImageHeight(
      original,
      width,
      "confirmation",
    );
    const rect = contain(original, { width, height });
    assert.ok(height <= 420 && height >= 220);
    assert.ok(
      Math.abs(rect.width / rect.height - original.width / original.height) <
        1e-10,
    );
    assert.ok(rect.width <= width && rect.height <= 420);
  }
  assert.equal(
    contain({ width: 1080, height: 1920 }, { width, height: 420 }).width,
    236.25,
  );
});

test("one/four separated boxes allow short labels, thirteen boxes require numbers", () => {
  const boxes = Array.from({ length: 13 }, (_, index) => ({
    left: index * 25,
    top: 0,
    width: 20,
    height: 40,
  }));
  assert.equal(utils.shouldNumberDetectionLabels(boxes.slice(0, 1)), false);
  assert.equal(utils.shouldNumberDetectionLabels(boxes.slice(0, 4)), false);
  assert.equal(utils.shouldNumberDetectionLabels(boxes), true);
  assert.equal(utils.shouldNumberDetectionLabels([]), false);
});

test("overlapping boxes switch to numbers even when there are fewer than six", () => {
  assert.equal(
    utils.shouldNumberDetectionLabels([
      { left: 10, top: 10, width: 100, height: 100 },
      { left: 20, top: 20, width: 100, height: 100 },
    ]),
    true,
  );
});

test("confidence colors do not filter or reclassify low-confidence detections", () => {
  const values = [0.7, 0.69, 0.45, 0.44, 0.3, 0.29];
  assert.deepEqual(values.map(utils.getDetectionConfidenceColor), [
    "#22C55E",
    "#38BDF8",
    "#38BDF8",
    "#F59E0B",
    "#F59E0B",
    "#94A3B8",
  ]);
  assert.equal(utils.getDetectionConfidenceColor(undefined), "#94A3B8");
  assert.equal(utils.getDetectionConfidenceColor(1.1), "#94A3B8");
  assert.equal(
    group(
      values.map((confidence) => ({
        materialClass: "plastic_bag",
        confidence,
      })),
    )[0].count,
    6,
  );
});
