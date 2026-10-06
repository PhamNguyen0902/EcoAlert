const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const read = p => fs.readFileSync(path.join(__dirname, '../src', p), 'utf8');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(read('utils/officerWorkflow.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject });
const tasks = ['ASSIGNED', 'in_progress', 'RESOLVED', 'closed', 'PENDING'].map((status, i) => ({ _id: String(i), status }));
test('task groups use ASSIGNED, IN_PROGRESS and RESOLVED+CLOSED; no PENDING task', () => {
  for (const [filter, count] of [['ALL',4],['NEW',1],['ACTIVE',1],['COMPLETED',2]]) assert.equal(exportsObject.filterOfficerTasks(tasks, filter).length, count);
});
test('operational CTA requires verified check-in, not merely arrivedAt', () => {
  const get = exportsObject.getOfficerTaskState;
  assert.equal(get({status:'ASSIGNED'}).action, 'START');
  assert.equal(get({status:'IN_PROGRESS',arrivedAt:'today'}).action, 'ARRIVE');
  assert.equal(get({status:'in_progress',checkIn:{verified:true}}).action, 'RESOLVE');
  for (const status of ['RESOLVED','CLOSED','PENDING']) assert.equal(get({status}).action,'NONE');
});
test('Officer map disables general alerts query; tasks and map share full assigned task query', () => {
  const map = read('screens/officer/OfficerMapScreen.tsx');
  assert.match(map, /useAlerts\(1, 100, \{\}, isAdminMap\)/);
  assert.match(map, /enabled: !isAdminMap, allPages: true/);
  assert.match(read('screens/officer/OfficerTasksScreen.tsx'), /useOfficerTasks\(1, 100, undefined, \{ allPages: true \}\)/);
  assert.match(map, /getGeoJsonMapCoordinates/);
  assert.match(map, /Xem nhiệm vụ/);
});
test('transport errors are not shown raw; Vietnamese backend validation is readable', () => {
  assert.equal(exportsObject.officerErrorMessage(new Error('Axios network details'), 'Thử lại'), 'Thử lại');
  assert.equal(exportsObject.officerErrorMessage({response:{data:{message:'GPS chưa đủ chính xác'}}}, 'Thử lại'), 'GPS chưa đủ chính xác');
});
