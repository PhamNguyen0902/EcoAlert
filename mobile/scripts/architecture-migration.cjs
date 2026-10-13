// One-time, auditable mechanical migration. Run inventory before any phase.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const slash = p => p.replace(/\\/g, '/');
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
function refs(file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const found = [];
  function visit(n) {
    let s;
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) s = n.moduleSpecifier;
    if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || n.expression.getText(ast) === 'require')) s = n.arguments[0];
    if (s && ts.isStringLiteral(s)) found.push({ spec: s.text, start: s.getStart(ast) + 1, end: s.end - 1, typeOnly: !!(n.isTypeOnly || n.importClause?.isTypeOnly) });
    ts.forEachChild(n, visit);
  }
  visit(ast);
  return { refs: found, exports: ast.statements.filter(n => n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || ts.isExportDeclaration(n)).map(n => n.name?.text || (ts.isVariableStatement(n) ? n.declarationList.declarations.map(d => d.name.getText(ast)).join(', ') : n.getText(ast).split('\n')[0])), routes: [...source.matchAll(/name="([A-Za-z][A-Za-z0-9]+)"/g)].map(m => m[1]) };
}
function resolve(file, spec) {
  if (!spec.startsWith('.')) return null;
  const base = slash(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)));
  return [base, ...['.ts','.tsx','.js','.json','/index.ts','/index.tsx'].map(e => base + e)].find(f => fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).isFile()) || null;
}
function destination(f) {
  const b = path.posix.basename(f);
  const simple = {
    'src/api/client.ts': ['B','shared/api/client.ts'],
    'src/context/ThemeContext.tsx': ['B','theme/ThemeContext.tsx'],
    'src/context/LanguageContext.tsx': ['B','i18n/LanguageContext.tsx'],
    'src/context/SocketContext.tsx': ['F','app/providers/SocketContext.tsx'],
    'src/types/index.ts': ['B','shared/types/index.ts'],
    'src/types/notification.ts': ['B','shared/types/notification.ts'],
    'src/utils/constants.ts': ['B','shared/constants/index.ts'],
    'src/utils/storage.ts': ['B','shared/lib/storage.ts'],
    'src/utils/imageViewer.ts': ['B','shared/lib/imageViewer.ts'],
    'src/utils/evidenceImageFrame.ts': ['B','shared/lib/evidenceImageFrame.ts'],
    'src/utils/visionBoundingBox.ts': ['B','shared/lib/visionBoundingBox.ts'],
    'src/services/reverseGeocoder.ts': ['B','shared/location/reverseGeocoder.ts'],
    'src/hooks/useLocation.ts': ['B','shared/hooks/useLocation.ts'],
    'src/hooks/useFormValidation.ts': ['B','shared/hooks/useFormValidation.ts'],
    'src/hooks/useAuth.ts': ['C','features/auth/hooks/useAuth.ts'],
    'src/api/authService.ts': ['C','features/auth/api/authService.ts'],
    'src/hooks/useDashboardLocation.ts': ['C','features/citizen/nearby/useDashboardLocation.ts'],
    'src/utils/citizenIncidents.ts': ['C','features/citizen/model/citizenIncidents.ts'],
    'src/utils/citizenPresentation.ts': ['C','features/citizen/model/citizenPresentation.ts'],
    'src/features/report/FieldReportContext.tsx': ['D','features/report/model/FieldReportContext.tsx'],
    'src/features/report/types.ts': ['D','features/report/model/types.ts'],
    'src/features/report/utils.ts': ['D','features/report/model/utils.ts'],
    'src/features/report/semanticResult.ts': ['D','features/report/model/semanticResult.ts'],
    'src/features/report/useReportTheme.ts': ['D','features/report/hooks/useReportTheme.ts'],
    'src/features/report/ReportFlowNavigator.tsx': ['D','features/report/navigation/ReportFlowNavigator.tsx'],
    'src/features/report/ReportTabLauncherScreen.tsx': ['D','features/report/navigation/ReportTabLauncherScreen.tsx'],
    'src/utils/offlineQueue.ts': ['D','features/report/offline/offlineQueue.ts'],
    'src/hooks/useOfflineSync.ts': ['D','features/report/offline/useOfflineSync.ts'],
    'src/utils/watermark.ts': ['D','features/report/model/watermark.ts'],
    'src/utils/fieldCaptureImage.ts': ['D','features/report/model/fieldCaptureImage.ts'],
    'src/screens/LocationPickerScreen.tsx': ['D','features/report/legacy/LocationPickerScreen.tsx'],
    'src/screens/ReportIncidentScreen.tsx': ['D','features/report/legacy/ReportIncidentScreen.compat.tsx'],
    'src/screens/citizen/ReportIncidentScreen.tsx': ['D','features/report/legacy/ReportIncidentScreen.tsx'],
    'src/screens/citizen/FieldCaptureReportScreen.tsx': ['D','features/report/legacy/FieldCaptureReportScreen.tsx'],
    'src/screens/citizen/AlertDetailScreen.tsx': ['F','features/incidents/screens/AlertDetailScreen.tsx'],
    'src/utils/officerResolution.ts': ['E','features/officer/resolution/officerResolution.ts'],
    'src/api/alertService.ts': ['F','features/incidents/api/alertService.ts'],
    'src/api/gisService.ts': ['F','features/incidents/api/gisService.ts'],
    'src/api/serviceAreaService.ts': ['F','features/admin/incidents/api/serviceAreaService.ts'],
    'src/api/userService.ts': ['F','features/auth/api/userService.ts'],
    'src/hooks/useUsers.ts': ['F','features/auth/hooks/useUsers.ts'],
    'src/hooks/useServiceAreas.ts': ['F','features/admin/incidents/hooks/useServiceAreas.ts'],
    'src/hooks/useGis.ts': ['F','features/incidents/hooks/useGis.ts'],
    'src/utils/aiAnalysis.ts': ['F','features/incidents/model/aiAnalysis.ts'],
    'src/utils/incidentPresentation.ts': ['F','features/incidents/model/incidentPresentation.ts'],
    'src/api/notificationService.ts': ['F','features/notifications/api/notificationService.ts'],
    'src/hooks/useNotifications.ts': ['F','features/notifications/hooks/useNotifications.ts'],
    'src/utils/notificationPresentation.ts': ['F','features/notifications/model/notificationPresentation.ts'],
    'src/utils/notificationNavigation.ts': ['F','features/notifications/model/notificationNavigation.ts'],
    'src/services/pushNotificationService.ts': ['F','features/notifications/pushNotificationService.ts'],
    'src/screens/index.ts': ['F','app/legacyScreenExports.ts'],
  };
  if (simple[f]) return simple[f];
  if (/^src\/components\/(ui|media)\//.test(f)) return ['B',f.replace('src/components/','shared/components/')];
  if (f.startsWith('src/screens/auth/')) return ['C',`features/auth/screens/${b}`];
  const citizens = { CitizenDashboardScreen:'home', CitizenMapScreen:'nearby', MyReportsScreen:'my-reports', CitizenProfileScreen:'profile', CitizenSettingsScreen:'settings', CitizenNotificationsScreen:'notifications' };
  if (f.startsWith('src/screens/citizen/') && citizens[b.replace('.tsx','')]) return ['C',`features/citizen/${citizens[b.replace('.tsx','')]}/${b}`];
  if (f.startsWith('src/components/citizen/')) return ['C', f.replace('src/components/citizen/','features/citizen/components/')];
  const officer = { OfficerTasksScreen:'dashboard', OfficerTaskListScreen:'tasks', OfficerAlertDetailScreen:'tasks', OfficerGpsCheckInScreen:'check-in', OfficerMapScreen:'map', OfficerOperationalMap:'map', OfficerProfileScreen:'profile', OfficerNotificationsScreen:'notifications' };
  if (f.startsWith('src/screens/officer/')) return ['E',`features/officer/${officer[b.replace('.tsx','')] || 'resolution'}/${b}`];
  if (f.startsWith('src/components/officer/')) return ['E',`features/officer/${b.includes('Profile') ? 'profile' : b.includes('Evidence') ? 'resolution' : 'components'}/${b}`];
  if (f.startsWith('src/screens/admin/')) return ['F',`features/admin/incidents/${b}`];
  if (f.startsWith('src/components/admin/')) return ['F',`features/admin/incidents/components/${b}`];
  if (/^src\/components\/(ai|vision|modals)\//.test(f)) return ['F',f.replace('src/components/','features/incidents/components/')];
  if (f.startsWith('src/navigation/') && b !== 'types.ts') return ['F',`app/navigation/${b}`];
  return ['keep',f.replace(/^src\//,'')];
}
const snapshot = 'docs/architecture-inventory.json';
const mode = process.argv[2];
if (mode === 'inventory') {
  if (fs.existsSync(path.join(root,snapshot))) throw Error('Inventory already exists; do not replace baseline');
  const status = cp.execFileSync('git',['status','--porcelain','-uall'],{cwd:root,encoding:'utf8'}).trimEnd().split('\n');
  const protectedFiles = status.map(s => s.slice(3)).filter(f => f.startsWith('mobile/')).map(f => f.slice(7));
  const files = [...walk('src'),...walk('tests'),'App.tsx','index.ts'];
  const data = files.map(file => { const source = read(file); const parsed = refs(file,source); return { file, ...parsed, imports: parsed.refs.map(r => ({...r,target:resolve(file,r.spec)})), hash:hash(source), contentHash:hash(parsed.refs.reduceRight((s,r) => s.slice(0,r.start)+'<module>'+s.slice(r.end),source)), consumers:[] }; });
  const held = new Set(protectedFiles);
  for (const f of data.filter(f => protectedFiles.includes(f.file))) for (const r of f.imports) if (r.target) held.add(r.target);
  for (const f of data) {
    for (const r of f.imports) { const target = data.find(d => d.file === r.target); if (target) target.consumers.push(f.file); }
    const [phase,to] = destination(f.file);
    f.phase = held.has(f.file) || !f.file.startsWith('src/') ? 'keep' : phase;
    f.to = f.phase === 'keep' ? f.file : `src/${to}`;
    f.owner = (f.to.match(/src\/features\/([^/]+)/)||[])[1] || f.to.split('/')[1];
    f.risk = held.has(f.file) ? 'held: dirty file or its direct dependency' : f.consumers.length > 5 ? 'high fan-in; typecheck/tests required' : 'mechanical move';
  }
  fs.writeFileSync(path.join(root,snapshot),JSON.stringify({ baseline:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),status,protectedFiles,files:data },null,2)+'\n');
  fs.writeFileSync(path.join(root,'docs/architecture-migration.md'),'# Migration ledger\n\nBaseline source and test inventory; consumers are recorded at the original paths. No legacy implementation is deleted.\n\n| Phase | Old path | New path | Owner | Consumers | Risk |\n|---|---|---|---|---|---|\n'+data.map(f=>`| ${f.phase} | ${f.file} | ${f.to} | ${f.owner} | ${f.consumers.join(', ')} | ${f.risk} |`).join('\n')+'\n');
  console.log(`Inventoried ${data.length} files, protected ${protectedFiles.length}, planned ${data.filter(f=>f.file!==f.to).length} moves`);
} else if (/^[BCDEF]$/.test(mode)) {
  const inventory = JSON.parse(read(snapshot));
  const moves = inventory.files.filter(f=>f.phase===mode && f.file!==f.to);
  const map = new Map(moves.map(f=>[f.file,f.to]));
  const sources = [...walk('src'),'App.tsx','index.ts'];
  const replacements = new Map();
  const pending = [];
  for (const file of sources) {
    const source = read(file), target = map.get(file)||file;
    const updated = refs(file,source).refs.reduceRight((s,r)=>{
      const dep = resolve(file,r.spec); if (!dep) return s;
      const dest = map.get(dep)||dep;
      if (file===target && dest===dep) return s;
      let relative = slash(path.relative(path.dirname(target),dest)).replace(/\.(tsx?|jsx?)$/,'');
      if (!relative.startsWith('.')) relative='./'+relative;
      if (!replacements.has(r.spec)) replacements.set(r.spec,new Set()); replacements.get(r.spec).add(relative);
      return s.slice(0,r.start)+relative+s.slice(r.end);
    },source);
    if (source!==updated && inventory.protectedFiles.includes(file)) throw Error(`Protected consumer ${file}`);
    pending.push({file,target,source,updated});
  }
  for (const {file,target,source,updated} of pending) {
    if (file!==target) { fs.mkdirSync(path.dirname(path.join(root,target)),{recursive:true}); cp.execFileSync('git',['mv',file,target],{cwd:root}); }
    if (source!==updated) fs.writeFileSync(path.join(root,target),updated);
  }
  // Mock identifiers are relative to the tested module, never globally replace them.
  cp.execFileSync(process.execPath,[__filename,'tests'],{cwd:root,stdio:'inherit'});
  console.log(`Phase ${mode}: moved ${moves.length}; ambiguous test mocks:`,[...replacements].filter(([,v])=>v.size>1).map(([k,v])=>[k,[...v]]));
} else if (mode === 'tests') {
  const inventory=JSON.parse(read(snapshot));
  const current=f=>fs.existsSync(path.join(root,f.to))?f.to:f.file;
  const baseline=cp.execFileSync('git',['show',`${inventory.baseline}:mobile/tests/report-semantic-flow.test.cjs`],{cwd:root,encoding:'utf8'});
  const cardStart=baseline.indexOf("test('shared Step 3/");
  const harnessStart=baseline.indexOf('function harness(');
  const blocks=[baseline.slice(0,cardStart),baseline.slice(cardStart,harnessStart),baseline.slice(harnessStart)];
  const contexts=['src/api/alertService.ts','src/features/report/components/stitch/FieldAiResultCard.tsx','src/features/report/screens/ReportConfirmScreen.tsx'];
  const output=blocks.map((block,i)=>block.replace(/'([^'\r\n]+)'/g,(whole,spec)=>{
    const direct=inventory.files.find(f=>f.file==='src/'+spec);
    if(direct) return `'${current(direct).replace(/^src\//,'')}'`;
    if(!spec.startsWith('.')) return whole;
    const base=path.posix.normalize(path.posix.join(path.posix.dirname(contexts[i]),spec));
    const target=inventory.files.find(f=>[base,base+'.ts',base+'.tsx',base+'/index.ts'].includes(f.file));
    if(!target) return whole;
    const origin=current(inventory.files.find(f=>f.file===contexts[i]));
    let relative=slash(path.relative(path.dirname(origin),current(target))).replace(/\.tsx?$/,'');
    if(!relative.startsWith('.')) relative='./'+relative;
    return `'${relative}'`;
  })).join('');
  fs.writeFileSync(path.join(root,'tests/report-semantic-flow.test.cjs'),output);
  console.log('Updated existing test source paths and contextual mock identifiers; assertions unchanged.');
} else if (mode === 'commit') {
  const inventory=JSON.parse(read(snapshot));
  const eligible=inventory.files.filter(f=>!inventory.protectedFiles.includes(f.file)).flatMap(f=>[f.file,f.to]).filter(f=>fs.existsSync(path.join(root,f)));
  eligible.push('scripts/architecture-migration.cjs', snapshot, 'docs/architecture-migration.md', 'docs/architecture-baseline-audit.json');
  cp.execFileSync('git',['add','--',...new Set(eligible)],{cwd:root});
  const staged=cp.execFileSync('git',['diff','--cached','--name-only','--no-renames'],{cwd:root,encoding:'utf8'}).trim().split('\n');
  for(const f of inventory.protectedFiles) if(f!=='scripts/architecture-migration.cjs' && staged.includes('mobile/'+f)) throw Error(`Protected file staged: ${f}`);
  console.log(cp.execFileSync('git',['commit','-m',process.argv[3]],{cwd:root,encoding:'utf8'}));
} else if (mode === 'audit') {
  const inventory=JSON.parse(read(snapshot));
  const nodes=inventory.files.filter(f=>/\.(tsx?|cjs)$/.test(f.file));
  const edges=new Map(nodes.map(f=>[f.file,f.imports.filter(r=>r.target).map(r=>r.target)]));
  const cycles=new Set();
  function visit(f,stack,done) {
    const i=stack.indexOf(f); if(i>=0) { cycles.add(stack.slice(i).sort().join(' -> ')); return; }
    if(done.has(f)) return;
    for(const dep of edges.get(f)||[]) visit(dep,[...stack,f],done);
    done.add(f);
  }
  const done=new Set(); for(const f of edges.keys()) visit(f,[],done);
  const duplicates=Object.values(Object.groupBy(nodes,f=>path.basename(f.file))).filter(v=>v.length>1).map(v=>v.map(f=>f.file));
  const report={ cycles:[...cycles], duplicateNames:duplicates, barrels:nodes.filter(f=>f.file.endsWith('/index.ts')).map(f=>({file:f.file,exports:f.exports,consumers:f.consumers})), navigation:nodes.filter(f=>f.routes.length).map(f=>({file:f.file,routes:f.routes})), testPathLiterals:nodes.filter(f=>f.file.startsWith('tests/')).map(f=>({file:f.file,paths:[...read(f.file).matchAll(/['"]([^'"\n]*(?:screens|hooks|utils|features|api|navigation)\/[^'"\n]+)['"]/g)].map(m=>m[1])})) };
  fs.writeFileSync(path.join(root,'docs/architecture-baseline-audit.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} else if (mode === 'boundaries') {
  const edges=[];
  for(const file of walk('src')) for(const r of refs(file,read(file)).refs) {
    const target=resolve(file,r.spec);
    const feature=p=>(p?.match(/^src\/features\/([^/]+)/)||[])[1];
    if(feature(file)&&feature(target)&&feature(file)!==feature(target)) edges.push({from:file,to:target});
  }
  console.log(JSON.stringify(Object.groupBy(edges,e=>e.to),null,2));
} else if (mode === 'verify') {
  const inventory=JSON.parse(read(snapshot)); let checked=0;
  for(const f of inventory.files) {
    if(!f.file.startsWith('src/') && f.file!=='App.tsx' && f.file!=='index.ts') continue;
    const location=fs.existsSync(path.join(root,f.to))?f.to:f.file;
    const source=read(location), parsed=refs(location,source);
    if(hash(parsed.refs.reduceRight((s,r)=>s.slice(0,r.start)+'<module>'+s.slice(r.end),source))!==f.contentHash) throw Error(`Non-import change: ${location}`);
    for(const r of parsed.refs) if(r.spec.startsWith('.')&&!resolve(location,r.spec)) throw Error(`Unresolved ${location}: ${r.spec}`);
    for(let i=0;i<f.imports.length;i++) {
      const old=f.imports[i]; if(!old.target) continue;
      const entry=inventory.files.find(x=>x.file===old.target);
      const expected=entry&&fs.existsSync(path.join(root,entry.to))?entry.to:old.target;
      const actual=resolve(location,parsed.refs[i].spec);
      // The only deliberate graph change: Root now consumes Auth's two-screen public entry.
      if(f.file==='src/navigation/RootNavigator.tsx'&&old.target==='src/screens/index.ts'&&actual==='src/features/auth/index.ts') continue;
      if(actual!==expected) throw Error(`Dependency changed: ${location} -> ${actual}, expected ${expected}`);
    }
    if(inventory.protectedFiles.includes(f.file)&&hash(source)!==f.hash) throw Error(`Protected file changed: ${f.file}`);
    checked++;
  }
  console.log(`${checked} files retain exact non-import source and dependency targets (except the explicit Auth entry); relative imports resolve; protected source unchanged.`);
} else { throw Error('Usage: inventory | B | C | D | E | F | verify'); }
