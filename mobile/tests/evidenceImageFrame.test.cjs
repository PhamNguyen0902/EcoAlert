const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadUtility(file) {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/utils", file),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const exports = {};
  new Function("exports", compiled.outputText)(exports);
  return exports;
}
const {
  calculateEvidenceFrameSize: frame,
  EVIDENCE_FRAME_ASPECT_RATIO: ratio,
} = loadUtility("evidenceImageFrame.ts");
const { calculateContainedImageRect: contain, transformBoundingBox: bbox } =
  loadUtility("visionBoundingBox.ts");

test("3:4 frames are responsive at all five mobile widths and never exceed 320 x 426.67", () => {
  assert.equal(ratio, 3 / 4);
  for (const screenWidth of [360, 375, 390, 412, 430]) {
    const available = screenWidth - 32;
    const size = frame(available);
    assert.ok(size.width <= 320 && size.width <= available);
    assert.ok(size.height <= (320 * 4) / 3);
    assert.ok(Math.abs(size.width / size.height - 3 / 4) < 0.000001);
    assert.equal(size.width, Math.min(available * 0.84, 320));
  }
});

test("invalid dimensions remain finite without overflowing", () => {
  for (const width of [0, -1, NaN, Infinity])
    assert.deepEqual(frame(width), { width: 0, height: 0 });
});

test("portrait, landscape, tall and 3:4 images remain completely inside frame", () => {
  for (const screenWidth of [360, 375, 390, 412, 430]) {
    const viewport = frame(screenWidth - 32);
    for (const source of [
      { width: 1080, height: 1920 },
      { width: 1920, height: 1080 },
      { width: 600, height: 4000 },
      { width: 1200, height: 1600 },
    ]) {
      const rect = contain(source, viewport);
      assert.ok(rect.offsetX >= 0 && rect.offsetY >= 0);
      assert.ok(rect.offsetX + rect.width <= viewport.width + 1e-6);
      assert.ok(rect.offsetY + rect.height <= viewport.height + 1e-6);
      assert.ok(
        Math.abs(rect.width / rect.height - source.width / source.height) <
          1e-6,
      );
      assert.deepEqual(
        bbox([0, 0, source.width, source.height], source, rect),
        {
          left: rect.offsetX,
          top: rect.offsetY,
          width: rect.width,
          height: rect.height,
        },
      );
      const before = { ...source };
      contain(source, viewport);
      assert.deepEqual(source, before);
    }
  }
});

test("landscape bbox stays in rendered image, never in vertical letterboxes", () => {
  const source = { width: 1920, height: 1080 };
  const viewport = frame(358);
  const rect = contain(source, viewport);
  assert.ok(rect.offsetY > 0);
  assert.equal(rect.offsetX, 0);
  const box = bbox([0, 0, 1920, 1080], source, rect);
  assert.equal(box.top, rect.offsetY);
  assert.ok(box.top + box.height < viewport.height);
});

test("tall bbox stays in rendered image, never in horizontal letterboxes", () => {
  const source = { width: 600, height: 4000 };
  const viewport = frame(358);
  const rect = contain(source, viewport);
  assert.ok(rect.offsetX > 0);
  assert.equal(rect.offsetY, 0);
  const box = bbox([0, 0, 600, 4000], source, rect);
  assert.equal(box.left, rect.offsetX);
  assert.ok(box.left + box.width < viewport.width);
});
