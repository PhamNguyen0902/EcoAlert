const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const cache = new Map();
function loadTs(file) {
  const target = path.resolve(__dirname, '..', 'src', 'citizen', 'report', file);
  if (cache.has(target)) return cache.get(target).exports;
  const module = { exports: {} };
  cache.set(target, module);
  const js = ts.transpileModule(fs.readFileSync(target, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', js)((name) => {
    if (name.startsWith('.')) return loadTs(path.relative(path.resolve(__dirname, '..', 'src', 'citizen', 'report'), path.resolve(path.dirname(target), name)) + '.ts');
    return require(name);
  }, module, module.exports);
  return module.exports;
}

const { createEmptyFieldReportDraft, MAX_FIELD_REPORT_PHOTOS } = loadTs('types.ts');
const { addPhoto, removePhoto, selectPrimaryPhoto, normalizePhotoDraft, updatePhoto } = loadTs('photoDraft.ts');
const { fieldLocationReady } = loadTs('components/stitch/fieldPresentation.ts');
const gps = (accuracy = 12, time = Date.now()) => ({ latitude: 10.8, longitude: 106.7, accuracyMeters: accuracy,
  address: 'Hồ Chí Minh', capturedAt: new Date(time).toISOString(), source: 'DEVICE_GPS' });
const photo = (index) => ({ originalLocalUri: `file:///photo-${index}.jpg`, capturedAt: new Date(Date.now() + index * 1000).toISOString(),
  location: gps(index + 10), width: 1200 + index, height: 1600, uploadState: 'IDLE', visionState: 'IDLE', detections: [] });

test('one photo and five photos preserve individual metadata and the current primary', () => {
  let draft = addPhoto(createEmptyFieldReportDraft(), photo(0));
  assert.equal(draft.photos.length, 1);
  for (let index = 1; index < MAX_FIELD_REPORT_PHOTOS; index++) draft = addPhoto(draft, photo(index));
  assert.equal(draft.photos.length, 5);
  assert.equal(draft.capture.originalLocalUri, 'file:///photo-4.jpg');
  assert.equal(draft.photos[1].width, 1201);
  assert.equal(draft.photos[3].location.accuracyMeters, 13);
  assert.throws(() => addPhoto(draft, photo(5)), /PHOTO_LIMIT/);
});

test('select, retry state, delete and retake only affect the selected photo', () => {
  let draft = addPhoto(addPhoto(createEmptyFieldReportDraft(), photo(0)), photo(1));
  const firstId = draft.photos[0].id;
  draft = selectPrimaryPhoto(draft, firstId);
  assert.equal(draft.capture.id, firstId);
  draft = updatePhoto(draft, firstId, { visionState: 'FAILED' });
  assert.equal(draft.photos[1].visionState, 'IDLE');
  draft = removePhoto(draft, firstId);
  assert.equal(draft.photos.length, 1);
  assert.equal(draft.capture.originalLocalUri, 'file:///photo-1.jpg');
});

test('old single-capture draft migrates without losing the evidence', () => {
  const old = { ...createEmptyFieldReportDraft(), photos: undefined, capture: photo(0) };
  const restored = normalizePhotoDraft(old);
  assert.equal(restored.photos.length, 1);
  assert.equal(restored.capture.id, restored.primaryPhotoId);
});

test('GPS requires fresh accurate device coordinates and rejects denied/invalid data', () => {
  assert.equal(fieldLocationReady(gps(), Date.now()), true);
  assert.equal(fieldLocationReady(gps(75), Date.now()), false);
  assert.equal(fieldLocationReady(gps(12, Date.now() - 6 * 60_000), Date.now()), false);
  assert.equal(fieldLocationReady({ ...gps(), source: 'MANUAL' }, Date.now()), false);
  assert.equal(fieldLocationReady(undefined, Date.now()), false);
});

test('an explicit empty photos array never resurrects a removed legacy capture', () => {
  const draft = normalizePhotoDraft({ ...createEmptyFieldReportDraft(), capture: photo(0) });
  assert.equal(draft.photos.length, 0);
  assert.equal(draft.capture, undefined);
});

test('legacy migration is repeatable and does not duplicate the capture alias or repeated image URIs', () => {
  const old = { ...createEmptyFieldReportDraft(), photos: undefined, capture: photo(0) };
  const migrated = normalizePhotoDraft(old);
  const twice = normalizePhotoDraft(migrated);
  assert.equal(twice.photos.length, 1);
  assert.equal(twice.photos[0].id, migrated.photos[0].id);
  const duplicates = normalizePhotoDraft({ ...twice, photos: [...twice.photos, { ...twice.capture, id: 'another-id' }] });
  assert.equal(duplicates.photos.length, 1);
  assert.equal(addPhoto(twice, twice.capture).photos.length, 1);
});

test('placeholders do not count and adding the first real photo to a clean draft works', () => {
  const draft = normalizePhotoDraft({ ...createEmptyFieldReportDraft(), photos: [{}, null, { originalLocalUri: '' }] });
  assert.equal(draft.photos.length, 0);
  assert.equal(addPhoto(draft, photo(0)).photos.length, 1);
});
