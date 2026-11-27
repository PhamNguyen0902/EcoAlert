const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function readMobile(relPath) {
  return fs.readFileSync(path.join(__dirname, "../src", relPath), "utf8");
}

function loadTsModule(relPath, mockedImports = {}) {
  const source = readMobile(relPath);
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleObj = { exports: {} };
  const fn = new Function("require", "module", "exports", transpiled);
  fn(
    (id) => {
      if (id in mockedImports) return mockedImports[id];
      throw new Error(`Unmocked import "${id}" in ${relPath}`);
    },
    moduleObj,
    moduleObj.exports,
  );
  return moduleObj.exports;
}

test("alertService.getCurrentShift returns null when data envelope has data: null", async () => {
  let responsePayload = { success: true, data: null };
  const mockApi = {
    get: async () => ({ data: responsePayload }),
    post: async () => ({ data: {} }),
    patch: async () => ({ data: {} }),
    delete: async () => ({ data: {} }),
  };

  const { alertService } = loadTsModule("shared/api/alertService.ts", {
    "./client": { api: mockApi },
    "../utils/constants": { API_BASE_URL: "http://localhost:3000/api" },
    "../utils/storage": { storage: { getToken: async () => "t" } },
  });

  assert.equal(await alertService.getCurrentShift(), null);
  responsePayload = { success: true, data: { _id: "shift-1", status: "ACTIVE" } };
  assert.deepEqual(await alertService.getCurrentShift(), { _id: "shift-1", status: "ACTIVE" });
});

test("client.ts 401 interceptor retries concurrent in-flight request after another request refreshes token, while still rejecting stale sessions", async () => {
  let currentToken = "token1";
  let currentRefresh = "refresh1";
  let responseRejector;
  const retriedConfigs = [];
  let refreshCalls = 0;

  const instanceFn = async (config) => {
    retriedConfigs.push({ url: config.url, auth: config.headers.Authorization });
    return { data: { ok: true } };
  };
  instanceFn.interceptors = {
    request: { use: () => {} },
    response: {
      use: (_ok, onErr) => {
        responseRejector = onErr;
      },
    },
  };

  const mockAxios = {
    create: () => instanceFn,
    post: async (url) => {
      assert.match(url, /\/v1\/auth\/refresh-token$/);
      refreshCalls += 1;
      return {
        data: { data: { accessToken: "token2", refreshToken: "refresh2" } },
      };
    },
  };

  loadTsModule("shared/api/client.ts", {
    axios: mockAxios,
    "../utils/constants": { API_BASE_URL: "http://localhost:3000/api" },
    "../utils/storage": {
      storage: {
        getToken: async () => currentToken,
        getRefreshToken: async () => currentRefresh,
        setToken: async (next) => {
          currentToken = next;
        },
        setRefreshToken: async (next) => {
          currentRefresh = next;
        },
        clearAll: async () => {
          currentToken = null;
          currentRefresh = null;
        },
      },
    },
  });

  // Request A arrives first with token1 and triggers refresh -> token2
  const resA = await responseRejector({
    response: { status: 401 },
    config: { url: "/v1/alerts/a", headers: { Authorization: "Bearer token1" } },
  });
  assert.deepEqual(resA, { data: { ok: true } });
  assert.equal(refreshCalls, 1);

  // Request B was also sent with token1 before refresh completed, and hits 401 right after
  const resB = await responseRejector({
    response: { status: 401 },
    config: { url: "/v1/alerts/b", headers: { Authorization: "Bearer token1" } },
  });
  assert.deepEqual(resB, { data: { ok: true } });
  assert.equal(refreshCalls, 1);
  assert.deepEqual(retriedConfigs, [
    { url: "/v1/alerts/a", auth: "Bearer token2" },
    { url: "/v1/alerts/b", auth: "Bearer token2" },
  ]);

  // A stale token0 from an older session must still be rejected
  await assert.rejects(
    responseRejector({
      response: { status: 401 },
      config: { url: "/v1/alerts/old", headers: { Authorization: "Bearer token0" } },
    }),
  );
});

test("useOfficerPosition.refresh returns null instead of stale cached GPS when inactive or failing", async () => {
  const slots = [];
  let cursor = 0;
  let mockActive = false;
  let shouldThrow = false;

  const react = {
    useRef: (val) => {
      const idx = cursor++;
      if (!(idx in slots)) slots[idx] = { current: val };
      return slots[idx];
    },
    useState: (val) => {
      const idx = cursor++;
      if (!(idx in slots)) slots[idx] = { value: val };
      return [
        slots[idx].value,
        (next) => {
          slots[idx].value = typeof next === "function" ? next(slots[idx].value) : next;
        },
      ];
    },
    useEffect: (fn) => {
      fn();
    },
  };

  const { useOfficerPosition } = loadTsModule("officer/hooks/useOfficerPosition.ts", {
    react,
    "react-native": { AppState: { currentState: "active" } },
    "expo-location": {
      Accuracy: { Highest: 6 },
      requestForegroundPermissionsAsync: async () => ({ granted: true }),
      getCurrentPositionAsync: async () => {
        if (shouldThrow) throw new Error("GPS_ERR");
        return {
          timestamp: Date.now(),
          coords: { latitude: 10.77, longitude: 106.7, accuracy: 8 },
        };
      },
    },
    "../utils/officerResolution": {
      acquireOfficerGps: async ({ permission, position }) => {
        if (!(await permission())) throw new Error("Cần quyền GPS");
        return position();
      },
    },
    "../../shared/hooks/useForegroundScreen": {
      useForegroundScreen: () => mockActive,
    },
  });

  const render = () => {
    cursor = 0;
    return useOfficerPosition();
  };

  // Inactive returns null
  assert.equal(await render().refresh(), null);

  // Active success stores fresh GPS
  mockActive = true;
  const fresh = await render().refresh();
  assert.equal(fresh.latitude, 10.77);

  // Subsequent failure or inactive returns null instead of cached fix
  shouldThrow = true;
  assert.equal(await render().refresh(), null);
  mockActive = false;
  assert.equal(await render().refresh(), null);
});

test("Mobile Priority 2B static & flow invariants across auth, socket, GPS/camera, permissions, guest mode, and officer tasks", () => {
  const authSvc = readMobile("auth/api/authService.ts");
  const loginScreen = readMobile("auth/screens/LoginScreen.tsx");
  const socketSrc = readMobile("app/providers/SocketContext.tsx");
  const cameraSrc = readMobile("citizen/report/screens/ReportCameraScreen.tsx");
  const locSrc = readMobile("citizen/report/screens/ReportLocationScreen.tsx");
  const confirmSrc = readMobile("citizen/report/screens/ReportConfirmScreen.tsx");
  const syncSrc = readMobile("citizen/report/hooks/useOfflineSync.ts");
  const checkInSrc = readMobile("officer/screens/OfficerGpsCheckInScreen.tsx");
  const resCamSrc = readMobile("officer/screens/OfficerResolutionCamera.tsx");
  const detailSrc = readMobile("shared/screens/AlertDetailScreen.tsx");
  const myReportsSrc = readMobile("citizen/screens/MyReportsScreen.tsx");
  const dashSrc = readMobile("citizen/screens/CitizenDashboardScreen.tsx");
  const mapSrc = readMobile("citizen/screens/CitizenMapScreen.tsx");
  const settingsSrc = readMobile("citizen/screens/CitizenSettingsScreen.tsx");
  const tasksSrc = readMobile("officer/screens/OfficerTasksScreen.tsx");

  assert.match(authSvc, /\/v1\/auth\/resend-otp/);
  assert.doesNotMatch(authSvc, /\/v1\/auth\/resend-verification/);
  assert.match(loginScreen, /RNAlert\.alert\(/);

  assert.match(socketSrc, /socketInstance\.on\(\s*'ai:analyzed'/);
  assert.doesNotMatch(socketSrc, /socketInstance\.on\(\s*'image:analyzed'/);
  assert.doesNotMatch(socketSrc, /refetchQueries/);

  assert.match(cameraSrc, /if\s*\(\s*!__DEV__\s*\)\s*return;/);
  assert.match(cameraSrc, /clearTimeout\(tapTimeRef\.current\)/);
  assert.match(cameraSrc, /photoId\s*===\s*updatedDraft\.primaryPhotoId/);
  assert.match(locSrc, /updatePhoto\(normalized,\s*normalized\.primaryPhotoId/);
  assert.match(confirmSrc, /const location\s*=\s*capture\?\.location\s*\|\|\s*normalizedDraft\.location/);
  assert.match(syncSrc, /const primaryPhoto\s*=/);

  assert.match(checkInSrc, /const freshGps\s*=\s*await gps\.refresh\(\)/);
  assert.doesNotMatch(checkInSrc, /persistOriginalFieldImage/);
  assert.match(checkInSrc, /FileSystem\.deleteAsync/);

  assert.match(resCamSrc, /if\s*\(\s*!__DEV__\s*\)\s*return;/);
  assert.match(resCamSrc, /clearTimeout\(tapTimerRef\.current\)/);

  assert.match(detailSrc, /canAssign\s*=\s*isAdmin\s*&&\s*normalizedStatus\s*===\s*"VERIFIED"\s*&&\s*!assignedOfficerIdStr/);
  assert.match(detailSrc, /canDelete\s*=\s*isAdmin\s*\|\|\s*\(Boolean\(isOwnReport\)\s*&&\s*normalizedStatus\s*===\s*"PENDING"\)/);
  assert.match(myReportsSrc, /const canEdit\s*=\s*normalizedStatus\s*===\s*"PENDING"/);

  assert.match(dashSrc, /useAlerts\(\s*1,\s*30,\s*undefined,\s*Boolean\(profile\?._id\)\s*\)/);
  assert.match(mapSrc, /useAlerts\(\s*1,\s*100,\s*undefined,\s*Boolean\(profile\.data\?._id\)\s*\)/);
  assert.match(settingsSrc, /draft\.ownerId\s*===\s*profile\?._id/);

  assert.match(tasksSrc, /\[\.\.\.actionableTasks\]\.sort\(/);
});
