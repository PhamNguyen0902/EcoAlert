const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { QueryClient, QueryObserver } = require("@tanstack/query-core");

function load(file, imports) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    { exports, require: (name) => {
      assert.ok(name in imports, `unexpected dependency ${name}`);
      return imports[name];
    } },
  );
  return exports;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
function memoryStorage(token = "old-token") {
  const state = { token, refresh: "old-refresh", user: null, cleared: 0 };
  return {
    state,
    getToken: async () => state.token,
    getRefreshToken: async () => state.refresh,
    getUser: async () => state.user,
    setToken: async (value) => { state.token = value; },
    setRefreshToken: async (value) => { state.refresh = value; },
    setUser: async (value) => { state.user = value; },
    clearAll: async () => {
      state.cleared++; state.token = null; state.refresh = null; state.user = null;
    },
  };
}
function hooks(client, storage = memoryStorage()) {
  return load("hooks/useAuth.ts", {
    "@tanstack/react-query": {
      useQueryClient: () => client,
      useMutation: (options) => options,
      useQuery: (options) => options,
    },
    "../api/authService": { authService: {} },
    "../utils/storage": { storage },
  });
}
function service(storage, api = {}, post = async () => ({})) {
  return load("api/authService.ts", {
    "./client": { api },
    "../utils/storage": { storage },
    axios: { __esModule: true, default: { post } },
    "../utils/constants": { API_BASE_URL: "http://test.invalid/api" },
  }).authService;
}
function interceptedClient(storage, post = async () => ({})) {
  const handlers = {};
  const api = async () => ({ data: { retried: true } });
  api.interceptors = {
    request: { use: (fulfilled) => { handlers.request = fulfilled; } },
    response: { use: (_, rejected) => { handlers.error = rejected; } },
  };
  const exports = load("api/client.ts", {
    axios: { __esModule: true, default: { create: () => api, post } },
    "../utils/storage": { storage },
    "../utils/constants": { API_BASE_URL: "http://test.invalid/api" },
  });
  return { ...exports, handlers };
}
const unauthorized = (token = "old-token", url = "/v1/users/profile") => ({
  response: { status: 401 },
  config: { url, headers: { Authorization: `Bearer ${token}` } },
});

test("logout/repeated expired-session cleanup preserves Root profile observer across all roles", async () => {
  const client = new QueryClient();
  client.setQueryData(["profile"], null);
  const observer = new QueryObserver(client, {
    queryKey: ["profile"], queryFn: async () => null, enabled: false,
  });
  const unsubscribe = observer.subscribe(() => {});
  const profileQuery = client.getQueryCache().find({ queryKey: ["profile"] });
  const auth = hooks(client);
  for (const role of ["CITIZEN", "OFFICER", "ADMIN"]) {
    client.setQueryData(["alerts", role], [{ private: true }]);
    client.setQueryData(["notifications", role], [{ private: true }]);
    auth.useLogout().onSuccess();
    auth.clearAuthQueryCache(client); // Late/duplicate expired-session callback.
    assert.equal(client.getQueryCache().find({ queryKey: ["profile"] }), profileQuery);
    assert.equal(observer.getCurrentResult().data, null);
    assert.equal(client.getQueryData(["alerts", role]), undefined);
    assert.equal(client.getQueryData(["notifications", role]), undefined);
    await auth.useLogin().onMutate();
    auth.useLogin().onSuccess({ user: { _id: role, role } });
    assert.equal(observer.getCurrentResult().data.role, role);
  }
  unsubscribe(); client.clear();
});

test("login cancels an old in-flight profile query before installing the new user", async () => {
  const client = new QueryClient();
  const old = deferred();
  const pending = client.fetchQuery({ queryKey: ["profile"], queryFn: () => old.promise });
  const canceled = pending.catch(() => null);
  const login = hooks(client).useLogin();
  await login.onMutate();
  login.onSuccess({ user: { _id: "new-user", role: "CITIZEN" } });
  old.resolve({ _id: "old-user" });
  await canceled;
  assert.equal(client.getQueryData(["profile"])._id, "new-user");
  client.clear();
});

test("logout clears local storage immediately and sends captured authorization outside shared client", async () => {
  const storage = memoryStorage();
  const network = deferred();
  let request;
  const auth = service(storage, { post: () => assert.fail("shared interceptor used") }, (...args) => {
    request = args; return network.promise;
  });
  await auth.logout(); // Must complete even while the server request is pending.
  assert.equal(storage.state.token, null);
  assert.equal(request[0], "http://test.invalid/api/v1/auth/logout");
  assert.equal(request[1].refreshToken, "old-refresh");
  assert.equal(request[2].headers.Authorization, "Bearer old-token");
  assert.equal(request[2].timeout, 5000);
  storage.state.token = "new-token";
  network.reject(new Error("outgoing session expired"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(storage.state.token, "new-token");
});

test("late profile response cannot overwrite secure storage belonging to another login", async () => {
  const storage = memoryStorage();
  const response = deferred();
  const auth = service(storage, { get: () => response.promise });
  const profile = auth.getProfile();
  await Promise.resolve();
  storage.state.token = "new-token";
  storage.state.user = { _id: "new-user" };
  response.resolve({ data: { data: { _id: "old-user" } } });
  await assert.rejects(profile, /Session changed/);
  assert.equal(storage.state.user._id, "new-user");
});

test("malformed HTTP 200 login shows an error instead of silently staying on Login", async () => {
  const storage = memoryStorage(null);
  const auth = service(storage, { post: async () => ({ data: { data: {} } }) });
  await assert.rejects(auth.login({ email: "test@example.test", password: "not-a-real-password" }), /không hợp lệ/);
  assert.equal(storage.state.token, null);
});

test("a valid backend login response still saves tokens/user for role-based navigation", async () => {
  const storage = memoryStorage(null);
  const user = { _id: "signed-in-user", role: "OFFICER" };
  const auth = service(storage, {
    post: async (url) => {
      assert.equal(url, "/v1/auth/login");
      return { data: { success: true, data: { accessToken: "new-token", refreshToken: "new-refresh", user } } };
    },
  });
  const result = await auth.login({ email: "test@example.test", password: "not-a-real-password" });
  assert.equal(result.user, user);
  assert.equal(storage.state.token, "new-token");
  assert.equal(storage.state.refresh, "new-refresh");
  assert.equal(storage.state.user, user);
});

test("logout/login/register 401 responses never invoke refresh or global logout", async () => {
  const storage = memoryStorage("new-token");
  const client = interceptedClient(storage, () => assert.fail("refresh attempted"));
  client.setUnauthorizedCallback(() => assert.fail("global logout invoked"));
  for (const route of ["logout", "login", "register", "refresh-token"])
    await assert.rejects(client.handlers.error(unauthorized("old-token", `/v1/auth/${route}`)));
  assert.equal(storage.state.cleared, 0);
});

test("a stale or anonymous request's 401 cannot clear the current session", async () => {
  const storage = memoryStorage("new-token");
  const client = interceptedClient(storage, () => assert.fail("refresh attempted"));
  client.setUnauthorizedCallback(() => assert.fail("global logout invoked"));
  await assert.rejects(client.handlers.error(unauthorized()));
  await assert.rejects(client.handlers.error({ response: { status: 401 }, config: { url: "/v1/users/profile", headers: {} } }));
  assert.equal(storage.state.token, "new-token");
  assert.equal(storage.state.cleared, 0);
});

test("failed refresh expires the active session without deleting the observed profile query", async () => {
  const storage = memoryStorage();
  const client = new QueryClient();
  client.setQueryData(["profile"], { _id: "old-user" });
  const identity = client.getQueryCache().find({ queryKey: ["profile"] });
  const auth = hooks(client, storage);
  const api = interceptedClient(storage, async () => { throw new Error("refresh expired"); });
  api.setUnauthorizedCallback(() => auth.clearAuthQueryCache(client));
  await assert.rejects(api.handlers.error(unauthorized()), /refresh expired/);
  assert.equal(storage.state.token, null);
  assert.equal(client.getQueryData(["profile"]), null);
  assert.equal(client.getQueryCache().find({ queryKey: ["profile"] }), identity);
  client.clear();
});

test("a late successful/failed refresh never replaces or clears a newer login", async () => {
  for (const success of [true, false]) {
    const storage = memoryStorage();
    const response = deferred();
    const started = deferred();
    const client = interceptedClient(storage, () => { started.resolve(); return response.promise; });
    client.setUnauthorizedCallback(() => assert.fail("new session logged out"));
    const rejection = assert.rejects(client.handlers.error(unauthorized()));
    await started.promise;
    storage.state.token = "new-token";
    storage.state.refresh = "new-refresh";
    if (success) response.resolve({ data: { data: { accessToken: "stale-refreshed-token", refreshToken: "stale-refresh" } } });
    else response.reject(new Error("old refresh rejected"));
    await rejection;
    assert.equal(storage.state.token, "new-token");
    assert.equal(storage.state.refresh, "new-refresh");
    assert.equal(storage.state.cleared, 0);
  }
});

test("normal concurrent 401 requests share one refresh and both retry with fresh authorization", async () => {
  const storage = memoryStorage();
  const response = deferred();
  const started = deferred();
  let refreshCalls = 0;
  const client = interceptedClient(storage, (url, body, config) => {
    refreshCalls++;
    assert.equal(url, "http://test.invalid/api/v1/auth/refresh-token");
    assert.equal(body.refreshToken, "old-refresh");
    assert.equal(config.timeout, 30000);
    started.resolve();
    return response.promise;
  });
  const firstError = unauthorized();
  const secondError = unauthorized("old-token", "/v1/alerts");
  const first = client.handlers.error(firstError);
  await started.promise;
  const second = client.handlers.error(secondError);
  await Promise.resolve();
  response.resolve({ data: { data: { accessToken: "fresh-token", refreshToken: "fresh-refresh" } } });
  const results = await Promise.all([first, second]);
  assert.equal(refreshCalls, 1);
  assert.ok(results.every((result) => result.data.retried));
  assert.equal(firstError.config.headers.Authorization, "Bearer fresh-token");
  assert.equal(secondError.config.headers.Authorization, "Bearer fresh-token");
  assert.equal(storage.state.token, "fresh-token");
  assert.equal(storage.state.refresh, "fresh-refresh");
});

test("request interceptor keeps explicit outgoing-session authorization intact", async () => {
  const storage = memoryStorage("new-token");
  const client = interceptedClient(storage);
  const request = await client.handlers.request({ headers: { Authorization: "Bearer old-token" } });
  assert.equal(request.headers.Authorization, "Bearer old-token");
  const current = await client.handlers.request({ headers: {} });
  assert.equal(current.headers.Authorization, "Bearer new-token");
});

test("RootNavigator uses the shared cache cleanup and does not clear/delete the profile subscription", () => {
  const root = fs.readFileSync(path.join(__dirname, "../src/navigation/RootNavigator.tsx"), "utf8");
  assert.match(root, /clearAuthQueryCache\(queryClient\)/);
  assert.doesNotMatch(root, /queryClient\.clear\(|storage\.clearAll\(/);
});
