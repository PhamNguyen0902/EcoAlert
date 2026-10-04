const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../src/theme/civicDesign.ts"),
  "utf8",
);
const exportsObject = {};
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  {
    exports: exportsObject,
    require: (name) => {
      assert.equal(name, "react-native");
      return { StyleSheet: { create: (styles) => styles } };
    },
  },
);
const { civicSpace, civicRadius, civicType, civicStyles, getCivicColors } =
  exportsObject;

test("citizen spacing and radius use the agreed scale", () => {
  assert.deepEqual(
    Array.from(Object.values(civicSpace)),
    [4, 8, 12, 16, 20, 24, 32],
  );
  assert.equal(civicRadius.card, 16);
  assert.equal(civicRadius.major, 18);
  assert.equal(civicRadius.button, 12);
});

test("dark civic palette has the specified surfaces and accents", () => {
  const colors = getCivicColors({}, true);
  assert.equal(colors.background, "#07101F");
  assert.equal(colors.card, "#0B1628");
  assert.equal(colors.elevated, "#101D31");
  assert.equal(colors.primary, "#22C55E");
  assert.equal(colors.cyan, "#38BDF8");
  assert.equal(colors.text, "#F8FAFC");
});

test("light preference and existing theme fields are preserved without mutation", () => {
  const base = Object.freeze({
    background: "#F8FAFC",
    surface: "#FFFFFF",
    card: "#FFFFFF",
    text: "#0F172A",
    textMuted: "#64748B",
    primary: "#16A34A",
    border: "#E2E8F0",
    glassBg: "existing-glass",
  });
  const colors = getCivicColors(base, false);
  for (const field of [
    "background",
    "surface",
    "card",
    "text",
    "primary",
    "border",
    "glassBg",
  ])
    assert.equal(colors[field], base[field]);
  assert.equal(colors.textSecondary, "#475569");
});

test("shared typography never introduces sub-10px metadata", () => {
  for (const style of Object.values(civicType)) assert.ok(style.fontSize >= 10);
  assert.equal(civicType.title.fontSize, 24);
  assert.equal(civicType.title.lineHeight, 30);
  assert.equal(civicType.button.fontSize, 14);
});

test("actions meet touch targets and cards avoid heavy shadows", () => {
  assert.equal(civicStyles.primaryButton.minHeight, 52);
  assert.equal(civicStyles.secondaryButton.minHeight, 48);
  assert.equal(civicStyles.iconButton.width, 44);
  assert.equal(civicStyles.iconButton.height, 44);
  assert.equal(civicStyles.card.elevation, 0);
  assert.equal(civicStyles.card.shadowOpacity, 0);
});
