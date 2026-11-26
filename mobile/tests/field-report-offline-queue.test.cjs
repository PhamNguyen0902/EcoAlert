const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const memory = new Map();
const expoFileSystem = {
  documentDirectory: 'file:///documents/',
  getInfoAsync: async (uri) => ({ exists: memory.has(uri) }),
  readAsStringAsync: async (uri) => memory.get(uri),
  writeAsStringAsync: async (uri, value) => { memory.set(uri, value); },
};
const secureStore = { getItemAsync: async () => null, deleteItemAsync: async () => undefined };
const source = fs.readFileSync(path.resolve(__dirname, '../src/citizen/report/offlineQueue.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleValue = { exports: {} };
new Function('require', 'module', 'exports', js)((name) => {
  if (name === 'expo-file-system/legacy') return expoFileSystem;
  if (name === 'expo-secure-store') return secureStore;
  if (name.endsWith('/shared/utils/storage')) return { storage: { getUser: async () => ({ _id: 'citizen-a' }) } };
  throw new Error(`Unexpected dependency ${name}`);
}, moduleValue, moduleValue.exports);
const { offlineQueue } = moduleValue.exports;

test('offline multi-photo queue survives re-read, retries once and preserves per-photo upload checkpoint', async () => {
  const photo = (id) => ({ id, originalLocalUri: `file:///documents/field-evidence/${id}.jpg`,
    capturedAt: '2026-10-17T08:00:00.000Z', location: { latitude: 10.8, longitude: 106.7,
      accuracyMeters: 10, capturedAt: '2026-10-17T08:00:00.000Z', address: 'Hồ Chí Minh', source: 'DEVICE_GPS' } });
  const input = { clientReportId: 'field_123456789', title: 'Rác ven đường', description: 'Nhiều túi rác cản trở lối đi.',
    location: { type: 'Point', coordinates: [106.7, 10.8] }, localMediaUris: [photo('a').originalLocalUri, photo('b').originalLocalUri],
    photos: [photo('a'), photo('b')], primaryPhotoId: 'b' };
  const first = await offlineQueue.saveOfflineDraft(input);
  const repeated = await offlineQueue.saveOfflineDraft(input);
  assert.equal(repeated.id, first.id);
  assert.equal((await offlineQueue.getOfflineDrafts()).length, 1);
  assert.equal(first.ownerId, 'citizen-a');
  await offlineQueue.updateOfflineDraft(first.id, { photos: [{ ...input.photos[0], originalUploadedUrl: 'https://media.test/a.jpg' }, input.photos[1]] });
  assert.equal((await offlineQueue.getOfflineDrafts())[0].photos[0].originalUploadedUrl, 'https://media.test/a.jpg');
  await offlineQueue.removeOfflineDraft(first.id);
  assert.equal((await offlineQueue.getOfflineDrafts()).length, 0);
});

test('useOfflineSync does not loop on non-owned drafts, releases sync lock on load error, and backs off on 4xx errors', async () => {
  const hookSource = fs.readFileSync(path.resolve(__dirname, '../src/citizen/report/hooks/useOfflineSync.ts'), 'utf8');
  const hookJs = ts.transpileModule(hookSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;

  let drafts = [{
    id: 'other_user_draft',
    clientReportId: 'field_other_user',
    ownerId: 'citizen-other',
    title: 'Other user draft',
    description: 'Should not spin sync for citizen-a',
    location: { type: 'Point', coordinates: [106.7, 10.8] },
    localMediaUris: ['https://bucket.s3.ap-southeast-1.amazonaws.com/ecoalert/a.jpg'],
    photos: [{ id: 'p1', originalLocalUri: 'https://bucket.s3.ap-southeast-1.amazonaws.com/ecoalert/a.jpg', capturedAt: '2026-10-17T08:00:00.000Z' }],
    createdAt: '2026-10-17T08:00:00.000Z',
  }];

  let netInfoListener = null;
  let createCalls = 0;
  let uploadCalls = 0;
  let failCreate = false;
  let failLoadAfterSync = false;
  let getDraftsCalls = 0;
  let syncStates = [];

  const states = [];
  let stateCursor = 0;
  let refCursor = 0;
  const refs = [];
  let callbackCursor = 0;
  const callbacks = [];
  let effectDepsPrev = undefined;
  let effectCalls = 0;
  const queryClientStub = { invalidateQueries: () => {} };

  const hookModule = { exports: {} };
  const reactStub = {
    useState: (init) => {
      const idx = stateCursor++;
      if (!(idx in states)) states[idx] = typeof init === 'function' ? init() : init;
      return [states[idx], (val) => {
        const next = typeof val === 'function' ? val(states[idx]) : val;
        if (idx === 2) syncStates.push(next);
        states[idx] = next;
      }];
    },
    useRef: (init) => (refs[refCursor++] ||= { current: init }),
    useCallback: (fn, deps) => {
      const idx = callbackCursor++;
      const prev = callbacks[idx];
      const changed = !prev || !deps || deps.some((d, i) => !Object.is(d, prev.deps[i]));
      if (changed) callbacks[idx] = { fn, deps: deps || [] };
      return callbacks[idx].fn;
    },
    useEffect: (fn, deps) => {
      const changed = !effectDepsPrev || deps.some((d, i) => !Object.is(d, effectDepsPrev[i]));
      if (changed) {
        effectDepsPrev = deps;
        effectCalls++;
        fn();
      }
    },
  };

  new Function('require', 'module', 'exports', hookJs)((name) => {
    if (name === 'react') return reactStub;
    if (name === '@react-native-community/netinfo') {
      return {
        __esModule: true,
        default: {
          addEventListener: (cb) => {
            netInfoListener = cb;
            cb({ isConnected: true, isInternetReachable: true });
            return () => {};
          },
        },
      };
    }
    if (name === '@tanstack/react-query') return { useQueryClient: () => queryClientStub };
    if (name === '../offlineQueue') {
      return {
        offlineQueue: {
          getOfflineDrafts: async () => {
            getDraftsCalls++;
            if (failLoadAfterSync && getDraftsCalls >= 2) throw new Error('disk failure');
            return drafts;
          },
          updateOfflineDraft: async () => {},
          removeOfflineDraft: async (id) => { drafts = drafts.filter((d) => d.id !== id); },
        },
      };
    }
    if (name === '../../../shared/api/alertService') {
      return {
        alertService: {
          uploadFieldMedia: async () => { uploadCalls++; return { url: 'https://s3/test.jpg', ownershipProof: 'proof' }; },
          createAlert: async () => {
            createCalls++;
            if (failCreate) {
              const err = new Error('Validation failed');
              err.response = { status: 400 };
              throw err;
            }
            return { _id: 'created' };
          },
        },
      };
    }
    if (name === '../../../shared/utils/storage') return { storage: { getUser: async () => ({ _id: 'citizen-a' }) } };
    throw new Error(`Unexpected dependency ${name}`);
  }, hookModule, hookModule.exports);

  const { useOfflineSync, resetOfflineSyncStateForTests } = hookModule.exports;
  resetOfflineSyncStateForTests();

  const renderHook = () => {
    stateCursor = 0;
    refCursor = 0;
    callbackCursor = 0;
    return useOfflineSync();
  };

  // 1. Mount with only another user's draft: must NOT set isSyncing=true or re-subscribe NetInfo repeatedly
  let hook = renderHook();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(effectCalls, 1);
  assert.deepEqual(syncStates, []);
  assert.equal(createCalls, 0);

  // 2. Add a draft owned by citizen-a and simulate permanent 400 failure -> must release lock and not auto-retry in loop
  drafts = [{
    id: 'own_bad_draft',
    clientReportId: 'field_own_bad',
    ownerId: 'citizen-a',
    title: 'Bad draft',
    description: 'Permanent 400 validation error',
    location: { type: 'Point', coordinates: [106.7, 10.8] },
    localMediaUris: ['https://bucket.s3.ap-southeast-1.amazonaws.com/ecoalert/a.jpg'],
    photos: [{ id: 'p1', originalLocalUri: 'https://bucket.s3.ap-southeast-1.amazonaws.com/ecoalert/a.jpg', capturedAt: '2026-10-17T08:00:00.000Z' }],
    createdAt: '2026-10-17T08:00:00.000Z',
  }];
  failCreate = true;
  const firstRun = await hook.syncOfflineDrafts();
  assert.equal(firstRun.errorCount, 1);
  hook = renderHook();
  assert.equal(hook.isSyncing, false);
  assert.equal(effectCalls, 1); // Effect never re-subscribes when isSyncing toggles!

  // Auto transition offline -> online must skip permanent 4xx draft without looping
  netInfoListener({ isConnected: false, isInternetReachable: false });
  netInfoListener({ isConnected: true, isInternetReachable: true });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(createCalls, 1);

  // 3. Post-sync loadDrafts failure inside try/finally must NOT permanently lock syncInProgress
  getDraftsCalls = 0;
  failLoadAfterSync = true;
  failCreate = false;
  await assert.rejects(() => hook.syncOfflineDrafts());
  failLoadAfterSync = false;
  drafts = [{
    id: 'own_good_draft',
    clientReportId: 'field_own_good',
    ownerId: 'citizen-a',
    title: 'Good draft',
    description: 'Recovers cleanly after try/finally release',
    location: { type: 'Point', coordinates: [106.7, 10.8] },
    localMediaUris: ['https://bucket.s3.ap-southeast-1.amazonaws.com/ecoalert/b.jpg'],
    photos: [{ id: 'p2', originalLocalUri: 'https://bucket.s3.ap-southeast-1.amazonaws.com/ecoalert/b.jpg', capturedAt: '2026-10-17T08:00:00.000Z' }],
    createdAt: '2026-10-17T08:00:00.000Z',
  }];
  const recovered = await hook.syncOfflineDrafts();
  assert.equal(recovered.successCount, 1);
  assert.equal(uploadCalls, 0);
});
