const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function setup(options = {}) {
  const slots = [];
  let cursor = 0;
  const effects = [];
  let latestValue;
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const memo = (fn, deps) => {
    const i = cursor++;
    if (!slots[i] || !sameDeps(slots[i].deps, deps)) slots[i] = { value: fn(), deps };
    return slots[i].value;
  };
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.length === 1 ? children[0] : children } }),
    useCallback: (fn, deps) => memo(() => fn, deps),
    useMemo: (fn, deps) => { const value = memo(fn, deps); if (value?.saveDraftNow) latestValue = value; return value; },
    useEffect: (fn, deps) => {
      const i = cursor++;
      if (!options.effects || sameDeps(slots[i]?.deps, deps)) return;
      const old = slots[i];
      slots[i] = { deps };
      effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); });
    },
    useRef: value => { const i = cursor++; return slots[i] ||= { current: value }; },
    useState: initial => {
      const i = cursor++;
      slots[i] ||= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }];
    },
  };
  const writes = [];
  const fileUri = 'file:///documents/field-draft-citizen-a.json';
  const memory = new Map(options.raw ? [[fileUri, options.raw]] : []);
  const filesystem = {
    documentDirectory: 'file:///documents/',
    getInfoAsync: async uri => ({ exists: uri.endsWith('.json') ? memory.has(uri) : !(options.missingFiles || []).includes(uri) }),
    readAsStringAsync: async uri => { const raw = memory.get(uri); if (options.readBarrier && uri === fileUri) await options.readBarrier; return raw; },
    writeAsStringAsync: async (uri, data) => { memory.set(uri, data); try { writes.push(JSON.parse(data)); } catch { writes.push(data); } },
  };
  const cache = new Map();
  function load(file) {
    const target = path.resolve(__dirname, '../src/citizen/report', file);
    if (cache.has(target)) return cache.get(target).exports;
    const module = { exports: {} };
    cache.set(target, module);
    const js = ts.transpileModule(fs.readFileSync(target, 'utf8'), {
      fileName: target,
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
    }).outputText;
    new Function('require', 'module', 'exports', '__DEV__', js)(name => {
      if (name === 'react') return react;
      if (name === 'expo-file-system/legacy') return filesystem;
      if (name.endsWith('/useAuth')) return { useProfile: () => ({ data: { _id: 'citizen-a' } }) };
      if (name.endsWith('/ReportDraftRecovery')) return { ReportDraftRecovery: 'DraftRecovery' };
      if (name.startsWith('.')) return load(path.relative(path.resolve(__dirname, '../src/citizen/report'), path.resolve(path.dirname(target), name)) + '.ts');
      throw new Error(`Unexpected import: ${name}`);
    }, module, module.exports, false);
    return module.exports;
  }
  const { FieldReportProvider } = load('FieldReportContext.tsx');
  const { addPhoto } = load('photoDraft.ts');
  const render = () => { cursor = 0; const tree = FieldReportProvider({ children: 'ReportScreens' }); while (effects.length) effects.shift()(); return tree; };
  render();
  // Persistence and hydration effects are exercised elsewhere; expose the hydrated provider here.
  if (!options.effects) slots[0].value = true;
  return { context: () => { render(); return latestValue; }, render, filesystem, writes, addPhoto, memory, fileUri,
    load, dispose: () => slots.forEach(slot => slot?.cleanup?.()) };
}
const photo = id => ({ id, originalLocalUri: `file:///documents/${id}.jpg`, capturedAt: new Date().toISOString() });

test('an older capture callback appends to the latest draft without losing earlier photos or edits', async () => {
  const { context, writes, addPhoto } = setup();
  const oldSave = context().saveDraftNow;
  context().setDraft(current => ({ ...addPhoto(current, photo('one')), title: 'Tiêu đề mới' }));
  await oldSave(current => addPhoto(current, photo('two')));
  assert.deepEqual(context().draft.photos.map(item => item.id), ['one', 'two']);
  assert.equal(context().draft.title, 'Tiêu đề mới');
  assert.deepEqual(writes.at(-1).active.photos.map(item => item.id), ['one', 'two']);
});

test('a failed JSON write keeps the captured file recoverable and a later save succeeds', async () => {
  const { context, filesystem, writes, addPhoto } = setup();
  const write = filesystem.writeAsStringAsync;
  filesystem.writeAsStringAsync = async () => { throw new Error('disk unavailable'); };
  await assert.rejects(context().saveDraftNow(current => addPhoto(current, photo('one'))));
  assert.equal(context().draft.photos[0].originalLocalUri, 'file:///documents/one.jpg');
  filesystem.writeAsStringAsync = write;
  await context().saveDraftNow(current => current);
  assert.equal(writes.at(-1).active.photos.length, 1);
});

const settle = () => new Promise(resolve => setImmediate(resolve));
const oldFive = () => ({ id: 'field_old_five', photos: Array.from({ length: 5 }, (_, i) => photo(`old-${i}`)),
  primaryPhotoId: 'old-0', title: 'Bản nháp cũ', description: '', imageValidation: { state: 'IDLE', detectedObjects: [] } });

test('restored five-photo draft requires an explicit choice; a new report starts at zero without deleting old photos', async t => {
  const env = setup({ effects: true, raw: JSON.stringify(oldFive()) });
  t.after(env.dispose);
  await settle();
  const tree = env.render();
  assert.equal(env.context().draft.photos.length, 0);
  const picker = tree.props.children;
  assert.equal(picker.type, 'DraftRecovery');
  assert.equal(picker.props.drafts[0].photos.length, 5);
  await picker.props.onNew();
  assert.equal(env.context().draft.photos.length, 0);
  assert.notEqual(env.context().draft.id, 'field_old_five');
  assert.equal(env.writes.at(-1).savedDrafts[0].photos.length, 5);
  const { captureFieldPhoto } = env.load('cameraCapture.ts');
  let nativeCalls = 0;
  const fix = { latitude: 10.8, longitude: 106.7, accuracyMeters: 10, capturedAt: new Date().toISOString(), address: 'Hồ Chí Minh', source: 'DEVICE_GPS' };
  const camera = { takePictureAsync: async () => { nativeCalls++; return { uri: 'file:///cache/first.jpg' }; } };
  await captureFieldPhoto({ lock: { current: false },
    getSnapshot: () => ({ active: true, focused: true, granted: true, ready: true, camera, location: fix, draft: env.context().draft }),
    refreshLocation: async () => fix, normalizeImage: async () => ({ uri: 'file:///normalized.jpg', width: 1200, height: 1600 }),
    persistImage: async () => 'file:///documents/first-new.jpg',
    savePhoto: async photo => env.context().saveDraftNow(current => env.addPhoto(current, photo)),
    navigateToReview: () => {}, onBusy: () => {}, onStage: () => {}, onPreparedPhoto: () => {},
  });
  assert.equal(nativeCalls, 1);
  assert.equal(env.context().draft.photos.length, 1);
  assert.equal(env.context().draft.capture.originalLocalUri, 'file:///documents/first-new.jpg');
  const restarted = setup({ effects: true, raw: env.memory.get(env.fileUri) });
  t.after(restarted.dispose);
  await settle();
  assert.equal(restarted.render().props.children.props.drafts.length, 2);
  env.context().openSavedDrafts();
  const savedPicker = env.render().props.children;
  await savedPicker.props.onResume('field_old_five');
  assert.equal(env.context().draft.photos.length, 5);
  assert.equal(env.render().props.children, 'ReportScreens');
});

test('late hydration cannot overwrite a freshly reset draft and retains the old draft as a saved choice', async t => {
  let release;
  const readBarrier = new Promise(resolve => { release = resolve; });
  const env = setup({ effects: true, raw: JSON.stringify(oldFive()), readBarrier });
  t.after(env.dispose);
  await settle();
  await env.context().resetDraft();
  const freshId = env.context().draft.id;
  release();
  await settle();
  assert.equal(env.context().draft.id, freshId);
  assert.equal(env.context().draft.photos.length, 0);
  assert.equal(env.context().savedDraftCount, 1);
  await env.context().saveDraftNow(current => current);
  assert.equal(env.writes.at(-1).savedDrafts[0].photos.length, 5);
});

test('completed/queued report is excluded from recovery and the following report has a new client ID and zero photos', async () => {
  const env = setup();
  env.context().setDraft(oldFive());
  await env.context().completeDraft();
  await env.context().resetDraft();
  assert.equal(env.context().draft.photos.length, 0);
  assert.notEqual(env.context().draft.id, 'field_old_five');
  const recovered = env.load('draftStorage.ts').decodeDraftCollection(JSON.stringify(env.writes.at(-1)));
  assert.equal(recovered.collection.active.photos.length, 0);
  assert.equal(recovered.collection.savedDrafts.length, 0);
});

test('a late submit response cannot mark a different new report as completed', async () => {
  const env = setup();
  const oldId = env.context().draft.id;
  await env.context().resetDraft();
  const newId = env.context().draft.id;
  await assert.rejects(env.context().completeDraft(oldId), /DRAFT_CHANGED/);
  assert.equal(env.context().draft.id, newId);
  assert.equal(env.context().draft.completedAt, undefined);
});

test('missing local photos and malformed placeholders are excluded from the count while raw data is backed up', async () => {
  const old = oldFive();
  old.photos.push({}, { id: 'placeholder', originalLocalUri: '', capturedAt: new Date().toISOString() });
  const raw = JSON.stringify(old);
  const env = setup({ raw, missingFiles: old.photos.slice(0, 5).map(item => item.originalLocalUri) });
  const result = await env.load('draftStorage.ts').loadDraftCollection(env.fileUri);
  assert.equal(result.collection.active.photos.length, 0);
  assert.ok(result.issues.includes('MISSING_LOCAL_IMAGE'));
  assert.ok([...env.memory.entries()].some(([uri, data]) => uri.includes('.recovery-') && data === raw));
});

test('invalid JSON is preserved byte-for-byte before recovery offers a fresh report', async t => {
  const raw = '{"photos": [broken JSON';
  const env = setup({ effects: true, raw });
  t.after(env.dispose);
  await settle();
  const picker = env.render().props.children;
  assert.equal(picker.props.hasRepairs, true);
  assert.equal(env.memory.get(env.fileUri), raw);
  assert.ok([...env.memory.entries()].some(([uri, data]) => uri.includes('.recovery-') && data === raw));
  await picker.props.onNew();
  assert.equal(env.context().draft.photos.length, 0);
});
