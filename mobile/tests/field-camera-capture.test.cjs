const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const cache = new Map();
function loadTs(file) {
  const target = path.resolve(__dirname, '../src/citizen/report', file);
  if (cache.has(target)) return cache.get(target).exports;
  const module = { exports: {} };
  cache.set(target, module);
  const js = ts.transpileModule(fs.readFileSync(target, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', js)((name) => {
    if (name.startsWith('.')) return loadTs(path.relative(path.resolve(__dirname, '../src/citizen/report'), path.resolve(path.dirname(target), name)) + '.ts');
    return require(name);
  }, module, module.exports);
  return module.exports;
}
const { captureFieldPhoto, captureGpsReady } = loadTs('cameraCapture.ts');
const { createEmptyFieldReportDraft } = loadTs('types.ts');
const { addPhoto, removePhoto } = loadTs('photoDraft.ts');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup() {
  const time = Date.now();
  const fix = { latitude: 10.8, longitude: 106.7, accuracyMeters: 10, address: 'Hồ Chí Minh',
    capturedAt: new Date(time).toISOString(), source: 'DEVICE_GPS' };
  const calls = [];
  let persistedCount = 0;
  const state = { active: true, focused: true, ready: true, granted: true, location: fix,
    draft: createEmptyFieldReportDraft(), camera: { takePictureAsync: async () => { calls.push('native'); return { uri: 'file:///cache/raw.jpg' }; } } };
  const deps = {
    lock: { current: false }, getSnapshot: () => state, now: () => time,
    refreshLocation: async () => { calls.push('gps'); return fix; },
    normalizeImage: async () => ({ uri: 'file:///cache/normalized.jpg', width: 1200, height: 1600 }),
    persistImage: async () => `file:///documents/field-evidence/original${persistedCount++ || ''}.jpg`,
    savePhoto: async photo => { calls.push('save'); if (!state.draft.photos.some(p => p.id === photo.id)) state.draft = addPhoto(state.draft, photo); },
    navigateToReview: () => calls.push('review'), onBusy: busy => calls.push(`busy:${busy}`),
    onStage: stage => calls.push(stage), onPreparedPhoto: photo => { deps.preparedPhoto = photo; },
  };
  return { deps, state, calls, fix, time };
}

test('shutter captures, normalizes, persists, appends metadata and only then opens review', async () => {
  const { deps, state, calls, fix } = setup();
  assert.equal(await captureFieldPhoto(deps), 'REVIEW');
  assert.deepEqual(calls, ['busy:true', 'CAMERA', 'native', 'NORMALIZE', 'PERSIST', 'DRAFT', 'save', 'NAVIGATION', 'review', 'busy:false']);
  assert.equal(state.draft.photos.length, 1);
  assert.equal(state.draft.capture.id, state.draft.primaryPhotoId);
  assert.equal(state.draft.capture.originalLocalUri, 'file:///documents/field-evidence/original.jpg');
  assert.deepEqual(state.draft.capture.location, fix);
  assert.equal(state.draft.capture.height, 1600);
  assert.equal(deps.lock.current, false);
});

test('GPS is refreshed and a camera unmounted by the permission dialog is never called', async () => {
  const { deps, state, calls, fix } = setup();
  state.location = undefined;
  const gps = deferred();
  deps.refreshLocation = () => gps.promise;
  const capture = captureFieldPhoto(deps);
  state.active = false; state.ready = false; state.camera = null;
  gps.resolve(fix);
  await assert.rejects(capture, error => error.code === 'BACKGROUND');
  assert.equal(calls.includes('native'), false);
  assert.equal(deps.lock.current, false);
  state.active = true; state.ready = true;
  state.camera = { takePictureAsync: async () => ({ uri: 'file:///new-session.jpg' }) };
  assert.equal(await captureFieldPhoto(deps), 'REVIEW');
});

test('GPS denied, inaccurate, expired or future fixes cannot bypass field verification; retry succeeds', async () => {
  for (const invalid of [null, { accuracyMeters: 90 }, { age: 31_000 }, { age: -1_000 }]) {
    const { deps, state, calls, fix, time } = setup();
    state.location = undefined;
    deps.refreshLocation = async () => invalid === null ? null : { ...fix, ...invalid,
      capturedAt: new Date(time - (invalid.age || 0)).toISOString() };
    await assert.rejects(captureFieldPhoto(deps), error => error.code === 'GPS_INVALID');
    assert.equal(calls.includes('native'), false);
    assert.equal(deps.lock.current, false);
    deps.refreshLocation = async () => fix;
    assert.equal(await captureFieldPhoto(deps), 'REVIEW');
  }
  assert.equal(captureGpsReady(undefined, Date.now()), false);
});

test('permission, readiness and foreground guards explain rejection and release the lock', async () => {
  for (const [patch, code] of [[{ granted: false }, 'PERMISSION'], [{ ready: false }, 'NOT_READY'],
    [{ camera: null }, 'NOT_READY'], [{ active: false }, 'BACKGROUND'], [{ focused: false }, 'LEFT_FLOW']]) {
    const { deps, state, calls } = setup();
    Object.assign(state, patch);
    await assert.rejects(captureFieldPhoto(deps), error => error.code === code);
    assert.equal(deps.lock.current, false);
    assert.equal(calls.includes('native'), false);
  }
});

test('native errors and missing URI are distinguishable and never leave shutter locked', async () => {
  const { deps, state } = setup();
  const originalError = new Error('native camera failure');
  state.camera.takePictureAsync = async () => { throw originalError; };
  await assert.rejects(captureFieldPhoto(deps), error => error.code === 'CAMERA' && error.originalError === originalError);
  state.camera.takePictureAsync = async () => undefined;
  await assert.rejects(captureFieldPhoto(deps), error => error.code === 'MISSING_URI');
  assert.equal(deps.lock.current, false);
  state.camera.takePictureAsync = async () => ({ uri: 'file:///retry.jpg' });
  assert.equal(await captureFieldPhoto(deps), 'REVIEW');
});

test('normalization, file storage, draft and navigation failures retain their stage', async () => {
  for (const [method, code] of [['normalizeImage', 'NORMALIZE'], ['persistImage', 'PERSIST'], ['savePhoto', 'DRAFT'], ['navigateToReview', 'NAVIGATION']]) {
    const { deps, calls } = setup();
    deps[method] = () => { throw new Error('test failure'); };
    await assert.rejects(captureFieldPhoto(deps), error => error.code === code);
    assert.equal(deps.lock.current, false);
    assert.equal(calls.includes('review'), false);
    if (code === 'DRAFT' || code === 'NAVIGATION') assert.ok(deps.preparedPhoto.originalLocalUri.startsWith('file:///documents/'));
  }
});

test('a hung GPS or native capture times out; late resolution cannot navigate or append photos', async () => {
  for (const step of ['GPS', 'CAMERA']) {
    const { deps, state, calls, fix } = setup();
    const pending = deferred();
    deps.timeoutMs = 5;
    if (step === 'GPS') { state.location = undefined; deps.refreshLocation = () => pending.promise; }
    else state.camera.takePictureAsync = () => pending.promise;
    await assert.rejects(captureFieldPhoto(deps), error => error.code === step);
    assert.equal(deps.lock.current, false);
    pending.resolve(step === 'GPS' ? fix : { uri: 'file:///late.jpg' });
    await Promise.resolve();
    assert.equal(calls.includes('review'), false);
    assert.equal(state.draft.photos.length, 0);
  }
});

test('a second shutter press cannot start another native operation or unlock the first capture', async () => {
  const { deps, state } = setup();
  const picture = deferred();
  state.camera.takePictureAsync = () => picture.promise;
  const first = captureFieldPhoto(deps);
  await assert.rejects(captureFieldPhoto(deps), error => error.code === 'BUSY');
  assert.equal(deps.lock.current, true);
  picture.resolve({ uri: 'file:///first.jpg' });
  await first;
  assert.equal(state.draft.photos.length, 1);
  assert.equal(deps.lock.current, false);
});

test('five successive visits preserve earlier images; deleting one allows another capture', async () => {
  const { deps, state } = setup();
  for (let i = 0; i < 5; i++) {
    deps.preparedPhoto = undefined;
    await captureFieldPhoto(deps);
  }
  const originals = state.draft.photos.map(photo => photo.id);
  deps.preparedPhoto = undefined;
  await assert.rejects(captureFieldPhoto(deps), error => error.code === 'PHOTO_LIMIT');
  state.draft = removePhoto(state.draft, originals[2]);
  await captureFieldPhoto(deps);
  assert.equal(state.draft.photos.length, 5);
  assert.ok(originals.filter((_, index) => index !== 2).every(id => state.draft.photos.some(photo => photo.id === id)));
});

test('background during processing saves evidence without reopening review; resume reuses the photo', async () => {
  const { deps, state, calls } = setup();
  const normalize = deps.normalizeImage;
  deps.normalizeImage = async uri => { state.active = false; return normalize(uri); };
  assert.equal(await captureFieldPhoto(deps), 'SAVED');
  assert.equal(state.draft.photos.length, 1);
  assert.equal(calls.includes('review'), false);
  state.active = true;
  assert.equal(await captureFieldPhoto(deps), 'REVIEW');
  assert.equal(calls.filter(call => call === 'native').length, 1);
  assert.equal(state.draft.photos.length, 1);
});

test('leaving the screen during processing cannot mutate the next draft or reopen the flow', async () => {
  const { deps, state, calls } = setup();
  deps.normalizeImage = async () => { state.focused = false; return { uri: 'file:///late.jpg', width: 100, height: 200 }; };
  await assert.rejects(captureFieldPhoto(deps), error => error.code === 'LEFT_FLOW');
  assert.equal(calls.includes('review'), false);
  assert.equal(state.draft.photos.length, 0);
});
