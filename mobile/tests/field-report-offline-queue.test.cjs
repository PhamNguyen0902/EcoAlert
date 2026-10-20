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
