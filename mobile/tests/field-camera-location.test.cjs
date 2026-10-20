const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}
function setup() {
  const slots = [];
  let cursor = 0;
  const react = {
    useRef: value => { const index = cursor++; return slots[index] ||= { current: value }; },
    useState: value => {
      const index = cursor++;
      slots[index] ||= { value };
      return [slots[index].value, update => { slots[index].value = typeof update === 'function' ? update(slots[index].value) : update; }];
    },
    useCallback: fn => fn,
  };
  const native = {
    Accuracy: { Highest: 6 }, requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    getCurrentPositionAsync: async () => ({ coords: { latitude: 10.8, longitude: 106.7, accuracy: 12 }, timestamp: Date.now() }),
  };
  const geocoder = { reverseGeocode: async () => 'Địa chỉ thật' };
  const module = { exports: {} };
  const source = fs.readFileSync(path.resolve(__dirname, '../src/shared/hooks/useLocation.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', js)(name => {
    if (name === 'react') return react;
    if (name === 'expo-location') return native;
    if (name.endsWith('/reverseGeocoder')) return { defaultReverseGeocoder: geocoder };
    throw new Error(`Unexpected import: ${name}`);
  }, module, module.exports);
  return { native, geocoder, render: () => { cursor = 0; return module.exports.useLocation(geocoder); } };
}

test('camera receives a real GPS fix before a slow address lookup completes', async () => {
  const { render, geocoder } = setup();
  const address = deferred();
  geocoder.reverseGeocode = () => address.promise;
  const fix = await render().fetchLocation({ deferAddress: true, timeoutMs: 100 });
  assert.deepEqual(fix.coords.coordinates, [106.7, 10.8]);
  assert.equal(render().loading, false);
  assert.equal(render().addressResolved, false);
  address.resolve('Nguyễn Văn Bảo, TP.HCM');
  await Promise.resolve();
  assert.equal(render().address, 'Nguyễn Văn Bảo, TP.HCM');
});

test('GPS permission denial is explicit and a later retry can succeed', async () => {
  const { render, native } = setup();
  native.requestForegroundPermissionsAsync = async () => ({ status: 'denied' });
  assert.equal(await render().fetchLocation({ deferAddress: true }), null);
  assert.equal(render().errorCode, 'PERMISSION_DENIED');
  assert.equal(render().loading, false);
  native.requestForegroundPermissionsAsync = async () => ({ status: 'granted' });
  assert.ok(await render().fetchLocation({ deferAddress: true }));
  assert.equal(render().errorCode, null);
});

test('a hung GPS request times out without keeping loading true or accepting late data', async () => {
  const { render, native } = setup();
  const position = deferred();
  native.getCurrentPositionAsync = () => position.promise;
  assert.equal(await render().fetchLocation({ deferAddress: true, timeoutMs: 5 }), null);
  assert.equal(render().loading, false);
  assert.equal(render().errorCode, 'UNAVAILABLE');
  position.resolve({ coords: { latitude: 10, longitude: 106, accuracy: 10 }, timestamp: Date.now() });
  await Promise.resolve();
  assert.equal(render().coords, null);
});

test('an old address response cannot overwrite the address for a newer GPS fix', async () => {
  const { render, geocoder } = setup();
  const old = deferred();
  geocoder.reverseGeocode = () => old.promise;
  await render().fetchLocation({ deferAddress: true });
  geocoder.reverseGeocode = async () => 'Địa chỉ mới';
  await render().fetchLocation({ deferAddress: true });
  old.resolve('Địa chỉ cũ');
  await Promise.resolve();
  assert.equal(render().address, 'Địa chỉ mới');
});

test('legacy callers still await the address; geocoding failure preserves device coordinates', async () => {
  const { render, geocoder } = setup();
  assert.equal((await render().fetchLocation()).address, 'Địa chỉ thật');
  geocoder.reverseGeocode = async () => { throw new Error('network down'); };
  const fix = await render().fetchLocation({ deferAddress: true });
  await Promise.resolve();
  assert.equal(fix.source, 'device');
  assert.equal(render().errorCode, null);
  assert.deepEqual(render().coords.coordinates, [106.7, 10.8]);
});
