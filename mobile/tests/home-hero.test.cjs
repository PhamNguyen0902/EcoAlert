const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const ROOT = path.join(__dirname, "../src/components/citizen/hero");
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
      require: (name) => {
        assert.ok(name in imports, `Unexpected import: ${name}`);
        return imports[name];
      },
    },
  );
  return exports;
}
const rn = {
  View: "View",
  Text: "Text",
  Image: "Image",
  Pressable: "Pressable",
  StyleSheet: {
    create: (s) => s,
    absoluteFill: { position: "absolute", inset: 0 },
  },
};
const icons = new Proxy({}, { get: (_, name) => String(name) });
const motion = {
  enabled: false,
  drift: { value: 0 },
  levitation: { value: 0 },
  entrance: { value: 1 },
};
const animated = {
  __esModule: true,
  default: { View: "AnimatedView" },
  useAnimatedStyle: (fn) => fn(),
};
const design = load("heroStyles.ts", {
  "react-native": rn,
  "../../../theme/civicDesign": {
    civicSpace: { lg: 16 },
    civicType: { meta: {} },
  },
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
function hero(user, dark = true, onReport = () => {}, onTrack = () => {}) {
  const { HomeHero } = load("HomeHero.tsx", {
    react: React,
    "react-native": rn,
    "react-native-reanimated": animated,
    "expo-linear-gradient": { LinearGradient: "LinearGradient" },
    "lucide-react-native": icons,
    "../../../theme/useCivicTheme": { useCivicTheme: () => ({ isDark: dark }) },
    "./AnimatedTopographicBackground": {
      AnimatedTopographicBackground: "Terrain",
    },
    "./EcoCityIllustration": { EcoCityIllustration: "City" },
    "./HeroActionButtons": { HeroActionButtons: "Actions" },
    "./heroStyles": design,
    "./useHeroMotion": { useHeroMotion: () => motion },
  });
  return HomeHero.type({ user, onReport, onTrack });
}
test("hero presents real profile; long names retain their full accessible label and bounded text column", () => {
  const name = "Nguyễn Thị Hoàng Phương Anh Nguyễn";
  const tree = hero({ fullName: name });
  assert.match(text(tree), /Nguyễn Thị Hoàng Phương Anh Nguyễn/);
  assert.match(text(tree), /CÔNG DÂN/);
  const label = nodes(tree).find((n) => n.props?.accessibilityLabel === name);
  assert.equal(label.props.numberOfLines, 2);
  assert.equal(label.props.ellipsizeMode, "tail");
  const copy = nodes(tree).find(
    (n) => n.props?.style === design.heroStyles.copy,
  );
  assert.equal(copy.props.style.minWidth, 0);
  assert.equal(copy.props.style.flex, 1);
});
test("guest and blank profile names have an honest fallback; actions preserve caller callbacks", () => {
  const calls = [];
  const tree = hero(
    null,
    true,
    () => calls.push("ReportTab"),
    () => calls.push("MyReportsTab"),
  );
  assert.match(text(tree), /Chào mừng bạn!/);
  assert.match(text(tree), /Khách EcoAlert/);
  assert.doesNotMatch(text(tree), /CÔNG DÂN/);
  assert.match(text(hero({ fullName: "  " })), /Khách EcoAlert/);
  const actions = nodes(tree).find((n) => n.type === "Actions");
  actions.props.onReport();
  actions.props.onTrack();
  assert.deepEqual(calls, ["ReportTab", "MyReportsTab"]);
});
function luminance(hex) {
  const parts = hex
    .match(/[a-f\d]{2}/gi)
    .map((c) => parseInt(c, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return parts[0] * 0.2126 + parts[1] * 0.7152 + parts[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
test("both themes retain readable text, distinct surfaces and the same original city artwork", () => {
  for (const dark of [true, false]) {
    const palette = design.heroPalette(dark);
    for (const background of palette.gradient) {
      assert.ok(contrast(palette.text, background) > 4.5);
      assert.ok(contrast(palette.secondary, background) > 4.5);
    }
    const tree = hero({ fullName: "An" }, dark);
    assert.equal(
      nodes(tree).find((n) => n.type === "Terrain").props.dark,
      dark,
    );
    assert.ok(nodes(tree).find((n) => n.type === "City"));
  }
  assert.notEqual(
    design.heroPalette(true).background,
    design.heroPalette(false).background,
  );
});
function lifecycle({ reduced = false, focused = true, state = "active" } = {}) {
  const environment = { focused, reduced },
    states = [],
    refs = [],
    previous = [],
    pending = [],
    listeners = {},
    calls = [];
  let cursor = 0;
  const hooks = {
    useState: (initial) => {
      const i = cursor++;
      if (!(i in states)) states[i] = initial;
      return [
        states[i],
        (value) => {
          states[i] = value;
        },
      ];
    },
    useEffect: (fn, deps) => {
      const i = cursor++,
        old = previous[i];
      if (!old || deps.some((d, j) => !Object.is(d, old.deps[j])))
        pending.push(() => {
          old?.cleanup?.();
          previous[i] = { deps, cleanup: fn() };
        });
    },
  };
  const reanimated = {
    useReducedMotion: () => environment.reduced,
    useSharedValue: (value) => {
      const i = cursor++;
      return refs[i] || (refs[i] = { value });
    },
    cancelAnimation: (ref) => calls.push(["cancel", ref]),
    withTiming: (value, options) => ({ kind: "timing", value, options }),
    withRepeat: (animation, count, reverse) => ({
      kind: "repeat",
      animation,
      count,
      reverse,
    }),
    Easing: {
      sin: "sin",
      cubic: "cubic",
      inOut: (value) => value,
      out: (value) => value,
    },
    ReduceMotion: { System: "system" },
  };
  const subscribe = (name, listener) => {
    listeners[name] = listener;
    return {
      remove: () => {
        delete listeners[name];
      },
    };
  };
  const { useHeroMotion } = load("useHeroMotion.ts", {
    react: hooks,
    "react-native": {
      AppState: {
        currentState: state,
        addEventListener: (_, fn) => subscribe("app", fn),
      },
      AccessibilityInfo: {
        addEventListener: (_, fn) => subscribe("reduced", fn),
      },
    },
    "@react-navigation/native": { useIsFocused: () => environment.focused },
    "react-native-reanimated": reanimated,
  });
  const render = () => {
    cursor = 0;
    const value = useHeroMotion();
    pending.splice(0).forEach((fn) => fn());
    return value;
  };
  return {
    render,
    environment,
    listeners,
    calls,
    unmount: () => previous.forEach((effect) => effect?.cleanup?.()),
  };
}
test("terrain/city loops reverse gently and cancel/reset on blur, then resume on focus", () => {
  const f = lifecycle(),
    first = f.render();
  assert.equal(first.enabled, true);
  assert.equal(first.drift.value.animation.options.duration, 7000);
  assert.equal(first.levitation.value.animation.options.duration, 1800);
  assert.equal(first.drift.value.count, -1);
  assert.equal(first.drift.value.reverse, true);
  f.environment.focused = false;
  const blurred = f.render();
  assert.equal(blurred.enabled, false);
  assert.equal(blurred.drift.value, 0);
  assert.equal(blurred.levitation.value, 0);
  assert.equal(blurred.entrance.value, 1);
  assert.ok(f.calls.some((c) => c[1] === first.drift));
  f.environment.focused = true;
  assert.equal(f.render().drift.value.kind, "repeat");
  f.unmount();
  assert.deepEqual(Object.keys(f.listeners), []);
});
test("Reduce Motion initial/change and app background freeze the scene without hiding content", () => {
  const reduced = lifecycle({ reduced: true }),
    staticScene = reduced.render();
  assert.equal(staticScene.enabled, false);
  assert.equal(staticScene.entrance.value, 1);
  assert.equal(staticScene.drift.value, 0);
  const f = lifecycle();
  f.render();
  f.listeners.reduced(true);
  assert.equal(f.render().enabled, false);
  f.listeners.reduced(false);
  f.listeners.app("background");
  assert.equal(f.render().enabled, false);
  f.listeners.app("active");
  assert.equal(f.render().enabled, true);
});
test("decorative layers do not intercept touches or appear in accessibility navigation", () => {
  const { EcoCityIllustration } = load("EcoCityIllustration.tsx", {
    react: React,
    "react-native": rn,
    "react-native-reanimated": animated,
    "../../../../assets/hero/eco-city.png": "local-city-asset",
  });
  const { AnimatedTopographicBackground } = load(
    "AnimatedTopographicBackground.tsx",
    {
      react: { ...React, useId: () => "test" },
      "react-native": rn,
      "react-native-reanimated": animated,
      "react-native-svg": {
        __esModule: true,
        default: "Svg",
        ...Object.fromEntries(
          [
            "Circle",
            "Defs",
            "Ellipse",
            "G",
            "Path",
            "RadialGradient",
            "Stop",
          ].map((k) => [k, k]),
        ),
      },
    },
  );
  for (const tree of [
    EcoCityIllustration.type({ motion }),
    AnimatedTopographicBackground.type({ motion, dark: true }),
  ]) {
    assert.equal(tree.props.pointerEvents, "none");
    assert.equal(tree.props.accessibilityElementsHidden, true);
    assert.equal(tree.props.importantForAccessibility, "no-hide-descendants");
  }
  const city = EcoCityIllustration.type({ motion });
  assert.equal(
    nodes(city).find((n) => n.type === "Image").props.source,
    "local-city-asset",
  );
});
test("CTA press animation preserves both handlers and resets on disabling motion", () => {
  const effects = [],
    values = [],
    calls = [];
  const { HeroActionButtons } = load("HeroActionButtons.tsx", {
    react: { ...React, useEffect: (fn) => effects.push(fn) },
    "react-native": rn,
    "react-native-reanimated": {
      ...animated,
      useSharedValue: (value) => {
        const shared = { value };
        values.push(shared);
        return shared;
      },
      withTiming: (value) => value,
      cancelAnimation: (value) => calls.push(value),
    },
    "expo-linear-gradient": { LinearGradient: "LinearGradient" },
    "lucide-react-native": icons,
  });
  const presses = [];
  const group = HeroActionButtons({
    onReport: () => presses.push("report"),
    onTrack: () => presses.push("track"),
    palette: design.heroPalette(true),
    motionEnabled: true,
  });
  const actions = group.props.children.map((child) => child.type(child.props));
  for (const action of actions) {
    const pressable = nodes(action).find((n) => n.type === "Pressable");
    pressable.props.onPressIn();
    pressable.props.onPress();
  }
  assert.deepEqual(presses, ["report", "track"]);
  assert.ok(values.every((v) => v.value === 0.97));
  effects.forEach((effect) => effect()());
  assert.ok(values.every((v) => v.value === 1));
});
