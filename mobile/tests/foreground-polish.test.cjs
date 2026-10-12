const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");

function load(file, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 } },
  ).outputText, { exports, ...globals, require(name) {
    assert.ok(name in imports, `Unexpected import: ${name}`);
    return imports[name];
  } });
  return exports;
}

// Dependency-aware hooks harness: effects clean up on changes and unmount,
// unlike the simpler existing screen fixtures. No real timers/native APIs.
function hookRuntime() {
  let cursor = 0;
  const slots = [], pending = [];
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, (next) => {
        slots[index].value = typeof next === "function" ? next(slots[index].value) : next;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] || (slots[index] = { current: initial });
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        pending.push(() => {
          previous?.cleanup?.();
          slots[index] = { deps, cleanup: effect() };
        });
      }
    },
  };
  return { hooks, render(fn) { cursor = 0; return fn(); },
    flush() { pending.splice(0).forEach((fn) => fn()); },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); },
  };
}

test("foreground focus and clock stop on blur/background, refresh immediately on resume and unsubscribe", () => {
  const runtime = hookRuntime(), intervals = new Map();
  let focused = true, change, removed = 0, time = 1000, timerId = 0;
  const { useForegroundScreen, useScreenClock } = load("hooks/useForegroundScreen.ts", {
    react: runtime.hooks,
    "@react-navigation/native": { useIsFocused: () => focused },
    "react-native": { AppState: { currentState: "active", addEventListener(event, listener) {
      assert.equal(event, "change"); change = listener;
      return { remove() { removed++; } };
    } } },
  }, { Date: { now: () => time }, setInterval(fn, interval) {
    assert.equal(interval, 15000); intervals.set(++timerId, fn); return timerId;
  }, clearInterval(id) { intervals.delete(id); } });
  const screen = () => {
    const active = useForegroundScreen();
    return { active, now: useScreenClock(15000, active) };
  };
  const render = () => { const result = runtime.render(screen); runtime.flush(); return result; };
  assert.deepEqual(render(), { active: true, now: 1000 });
  assert.equal(intervals.size, 1);
  time = 16000; [...intervals.values()][0]();
  assert.equal(render().now, 16000);
  change("background"); render();
  assert.equal(intervals.size, 0);
  time = 400000; change("active"); render();
  assert.equal(render().now, 400000); // no wait for the next 15-second tick
  focused = false; render();
  assert.equal(intervals.size, 0);
  focused = true; render();
  assert.equal(intervals.size, 1);
  runtime.unmount();
  assert.equal(intervals.size, 0);
  assert.equal(removed, 1);
});

test("scan line retains 12–85% range and 3.6s cycle using non-interacting native transforms; pauses and respects Reduce Motion", async () => {
  const runtime = hookRuntime(), timings = [], loops = [];
  let active = true, reduceMotion;
  const { FieldScanLine } = load("features/report/components/stitch/FieldUI.tsx", {
    react: runtime.hooks,
    "react-native": {
      View: "View", Text: "Text", StyleSheet: { create: (value) => value, absoluteFill: {} },
      AccessibilityInfo: {
        isReduceMotionEnabled: async () => false,
        addEventListener(_event, listener) { reduceMotion = listener; return { remove() {} }; },
      },
      Animated: {
        View: "AnimatedView",
        Value: class { setValue() {} interpolate(value) { return value; } },
        timing(_value, options) { timings.push(options); return options; },
        sequence: (values) => values,
        loop(sequence) {
          const loop = { sequence, starts: 0, stops: 0, start() { this.starts++; }, stop() { this.stops++; } };
          loops.push(loop); return loop;
        },
      },
    },
    "expo-linear-gradient": { LinearGradient: "LinearGradient" },
    "lucide-react-native": {},
    "../../../../utils/watermark": {},
    "./fieldDesign": { fieldColors: {}, fieldStyles: {} },
    "../../../../hooks/useForegroundScreen": { useForegroundScreen: () => active },
  });
  const render = () => { const tree = runtime.render(FieldScanLine); runtime.flush(); return tree; };
  let tree = render();
  tree.props.onLayout({ nativeEvent: { layout: { height: 500 } } });
  await Promise.resolve(); // actual OS Reduce Motion result, not a forced initial value
  tree = render();
  assert.equal(loops.length, 1);
  assert.equal(loops[0].starts, 1);
  assert.equal(timings.length, 2);
  for (const timing of timings) {
    assert.equal(timing.useNativeDriver, true);
    assert.equal(timing.isInteraction, false);
    assert.equal(timing.duration, 1800);
  }
  const style = tree.props.children.props.style[1];
  assert.equal(style.top, 0);
  assert.deepEqual(Array.from(style.transform[0].translateY.outputRange), [60, 425]);
  assert.equal(tree.props.pointerEvents, "none");
  assert.equal(tree.props.importantForAccessibility, "no-hide-descendants");
  active = false; render();
  assert.equal(loops[0].stops, 1);
  assert.equal(loops.length, 1);
  active = true; render();
  assert.equal(loops.length, 2);
  reduceMotion(true); render();
  assert.equal(loops[1].stops, 1);
  assert.equal(loops.length, 2);
  reduceMotion(false); render();
  assert.equal(loops.length, 3);
  runtime.unmount();
  assert.equal(loops[2].stops, 1);
});

test("live HUD updates only its local clock; skeleton exposes a single loading announcement", () => {
  const clocks = [];
  const { FieldLiveEvidenceMetaOverlay } = load("features/report/components/stitch/FieldUI.tsx", {
    react: React,
    "react-native": { StyleSheet: { create: (value) => value } },
    "expo-linear-gradient": {}, "lucide-react-native": {}, "../../../../utils/watermark": {},
    "./fieldDesign": { fieldColors: {}, fieldStyles: {} },
    "../../../../hooks/useForegroundScreen": { useScreenClock(interval, active) {
      clocks.push([interval, active]); return Date.parse("2026-10-12T10:00:00Z");
    } },
  }, { Date });
  const location = { latitude: 10.8, longitude: 106.7 };
  const overlay = FieldLiveEvidenceMetaOverlay({ location, active: true });
  assert.equal(overlay.props.timestamp, "2026-10-12T10:00:00.000Z");
  assert.equal(overlay.props.location, location);
  FieldLiveEvidenceMetaOverlay({ location, active: false });
  assert.deepEqual(clocks, [[1000, true], [1000, false]]);
  const { CitizenActivitySkeleton } = load("components/citizen/CitizenActivitySkeleton.tsx", {
    react: React, "react-native": { View: "View", StyleSheet: { create: (value) => value } },
    "../ui/Card": { Card: "Card" },
    "../../theme/useCivicTheme": { useCivicTheme: () => ({ colors: { borderStrong: "#334155" } }) },
    "../../theme/civicDesign": { civicSpace: { md: 12, sm: 8 }, civicRadius: { chip: 10 } },
  });
  const skeleton = CitizenActivitySkeleton();
  assert.equal(skeleton.props.accessibilityState.busy, true);
  assert.equal(skeleton.props.accessibilityLabel, "Đang tải hoạt động gần đây");
  assert.equal(skeleton.props.children.length, 2);
  assert.ok(skeleton.props.children.every((row) => row.props.accessibilityElementsHidden));
});

test("shared section actions and settings rows expose context without changing callbacks", () => {
  const { CitizenSectionHeading, CitizenSettingsRow } = load("components/citizen/v2/CitizenUI.tsx", {
    react: React,
    "react-native": { View: "View", Text: "Text", Pressable: "Pressable", StyleSheet: { create: (value) => value } },
    "lucide-react-native": {},
    "../../../theme/useCivicTheme": { useCivicTheme: () => ({ colors: {} }) },
    "../../../theme/civicDesign": { civicStyles: {}, civicType: {} },
    "../../../utils/notificationNavigation": {},
  });
  let presses = 0;
  const onPress = () => presses++;
  const section = CitizenSectionHeading({ title: "Hoạt động gần đây", action: "Tất cả", onPress });
  const action = section.props.children.find((node) => node?.type === "Pressable");
  assert.equal(action.props.accessibilityLabel, "Tất cả: Hoạt động gần đây");
  const row = CitizenSettingsRow({ icon: "Icon", title: "Quyền camera", detail: "Đã cấp quyền", onPress });
  assert.equal(row.props.accessibilityLabel, "Quyền camera. Đã cấp quyền");
  action.props.onPress(); row.props.onPress();
  assert.equal(presses, 2);
});
