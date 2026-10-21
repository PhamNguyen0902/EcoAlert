// Code/render tests only. These do not emulate native MapKit/Google touch delivery.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.React,
        },
      },
    ).outputText,
    {
      exports,
      Date,
      setTimeout,
      clearTimeout,
      require: (id) => {
        assert.ok(id in imports, `Unexpected import ${id}`);
        return imports[id];
      },
    },
  );
  return exports;
}
const cameraUtils = load("officer/utils/officerMapCamera.ts");
const now = Date.now();
const fix = (extra = {}, at = now) => ({
  timestamp: at,
  coords: {
    latitude: 10.8,
    longitude: 106.7,
    accuracy: 8,
    heading: 90,
    speed: 2,
    ...extra,
  },
});
test("heading validates range, course while moving, calibrated compass fallback and stale input", () => {
  const compass = {
    timestamp: now,
    value: { trueHeading: 25, magHeading: 20, accuracy: 3 },
  };
  assert.equal(cameraUtils.navigationHeading(fix(), compass, now), 90);
  assert.equal(
    cameraUtils.navigationHeading(fix({ heading: -1 }), compass, now),
    25,
  );
  assert.equal(
    cameraUtils.navigationHeading(fix({ speed: 0 }), compass, now),
    25,
  );
  assert.equal(
    cameraUtils.navigationHeading(
      null,
      { ...compass, value: { ...compass.value, trueHeading: -1 } },
      now,
    ),
    20,
  );
  assert.equal(
    cameraUtils.navigationHeading(
      null,
      { ...compass, value: { ...compass.value, accuracy: 0 } },
      now,
    ),
    null,
  );
  assert.equal(
    cameraUtils.navigationHeading(
      fix({}, now - 31000),
      { ...compass, timestamp: now - 11000 },
      now,
    ),
    null,
  );
  for (const value of [-1, 360, NaN, Infinity, null])
    assert.equal(cameraUtils.validHeading(value), false);
});
test("follow throttles jitter, crosses north by shortest angle, preserves native zoom/pitch and stops when off", () => {
  const gate = new cameraUtils.FollowCameraGate();
  assert.equal(gate.next(fix(), 359, "off", now), null);
  const first = gate.next(fix(), 359, "heading", now);
  assert.equal(first.heading, 359);
  assert.equal(first.zoom, undefined);
  assert.equal(first.pitch, undefined);
  assert.equal(
    gate.next(fix({ longitude: 106.71 }), 30, "heading", now + 100),
    null,
  );
  assert.equal(gate.next(fix(), 1, "heading", now + 1100), null); // < 5° jitter
  const turn = gate.next(fix(), 10, "heading", now + 2200);
  assert.ok(turn.heading > 0 && turn.heading < 10);
  assert.equal(gate.next(fix({}, now - 40000), 90, "heading", now), null);
  assert.equal(gate.next(fix({ accuracy: null }), 90, "heading", now), null);
  gate.reset();
  assert.equal(gate.next(fix(), 90, "location", now).heading, undefined);
});
function hooks() {
  const slots = [];
  let index = 0,
    effects = [];
  return {
    react: {
      __esModule: true,
      default: React,
      useState(initial) {
        const at = index++;
        if (!slots[at])
          slots[at] = {
            value: typeof initial === "function" ? initial() : initial,
          };
        return [
          slots[at].value,
          (next) => {
            slots[at].value =
              typeof next === "function" ? next(slots[at].value) : next;
          },
        ];
      },
      useRef(initial) {
        const at = index++;
        return (slots[at] ||= { current: initial });
      },
      useCallback(fn, deps) {
        const at = index++;
        if (!slots[at] || deps.some((d, i) => !Object.is(d, slots[at].deps[i])))
          slots[at] = { fn, deps };
        return slots[at].fn;
      },
      useEffect(fn, deps) {
        const at = index++;
        if (
          !slots[at] ||
          !deps ||
          deps.some((d, i) => !Object.is(d, slots[at].deps?.[i]))
        ) {
          effects.push(() => {
            slots[at]?.cleanup?.();
            slots[at] = { deps, cleanup: fn() };
          });
        }
      },
    },
    render(fn, prepare) {
      index = 0;
      const value = fn();
      prepare?.(value);
      const queue = effects;
      effects = [];
      queue.forEach((effect) => effect());
      return value;
    },
    cleanup() {
      slots.forEach((slot) => slot.cleanup?.());
    },
  };
}
const tick = () => new Promise(setImmediate);
test("foreground follow watches stop on pause, background/unmount and late subscriptions are removed", async (t) => {
  const h = hooks();
  t.after(() => h.cleanup());
  let active = true,
    state,
    positionCallback,
    headingCallback,
    positionRemoves = 0,
    headingRemoves = 0;
  const module = load("officer/hooks/useOfficerMapFollow.ts", {
    react: h.react,
    "../utils/officerMapCamera": cameraUtils,
    "expo-location": {
      Accuracy: { High: 4 },
      requestForegroundPermissionsAsync: async () => ({ granted: true }),
      watchPositionAsync: async (options, callback) => {
        assert.equal(options.distanceInterval, 0);
        positionCallback = callback;
        return { remove: () => positionRemoves++ };
      },
      watchHeadingAsync: async (callback) => {
        headingCallback = callback;
        return { remove: () => headingRemoves++ };
      },
    },
  });
  const render = () =>
    (state = h.render(() => module.useOfficerMapFollow(active)));
  render();
  state.start("heading");
  render();
  await tick();
  positionCallback(fix({ speed: 0 }, Date.now()));
  headingCallback({ trueHeading: 125, magHeading: 120, accuracy: 3 });
  render();
  assert.equal(state.heading, 125);
  assert.equal(state.pending, false);
  state.pause();
  render();
  assert.equal(positionRemoves, 1);
  assert.equal(headingRemoves, 1);
  state.start("location");
  render();
  await tick();
  active = false;
  render();
  assert.equal(positionRemoves, 2);
  const late = hooks();
  let finish,
    removed = 0,
    lateState;
  const lateModule = load("officer/hooks/useOfficerMapFollow.ts", {
    react: late.react,
    "../utils/officerMapCamera": cameraUtils,
    "expo-location": {
      Accuracy: { High: 4 },
      requestForegroundPermissionsAsync: async () => ({ granted: true }),
      watchPositionAsync: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  });
  lateState = late.render(() => lateModule.useOfficerMapFollow(true));
  lateState.start("location");
  late.render(() => lateModule.useOfficerMapFollow(true));
  await tick();
  late.cleanup();
  finish({ remove: () => removed++ });
  await tick();
  assert.equal(removed, 1);
});
test("permission denial needs no background permission and leaves camera exploration available", async (t) => {
  const h = hooks();
  t.after(() => h.cleanup());
  let state,
    calls = 0;
  const module = load("officer/hooks/useOfficerMapFollow.ts", {
    react: h.react,
    "../utils/officerMapCamera": cameraUtils,
    "expo-location": {
      requestForegroundPermissionsAsync: async () => ({ granted: false }),
      watchPositionAsync: () => calls++,
    },
  });
  const render = () =>
    (state = h.render(() => module.useOfficerMapFollow(true)));
  render();
  state.start("heading");
  render();
  await tick();
  render();
  assert.equal(calls, 0);
  assert.equal(state.mode, "off");
  assert.match(state.error, /vẫn có thể kéo và zoom/);
});
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}

test("unsupported compass keeps GPS follow working without inventing a bearing", async (t) => {
  const h = hooks();
  t.after(() => h.cleanup());
  let state, callback;
  const module = load("officer/hooks/useOfficerMapFollow.ts", {
    react: h.react,
    "../utils/officerMapCamera": cameraUtils,
    "expo-location": {
      Accuracy: { High: 4 },
      requestForegroundPermissionsAsync: async () => ({ granted: true }),
      watchHeadingAsync: async () => {
        throw new Error("Unsupported");
      },
      watchPositionAsync: async (_, next) => {
        callback = next;
        return { remove() {} };
      },
    },
  });
  const render = () =>
    (state = h.render(() => module.useOfficerMapFollow(true)));
  render();
  state.start("heading");
  render();
  await tick();
  callback(fix({ heading: -1, speed: 0 }, Date.now()));
  render();
  assert.equal(state.mode, "heading");
  assert.equal(state.heading, null);
  assert.equal(state.pending, false);
  assert.equal(state.error, null);
});
function mapFixture(platform) {
  const h = hooks();
  const calls = {
    camera: [],
    fit: [],
    region: [],
    follow: [],
    external: 0,
    queries: [],
  };
  const nativeMap = {
    animateCamera: (...args) => calls.camera.push(args),
    fitToCoordinates: (...args) => calls.fit.push(args),
    animateToRegion: (...args) => calls.region.push(args),
  };
  let follow = {
    mode: "off",
    position: null,
    heading: null,
    pending: false,
    error: null,
    pause: () => {
      calls.follow.push("pause");
    },
    start: (mode) => {
      calls.follow.push(mode);
    },
  };
  const gps = {
    position: {
      latitude: 10.8,
      longitude: 106.7,
      recordedAt: new Date().toISOString(),
    },
    pending: false,
    error: null,
    refresh: async () => gps.position,
  };
  const route = { data: null, isError: false, isFetching: false };
  const task = {
    _id: "task",
    title: "Real task",
    location: { coordinates: [106.71, 10.81] },
  };
  const colors = {
    background: "#07101F",
    surface: "#0B1628",
    primary: "#22C55E",
    cyan: "#38BDF8",
    warning: "#F59E0B",
  };
  const module = load("officer/screens/OfficerOperationalMap.tsx", {
    react: h.react,
    "react-native": {
      ...Object.fromEntries(
        [
          "View",
          "Text",
          "TextInput",
          "Pressable",
          "ScrollView",
          "ActivityIndicator",
        ].map((x) => [x, x]),
      ),
      Platform: { OS: platform },
      Alert: {},
    },
    "react-native-maps": {
      __esModule: true,
      default: "MapView",
      Marker: "Marker",
      Polyline: "Polyline",
      PROVIDER_GOOGLE: "google",
    },
    "@react-navigation/native": {
      useNavigation: () => ({ navigate() {} }),
      useRoute: () => ({ params: { selectedId: "task" } }),
    },
    "@tanstack/react-query": {
      useQuery: (options) => {
        calls.queries.push(options);
        return route;
      },
    },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0 }) },
    "lucide-react-native": Object.fromEntries(
      [
        "Crosshair",
        "Minus",
        "Plus",
        "Search",
        "Flag",
        "RefreshCw",
        "Compass",
        "Navigation2",
      ].map((x) => [x, x]),
    ),
    "../../shared/hooks/useAlerts": {
      useOfficerTasks: () => ({ data: { items: [task] }, refetch() {} }),
    },
    "../hooks/useOfficerPosition": { useOfficerPosition: () => gps },
    "../hooks/useOfficerMapFollow": { useOfficerMapFollow: () => follow },
    "../../shared/hooks/useForegroundScreen": {
      useForegroundScreen: () => true,
      useScreenClock: () => Date.now(),
    },
    "../../shared/theme/useCivicTheme": {
      useCivicTheme: () => ({ colors, isDark: true }),
    },
    "../api/officerRouting": {
      getOfficerRoute() {
        throw new Error("Unexpected API call from gesture");
      },
    },
    "../components/OfficerUI": {
      OfficerHeader: "OfficerHeader",
      officerStyles: {},
    },
    "../components/OfficerTaskCard": {
      OfficerTaskCard: "OfficerTaskCard",
    },
    "../components/OfficerTaskFilters": {
      OfficerTaskFilters: "OfficerTaskFilters",
    },
    "../../shared/components/ui/Button": { Button: "Button" },
    "../../shared/utils/maps": {
      getGeoJsonMapCoordinates: (c) =>
        c ? { latitude: c[1], longitude: c[0] } : null,
      openGoogleMaps: async () => {
        calls.external++;
        return { success: true };
      },
    },
    "../utils/officerWorkflow": {
      filterOfficerTasks: (items) => items,
      getOfficerTaskState: () => ({ color: "#f00" }),
      officerErrorMessage: (_, fallback) => fallback,
    },
    "../utils/officerPresentation": { searchOfficerTasks: (items) => items },
    "../utils/officerMapCamera": cameraUtils,
    "../../shared/hooks/useReducedMotion": {
      useReducedMotion: () => true,
    },
  });
  let all;
  const render = () => {
    h.render(module.OfficerOperationalMap, (tree) => {
      all = nodes(tree);
      all.find((node) => node.type === "MapView").props.ref.current = nativeMap;
    });
    return all;
  };
  return {
    render,
    calls,
    route,
    gps,
    setFollow: (next) => Object.assign(follow, next),
    cleanup: () => h.cleanup(),
  };
}
for (const platform of ["ios", "android"])
  test(`${platform}: native gesture flags, touch-through overlays, buttons and one-time route fit`, async (t) => {
    const f = mapFixture(platform);
    t.after(f.cleanup);
    let all = f.render();
    let map = all.find((node) => node.type === "MapView");
    assert.equal(
      map.props.provider,
      platform === "android" ? "google" : undefined,
    );
    for (const key of [
      "scrollEnabled",
      "zoomEnabled",
      "rotateEnabled",
      "pitchEnabled",
    ])
      assert.equal(map.props[key], true);
    assert.equal(map.props.region, undefined); // Uncontrolled native camera.
    const overlayContainers = all.filter(
      (node) =>
        node.type === "View" && node.props.style?.position === "absolute",
    );
    for (const overlay of overlayContainers)
      assert.ok(["box-none", "none"].includes(overlay.props.pointerEvents));
    for (const button of all.filter((node) => node.type === "Pressable"))
      assert.notEqual(button.props.pointerEvents, "none");
    const mapParent = all.find(
      (node) => node.type === "View" && node.props.onLayout,
    );
    mapParent.props.onLayout({ nativeEvent: { layout: { height: 500 } } });
    map.props.onMapReady();
    all = f.render();
    await all
      .find(
        (node) =>
          node.type === "Button" && node.props.title === "BẮT ĐẦU CHỈ ĐƯỜNG",
      )
      .props.onPress();
    all = f.render();
    const keyBefore = JSON.stringify(f.calls.queries.at(-1).queryKey);
    const data = {
      points: [
        { latitude: 10.8, longitude: 106.7 },
        { latitude: 10.81, longitude: 106.71 },
      ],
      distanceMeters: 1250,
      durationSeconds: 180,
    };
    f.route.data = data;
    all = f.render();
    assert.equal(f.calls.fit.length, 1);
    assert.equal(
      all.find((node) => node.type === "Polyline").props.coordinates,
      data.points,
    );
    map = all.find((node) => node.type === "MapView");
    map.props.onTouchStart({ nativeEvent: { pageX: 20, pageY: 20 } });
    map.props.onTouchMove({
      nativeEvent: { pageX: 40, pageY: 40, touches: [{}] },
    });
    map.props.onRegionChangeComplete({
      latitude: 10.9,
      longitude: 106.9,
      latitudeDelta: 0.2,
      longitudeDelta: 0.2,
    });
    mapParent.props.onLayout({ nativeEvent: { layout: { height: 480 } } });
    f.render();
    assert.equal(f.calls.fit.length, 1);
    assert.equal(f.calls.external, 0);
    assert.equal(JSON.stringify(f.calls.queries.at(-1).queryKey), keyBefore);
    all = f.render();
    all
      .find((node) => node.props.accessibilityLabel === "Theo hướng di chuyển")
      .props.onPress();
    assert.equal(f.calls.follow.at(-1), "heading");
    f.setFollow({
      mode: "heading",
      position: fix({}, Date.now()),
      heading: 90,
    });
    all = f.render();
    assert.equal(f.calls.camera.at(-1)[0].heading, 90);
    assert.equal(f.calls.fit.length, 1);
    map = all.find((node) => node.type === "MapView");
    map.props.onPanDrag({});
    const animations = f.calls.camera.length;
    f.setFollow({
      position: fix({ longitude: 106.73 }, Date.now()),
      heading: 100,
    });
    all = f.render();
    assert.equal(f.calls.camera.length, animations); // Synchronous guard even before hook rerender.
    all
      .find(
        (node) => node.props.accessibilityLabel === "La bàn: trở về hướng Bắc",
      )
      .props.onPress();
    assert.equal(f.calls.camera.at(-1)[0].heading, 0);
    all
      .find(
        (node) => node.props.accessibilityLabel === "Theo vị trí GPS của tôi",
      )
      .props.onPress();
    assert.equal(f.calls.follow.at(-1), "location");
    all
      .find(
        (node) =>
          node.type === "Button" && (node.props.title === "CHỈ ĐƯỜNG XE MÁY (MAPS)" || node.props.title === "MỞ GOOGLE MAPS"),
      )
      .props.onPress();
    await tick();
    assert.equal(f.calls.external, 1);
  });

test("a route requested before native readiness is not discarded and fits once ready", async (t) => {
  const f = mapFixture("ios");
  t.after(f.cleanup);
  let all = f.render();
  await all
    .find((n) => n.type === "Button" && n.props.title === "BẮT ĐẦU CHỈ ĐƯỜNG")
    .props.onPress();
  f.route.data = {
    points: [
      { latitude: 10.8, longitude: 106.7 },
      { latitude: 10.81, longitude: 106.71 },
    ],
    distanceMeters: 1250,
    durationSeconds: 180,
  };
  all = f.render();
  assert.equal(f.calls.fit.length, 0);
  all
    .find((n) => n.props.onLayout)
    .props.onLayout({ nativeEvent: { layout: { height: 500 } } });
  all.find((n) => n.type === "MapView").props.onMapReady();
  all = f.render();
  f.render();
  assert.equal(f.calls.fit.length, 1);
  assert.ok(all.some((n) => n.type === "Polyline"));
});

test("two-finger exploration during route loading prevents a late response stealing the camera", async (t) => {
  const f = mapFixture("ios");
  t.after(f.cleanup);
  let all = f.render();
  all
    .find((n) => n.props.onLayout)
    .props.onLayout({ nativeEvent: { layout: { height: 500 } } });
  all.find((n) => n.type === "MapView").props.onMapReady();
  all = f.render();
  await all
    .find((n) => n.type === "Button" && n.props.title === "BẮT ĐẦU CHỈ ĐƯỜNG")
    .props.onPress();
  all = f.render();
  all
    .find((n) => n.type === "MapView")
    .props.onTouchMove({
      nativeEvent: { pageX: 20, pageY: 20, touches: [{}, {}] },
    });
  f.route.data = {
    points: [
      { latitude: 10.8, longitude: 106.7 },
      { latitude: 10.81, longitude: 106.71 },
    ],
    distanceMeters: 1250,
    durationSeconds: 180,
  };
  all = f.render();
  assert.equal(f.calls.fit.length, 0);
  assert.ok(all.some((n) => n.type === "Polyline"));
  assert.equal(f.calls.external, 0);
});
