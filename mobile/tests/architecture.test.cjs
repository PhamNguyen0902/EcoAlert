const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]);
const files = walk(root).filter(f => /\.tsx?$/.test(f));
const source = f => fs.readFileSync(f, 'utf8');
const edges = new Map();
for (const file of files) {
  const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true);
  const targets = [];
  function visit(n) {
    let spec = (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) ? n.moduleSpecifier : undefined;
    if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || n.expression.getText(ast) === 'require')) spec = n.arguments[0];
    if (spec && ts.isStringLiteral(spec) && spec.text.startsWith('.')) {
      const base = path.resolve(path.dirname(file),spec.text);
      const target = [base,base+'.ts',base+'.tsx',path.join(base,'index.ts'),path.join(base,'index.tsx')].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
      targets.push({ spec:spec.text, target });
    }
    ts.forEachChild(n, visit);
  }
  visit(ast); edges.set(file,targets);
}
test('all local source imports, exports and literal lazy imports resolve', () => {
  for(const [file,imports] of edges) for(const i of imports) assert.ok(i.target,`${file}: ${i.spec}`);
});
test('module graph has no cycles, including type-only edges', () => {
  const complete=new Set();
  function visit(file,stack) {
    assert.ok(!stack.includes(file),`Cycle: ${[...stack,file].join(' -> ')}`);
    if(complete.has(file)) return;
    for(const i of edges.get(file)||[]) if(i.target) visit(i.target,[...stack,file]);
    complete.add(file);
  }
  for(const f of files) visit(f,[]);
});
test('shared foundation cannot depend on feature, app or legacy business modules', () => {
  const allowed=['shared/','theme/','i18n/'];
  for(const [file,imports] of edges) {
    if(!path.relative(root,file).replaceAll('\\','/').startsWith('shared/')) continue;
    for(const i of imports) if(i.target) assert.ok(allowed.some(prefix=>path.relative(root,i.target).replaceAll('\\','/').startsWith(prefix)),`${file}: ${i.spec}`);
  }
});
const expectedRoutes={
  'app/navigation/RootNavigator.tsx':['AdminApp','OfficerApp','CitizenApp','Login','Register','CitizenAppGuest'],
  'app/navigation/CitizenTabNavigator.tsx':['DashboardTab','MapTab','ReportTab','MyReportsTab','SettingsTab','CitizenTabs','ReportFlow','AlertDetail','Profile','Notifications','LocationPicker'],
  'app/navigation/OfficerTabNavigator.tsx':['OfficerTasksTab','OfficerMapTab','OfficerProfileTab','OfficerTabs','OfficerAlertDetail','AlertDetail','OfficerResolution','OfficerTaskList','OfficerGpsCheckIn','OfficerResolutionSubmitted','OfficerNotifications'],
  'app/navigation/AdminTabNavigator.tsx':['AdminIncidentsTab','AdminGisTab','AdminTabs','AlertDetail'],
  'features/report/navigation/ReportFlowNavigator.tsx':['ReportLocation','ReportCamera','ReportPhotoReview','ReportImageValidation','ReportConfirm','ReportSuccess'],
};
test('cross-feature reuse uses only documented public modules',()=>{
  const publicModules=require('../docs/architecture-public-modules.json');
  const relative=f=>path.relative(root,f).replaceAll('\\','/');
  const feature=f=>(relative(f).match(/^features\/([^/]+)/)||[])[1];
  for(const [file,imports] of edges) for(const i of imports) {
    if(i.target && feature(file) && feature(i.target) && feature(file)!==feature(i.target)) {
      assert.ok(publicModules[relative(i.target)],`${relative(file)} imports undocumented internals ${relative(i.target)}`);
    }
  }
});
for(const [file,names] of Object.entries(expectedRoutes)) test(`navigation contract preserved: ${file}`,()=>{
  assert.deepEqual([...source(path.join(root,file)).matchAll(/name="([A-Za-z][A-Za-z0-9]+)"/g)].map(m=>m[1]),names);
});
test('ReportFlow has one provider surrounding all six screens',()=>{
  const s=source(path.join(root,'features/report/navigation/ReportFlowNavigator.tsx'));
  assert.equal((s.match(/<FieldReportProvider>/g)||[]).length,1);
  assert.ok(s.indexOf('<FieldReportProvider>') < s.indexOf('<Stack.Navigator'));
  assert.ok(s.indexOf('</FieldReportProvider>') > s.indexOf('</Stack.Navigator>'));
});
test('Admin preserves its mode-specific map; detail remains shared across three roles',()=>{
  const admin=source(path.join(root,'app/navigation/AdminTabNavigator.tsx'));
  assert.match(admin, /<OfficerMapScreen\b[^>]*\bmode="admin"/);
  for(const role of ['Admin','Citizen','Officer']) assert.match(source(path.join(root,`app/navigation/${role}TabNavigator.tsx`)), /features\/incidents\/screens\/AlertDetailScreen/);
});
test('notification cold-start, role selection and duplicate suppression survive module migration',()=>{
  const exports={};
  vm.runInNewContext(ts.transpileModule(source(path.join(root,'features/notifications/model/notificationNavigation.ts')), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});
  const id='0123456789abcdef01234567';
  for(const app of ['CitizenApp','OfficerApp','AdminApp']) {
    const q=new exports.NotificationTapQueue(), calls=[];
    q.enqueue({alertId:id},'request');
    assert.equal(q.flush(false,[app],x=>calls.push(x)),false);
    assert.equal(q.flush(true,['Login'],x=>calls.push(x)),false);
    assert.equal(q.flush(true,[app],x=>calls.push(x)),true);
    assert.equal(calls[0].app,app); assert.equal(calls[0].alertId,id);
    q.enqueue({alertId:id},'request');
    assert.equal(q.flush(true,[app],x=>calls.push(x)),false);
    assert.equal(calls.length,1);
  }
  assert.equal(exports.getNotificationAlertId({eventId:id}),null);
  assert.equal(exports.getNotificationAlertId({alertId:'invalid'}),null);
});
