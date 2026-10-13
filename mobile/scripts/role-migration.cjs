// One-time role folder migration. The ledger records the pre-migration graph.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const unix = p => p.replace(/\\/g, '/');
const absolute = p => path.join(root, p);
const exists = p => fs.existsSync(absolute(p));
const read = p => fs.readFileSync(absolute(p), 'utf8');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const walk = dir => fs.readdirSync(absolute(dir), {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
const refs = (file, source) => {
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
  const found=[];
  function visit(n) {
    let node;
    if(ts.isImportDeclaration(n)||ts.isExportDeclaration(n)) node=n.moduleSpecifier;
    if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||n.expression.getText(ast)==='require')) node=n.arguments[0];
    if(node&&ts.isStringLiteral(node)) found.push({spec:node.text,start:node.getStart(ast)+1,end:node.end-1});
    ts.forEachChild(n,visit);
  }
  visit(ast); return found;
};
const resolve = (file,spec) => {
  if(!spec.startsWith('.')) return null;
  const base=unix(path.posix.normalize(path.posix.join(path.posix.dirname(file),spec)));
  return [base,base+'.ts',base+'.tsx',base+'.js',base+'.json',base+'.png',base+'.jpg',base+'/index.ts',base+'/index.tsx'].find(p=>exists(p)&&fs.statSync(absolute(p)).isFile())||null;
};
function plan(old) {
  const base=path.posix.basename(old);
  const exact={
    'src/screens/LocationPickerScreen.tsx':'citizen/report/legacy/LocationPickerScreen.tsx',
    'src/screens/ReportIncidentScreen.tsx':'citizen/report/legacy/ReportIncidentScreen.compat.tsx',
    'src/screens/index.ts':'app/legacyScreenExports.ts',
    'src/screens/citizen/AlertDetailScreen.tsx':'shared/screens/AlertDetailScreen.tsx',
    'src/screens/citizen/ReportIncidentScreen.tsx':'citizen/report/legacy/ReportIncidentScreen.tsx',
    'src/screens/citizen/FieldCaptureReportScreen.tsx':'citizen/report/legacy/FieldCaptureReportScreen.tsx',
    'src/components/admin/OfficerPickerModal.tsx':'shared/components/OfficerPickerModal.tsx',
    'src/api/authService.ts':'auth/api/authService.ts',
    'src/api/officerRouting.ts':'officer/api/officerRouting.ts',
    'src/hooks/useAuth.ts':'auth/hooks/useAuth.ts',
    'src/hooks/useUsers.ts':'auth/hooks/useUsers.ts',
    'src/hooks/useDashboardLocation.ts':'citizen/hooks/useDashboardLocation.ts',
    'src/hooks/useOfflineSync.ts':'citizen/report/hooks/useOfflineSync.ts',
    'src/hooks/useOfficerPosition.ts':'officer/hooks/useOfficerPosition.ts',
    'src/hooks/useOfficerMapFollow.ts':'officer/hooks/useOfficerMapFollow.ts',
    'src/hooks/useServiceAreas.ts':'officer/hooks/useServiceAreas.ts',
    'src/utils/officerMapCamera.ts':'officer/utils/officerMapCamera.ts',
    'src/utils/officerWorkflow.ts':'officer/utils/officerWorkflow.ts',
    'src/utils/officerResolution.ts':'officer/utils/officerResolution.ts',
    'src/utils/officerPresentation.ts':'officer/utils/officerPresentation.ts',
    'src/utils/citizenIncidents.ts':'citizen/utils/citizenIncidents.ts',
    'src/utils/citizenPresentation.ts':'citizen/utils/citizenPresentation.ts',
    'src/utils/offlineQueue.ts':'citizen/report/offlineQueue.ts',
    'src/context/SocketContext.tsx':'app/providers/SocketContext.tsx',
  };
  if(exact[old]) return `src/${exact[old]}`;
  const prefix=(from,to)=>old.startsWith(from)?old.replace(from,to):null;
  return prefix('src/navigation/','src/app/navigation/')||
    prefix('src/screens/auth/','src/auth/screens/')||
    prefix('src/screens/citizen/','src/citizen/screens/')||
    prefix('src/screens/officer/','src/officer/screens/')||
    prefix('src/components/citizen/','src/citizen/components/')||
    prefix('src/components/officer/','src/officer/components/')||
    prefix('src/components/','src/shared/components/')||
    prefix('src/features/report/','src/citizen/report/')||
    prefix('src/api/','src/shared/api/')||
    prefix('src/hooks/','src/shared/hooks/')||
    prefix('src/utils/','src/shared/utils/')||
    prefix('src/context/','src/shared/context/')||
    prefix('src/theme/','src/shared/theme/')||
    prefix('src/i18n/','src/shared/i18n/')||
    prefix('src/types/','src/shared/types/')||
    prefix('src/services/','src/shared/services/')||old;
}
const snapshot='docs/role-migration.json';
const phase=process.argv[2];
const trackedFiles=()=>new Set(cp.execFileSync('git',['ls-files','-z','--','src'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean));
if(phase==='inventory') {
  if(exists(snapshot)) throw Error('Refusing to overwrite migration inventory');
  const tracked=trackedFiles(), files=walk('src').filter(p=>/\.tsx?$/.test(p));
  const data=files.map(old=>({old,to:plan(old),tracked:tracked.has(old),hash:sha(read(old)),refs:refs(old,read(old)).map(r=>({spec:r.spec,target:resolve(old,r.spec)})),consumers:[]}));
  for(const f of data) for(const r of f.refs) {const dep=data.find(d=>d.old===r.target); if(dep) dep.consumers.push(f.old);}
  const status=cp.execFileSync('git',['status','--porcelain','-uall'],{cwd:root,encoding:'utf8'}).split('\n').filter(Boolean);
  fs.writeFileSync(absolute(snapshot),JSON.stringify({head:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),status,files:data},null,2)+'\n');
  fs.writeFileSync(absolute('docs/ROLE_MIGRATION.md'),'# Role folder migration ledger\n\n| Old path | New path | Owner | Consumers | Risk |\n|---|---|---|---|---|\n'+data.map(f=>`| ${f.old} | ${f.to} | ${f.to.split('/')[1]} | ${f.consumers.join(', ')} | ${f.tracked?'tracked':'untracked local work'} |`).join('\n')+'\n');
  console.log(`Inventoried ${data.length} TS/TSX files. Admin screen/navigation removal needs separate verified step.`);
} else if(phase==='repair-ledger') {
  const inventory=JSON.parse(read(snapshot));
  const tracked=trackedFiles();
  for(const file of inventory.files) file.tracked=tracked.has(file.old);
  fs.writeFileSync(absolute(snapshot),JSON.stringify(inventory,null,2)+'\n');
  const removed=new Set(['src/navigation/AdminTabNavigator.tsx','src/screens/admin/AdminIncidentsScreen.tsx','src/screens/index.ts']);
  const originalDirty=new Set(inventory.status.filter(line=>line.startsWith(' M mobile/src/')).map(line=>line.slice(3).replace(/^mobile\//,'')));
  fs.writeFileSync(absolute('docs/ROLE_MIGRATION.md'),'# Role folder migration ledger\n\n| Old path | New path | Owner | Consumers | Baseline |\n|---|---|---|---|---|\n'+inventory.files.map(f=>`| ${f.old} | ${removed.has(f.old)?'removed (unused Admin mobile/barrel)':f.to} | ${removed.has(f.old)?'none':f.to.split('/')[1]} | ${f.consumers.join(', ')} | ${originalDirty.has(f.old)?'tracked, locally modified before migration':f.tracked?'tracked':'untracked local work'} |`).join('\n')+'\n');
  console.log('Repaired tracked status and removal entries in migration ledger.');
} else if(['shared','auth','citizen','officer','app'].includes(phase)) {
  const inventory=JSON.parse(read(snapshot));
  const moving=inventory.files.filter(f=>f.to.split('/')[1]===phase&&f.old!==f.to&&exists(f.old)&&f.old!=='src/navigation/AdminTabNavigator.tsx'&&f.old!=='src/screens/admin/AdminIncidentsScreen.tsx');
  const map=new Map(moving.map(f=>[f.old,f.to]));
  const existing=[...walk('src').filter(p=>/\.tsx?$/.test(p)),'App.tsx'];
  const work=[];
  for(const file of existing) {
    const target=map.get(file)||file, source=read(file);
    const currentRefs=refs(file,source);
    const transformed=currentRefs.reduceRight((text,r)=>{
      if(!r.spec.startsWith('.')) return text;
      const originalTarget=resolve(file,r.spec);
      const depEntry=inventory.files.find(f=>f.old===originalTarget||f.to===originalTarget);
      const next=depEntry ? (map.has(depEntry.old)||exists(depEntry.to)&&!exists(depEntry.old) ? depEntry.to : depEntry.old) : originalTarget;
      if(!next) return text;
      if(next===originalTarget&&target===file) return text;
      let spec=unix(path.relative(path.dirname(target),next)).replace(/\.(tsx?|jsx?)$/,'');
      if(!spec.startsWith('.')) spec='./'+spec;
      if(originalTarget?.endsWith('/index.ts')||originalTarget?.endsWith('/index.tsx')) spec=spec.replace(/\/index$/,'');
      return text.slice(0,r.start)+spec+text.slice(r.end);
    },source);
    work.push({file,target,source,transformed});
  }
  const tracked=trackedFiles();
  for(const item of work) {
    if(item.target!==item.file) {
      if(exists(item.target)) throw Error(`Target already exists: ${item.target}`);
      fs.mkdirSync(path.dirname(absolute(item.target)),{recursive:true});
      if(tracked.has(item.file)) cp.execFileSync('git',['mv','--',item.file,item.target],{cwd:root});
      else fs.renameSync(absolute(item.file),absolute(item.target));
    }
    if(item.transformed!==item.source) fs.writeFileSync(absolute(item.target),item.transformed);
  }
  console.log(`${phase}: ${moving.length} moved, ${work.filter(f=>f.source!==f.transformed).length} import users updated.`);
} else if(phase==='stage') {
  const inventory=JSON.parse(read(snapshot));
  const officerOld='src/screens/officer/OfficerOperationalMap.tsx';
  const officerNew='src/officer/screens/OfficerOperationalMap.tsx';
  const removed=new Set(['src/navigation/AdminTabNavigator.tsx','src/screens/admin/AdminIncidentsScreen.tsx','src/screens/index.ts']);
  const trackedDestinations=inventory.files.filter(f=>f.tracked&&!removed.has(f.old)&&f.old!==officerOld).map(f=>f.to);
  cp.execFileSync('git',['add','-u','--','src'],{cwd:root});
  cp.execFileSync('git',['add','--',...trackedDestinations,
    'App.tsx','tests/report-semantic-flow.test.cjs','tests/mobile-role-routing.test.cjs',
    'docs/ARCHITECTURE.md','docs/ROLE_MIGRATION.md','docs/role-migration.json',
    'scripts/role-migration.cjs','src/auth/AdminMobileNoticeScreen.tsx',
    'src/shared/hooks/useReducedMotion.ts'],{cwd:root});
  const clean=cp.execFileSync('git',['show',`HEAD:mobile/${officerOld}`],{cwd:root,encoding:'utf8'});
  const migrated=refs(officerOld,clean).reduceRight((source,r)=>{
    if(!r.spec.startsWith('.')) return source;
    const oldBase=unix(path.posix.normalize(path.posix.join(path.posix.dirname(officerOld),r.spec)));
    const dep=inventory.files.find(f=>[oldBase,oldBase+'.ts',oldBase+'.tsx',oldBase+'/index.ts',oldBase+'/index.tsx'].includes(f.old));
    if(!dep) throw Error(`Cannot migrate clean Officer import: ${r.spec}`);
    let spec=unix(path.posix.relative(path.posix.dirname(officerNew),dep.to)).replace(/\.(tsx?|jsx?)$/,'');
    if(!spec.startsWith('.')) spec='./'+spec;
    if(dep.old.endsWith('/index.ts')||dep.old.endsWith('/index.tsx')) spec=spec.replace(/\/index$/,'');
    return source.slice(0,r.start)+spec+source.slice(r.end);
  },clean);
  for(const r of refs(officerNew,migrated)) if(r.spec.startsWith('.')&&!resolve(officerNew,r.spec)) throw Error(`Clean Officer source unresolved: ${r.spec}`);
  const blob=cp.execFileSync('git',['hash-object','-w','--stdin'],{cwd:root,encoding:'utf8',input:migrated}).trim();
  cp.execFileSync('git',['update-index','--add','--cacheinfo',`100644,${blob},mobile/${officerNew}`],{cwd:root});
  console.log(`Staged migration and clean Officer map blob ${blob}; dirty Officer worktree remains untouched.`);
} else if(phase==='verify') {
  const inventory=JSON.parse(read(snapshot)); let checked=0;
  for(const f of inventory.files) {
    if(['src/navigation/AdminTabNavigator.tsx','src/screens/admin/AdminIncidentsScreen.tsx','src/screens/index.ts'].includes(f.old)) continue;
    if(!exists(f.to)) throw Error(`Missing ${f.to}`);
    for(const r of refs(f.to,read(f.to))) if(r.spec.startsWith('.')&&!resolve(f.to,r.spec)) throw Error(`Unresolved ${f.to}: ${r.spec}`);
    checked++;
  }
  const top=fs.readdirSync(absolute('src'),{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort();
  if(JSON.stringify(top)!==JSON.stringify(['app','auth','citizen','officer','shared'])) throw Error(`Unexpected src dirs ${top}`);
  const all=walk('src').filter(p=>/\.tsx?$/.test(p));
  const graph=new Map(all.map(p=>[p,refs(p,read(p)).filter(r=>r.spec.startsWith('.')).map(r=>resolve(p,r.spec)).filter(Boolean)]));
  const active=new Set(), done=new Set();
  function visit(file,trail=[]) {
    if(active.has(file)) throw Error(`Circular dependency: ${[...trail,file].join(' -> ')}`);
    if(done.has(file)) return;
    active.add(file);
    for(const dep of graph.get(file)||[]) if(graph.has(dep)) visit(dep,[...trail,file]);
    active.delete(file); done.add(file);
  }
  for(const file of all) visit(file);
  console.log(`${checked} migrated source files resolve; src contains exactly ${top.join(', ')}`);
} else throw Error('Usage: inventory|repair-ledger|shared|auth|citizen|officer|app|verify|stage');
