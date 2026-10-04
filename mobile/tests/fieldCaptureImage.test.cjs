const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const compiled = ts.transpileModule(
  fs.readFileSync(
    path.join(__dirname, "../src/utils/fieldCaptureImage.ts"),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;

// Exercises the native API boundary; real EXIF decoding must also be tested on a device.
function loadNormalizer(result, renderError) {
  const calls = [];
  const image = {
    saveAsync: async (options) => {
      calls.push(["save", options]);
      return result;
    },
    release: () => calls.push(["release-image"]),
  };
  const module = {
    SaveFormat: { JPEG: "jpeg" },
    ImageManipulator: {
      manipulate: (uri) => {
        calls.push(["decode", uri]);
        return {
          renderAsync: async () => {
            calls.push(["render"]);
            if (renderError) throw renderError;
            return image;
          },
          release: () => calls.push(["release-context"]),
        };
      },
    },
  };
  const exports = {};
  new Function("exports", "require", compiled)(exports, (name) => {
    assert.equal(name, "expo-image-manipulator");
    return module;
  });
  return { ...exports, calls };
}

test("normalization preserves native-decoded portrait/landscape dimensions and does not hardcode rotation", async () => {
  for (const [width, height] of [
    [1080, 1920],
    [1920, 1080],
  ]) {
    const result = { uri: "file:///normalized.jpg", width, height };
    const normalizer = loadNormalizer(result);
    assert.deepEqual(
      await normalizer.normalizeFieldCaptureImage("file:///camera.jpg"),
      result,
    );
    assert.deepEqual(normalizer.calls, [
      ["decode", "file:///camera.jpg"],
      ["render"],
      ["save", { format: "jpeg", compress: 1 }],
      ["release-image"],
      ["release-context"],
    ]);
  }
});

test("invalid normalized dimensions are rejected, not silently uploaded", async () => {
  for (const width of [0, -1, NaN, Infinity]) {
    const normalizer = loadNormalizer({
      uri: "file:///image.jpg",
      width,
      height: 1920,
    });
    await assert.rejects(
      normalizer.normalizeFieldCaptureImage("file:///camera.jpg"),
      /could not be normalized/,
    );
    assert.deepEqual(normalizer.calls.slice(-2), [
      ["release-image"],
      ["release-context"],
    ]);
  }
});

test("native decode error releases resources and propagates to the capture error UI", async () => {
  const normalizer = loadNormalizer(null, new Error("decode failed"));
  await assert.rejects(
    normalizer.normalizeFieldCaptureImage("file:///camera.jpg"),
    /decode failed/,
  );
  assert.deepEqual(normalizer.calls.at(-1), ["release-context"]);
});
