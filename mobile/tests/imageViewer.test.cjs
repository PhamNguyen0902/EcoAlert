const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const source = fs.readFileSync(
  path.join(__dirname, "../src/utils/imageViewer.ts"),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});
const viewer = {};
new Function("exports", compiled.outputText)(viewer);
const {
  clampImageZoom: zoom,
  calculateImagePanBounds: bounds,
  clampImagePan: pan,
  getDoubleTapImageZoom: doubleTap,
} = viewer;

test("pinch/zoom values stay between 1x and 4x, invalid scale resets safely", () => {
  assert.equal(zoom(0.2), 1);
  assert.equal(zoom(1), 1);
  assert.equal(zoom(2.5), 2.5);
  assert.equal(zoom(4), 4);
  assert.equal(zoom(12), 4);
  for (const value of [NaN, Infinity, -Infinity]) assert.equal(zoom(value), 1);
});

test("double tap toggles fit and 2.5x", () => {
  assert.equal(doubleTap(1), 2.5);
  assert.equal(doubleTap(1.1), 2.5);
  assert.equal(doubleTap(2.5), 1);
  assert.equal(doubleTap(4), 1);
});

test("pan at 1x always stays centered regardless of translation", () => {
  const limits = bounds(
    { width: 390, height: 600 },
    { width: 390, height: 600 },
    1,
  );
  assert.deepEqual(limits, { x: 0, y: 0 });
  for (const value of [-10000, -1, 0, 1, 10000]) {
    assert.equal(pan(value, limits.x), 0);
    assert.equal(pan(value, limits.y), 0);
  }
});

test("landscape can pan only on axes larger than the viewport after zoom", () => {
  const limits = bounds(
    { width: 390, height: 219.375 },
    { width: 390, height: 600 },
    2,
  );
  assert.deepEqual(limits, { x: 195, y: 0 });
  assert.equal(pan(999, limits.x), 195);
  assert.equal(pan(-999, limits.x), -195);
  assert.equal(pan(100, limits.y), 0);
});

test("portrait pan bounds use actual image width, not the letterbox width", () => {
  const limits = bounds(
    { width: 236.25, height: 420 },
    { width: 390, height: 600 },
    2.5,
  );
  assert.deepEqual(limits, { x: 100.3125, y: 225 });
  assert.equal(pan(200, limits.x), 100.3125);
  assert.equal(pan(-300, limits.y), -225);
  assert.equal(pan(20, limits.x), 20);
});

test("zoom out recalculates bounds and returns both axes to center", () => {
  const image = { width: 236.25, height: 420 },
    viewport = { width: 390, height: 600 };
  const four = bounds(image, viewport, 4),
    two = bounds(image, viewport, 2),
    one = bounds(image, viewport, 1);
  assert.ok(four.x > two.x && four.y > two.y);
  assert.equal(pan(four.x, two.x), two.x);
  assert.equal(pan(four.y, two.y), two.y);
  assert.equal(pan(two.x, one.x), 0);
  assert.equal(pan(two.y, one.y), 0);
});

test("tiny/invalid/loading dimensions never allow dragging off screen", () => {
  for (const value of [0, -10, NaN, Infinity])
    assert.deepEqual(
      bounds({ width: value, height: 100 }, { width: 390, height: 600 }, 4),
      { x: 0, y: 0 },
    );
  assert.equal(pan(NaN, 100), 0);
  assert.equal(pan(Infinity, 100), 0);
  assert.equal(pan(100, NaN), 0);
});

test("portrait/landscape/tall images stay bounded at the four mobile widths", () => {
  for (const width of [360, 390, 412, 430]) {
    const viewport = { width, height: 600 };
    for (const aspect of [1080 / 1920, 1920 / 1080, 600 / 4000]) {
      const height = Math.min(viewport.height, viewport.width / aspect);
      const image = { width: height * aspect, height };
      for (const scale of [1, 2, 2.5, 4]) {
        const limit = bounds(image, viewport, scale);
        assert.ok(Number.isFinite(limit.x) && Number.isFinite(limit.y));
        assert.ok(Math.abs(pan(10000, limit.x)) <= limit.x);
        assert.ok(Math.abs(pan(-10000, limit.y)) <= limit.y);
      }
    }
  }
});
