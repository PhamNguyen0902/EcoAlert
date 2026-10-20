const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/citizen/report', name + '.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('exports', 'require', js)(exports, id => load(id.replace('./', '')));
  cache.set(name, exports); return exports;
}
const { analyzePhoto, photoAnalysisIdentity } = load('photoAnalysis');
const { createEmptyFieldReportDraft } = load('types');
const { addPhoto, selectPrimaryPhoto } = load('photoDraft');
const photo = id => ({ id, originalLocalUri: `file:///${id}.jpg`, capturedAt: '2026-10-17T00:00:00.000Z' });
const semantic = extra => ({ category: 'illegal_dumping', categoryConfidence: .8, incidentConfidence: .9,
  isIncident: true, classificationStatus: 'AI_SUGGESTED', confidenceTier: 'REVIEW_REQUIRED', analysisMode: 'IMAGE_AND_TEXT',
  severity: 'medium', summary: 'Rác cần xử lý.', massEstimate: { available: false, reasoningSummary: 'Thiếu tỷ lệ.' }, ...extra });
function api() {
  const calls = { upload: [], vision: [], semantic: [] };
  return { calls,
    uploadFieldMedia: async uri => { calls.upload.push(uri); return { url: `https://example.invalid/${uri.split('/').pop()}`, ownershipProof: 'proof' }; },
    analyzeUploadedImage: async url => { calls.vision.push(url); return { status: 'ok', requiresManualReview: false,
      detections: [{ materialClass: url.split('/').pop(), confidence: .8, bbox: [0, 0, 10, 20], model_id: 'model-a' }] }; },
    validateImageSemantics: async url => { calls.semantic.push(url); return semantic({ summary: url.split('/').pop() }); },
  };
}
const run = (p, a, options) => analyzePhoto(p, 'report', {}, a, () => {}, options);

test('three photos keep their own detections and semantic results; one failed upload does not discard siblings', async () => {
  const a = api(); const upload = a.uploadFieldMedia;
  a.uploadFieldMedia = async uri => { if (uri.endsWith('B.jpg')) throw Error('offline'); return upload(uri); };
  const values = await Promise.all(['A', 'B', 'C'].map(id => run(photo(id), a)));
  assert.equal(values[0].analysis.summary, 'A.jpg');
  assert.equal(values[1].uploadState, 'FAILED');
  assert.equal(values[2].analysis.detectedObjects[0].label, 'C.jpg');
  assert.equal(a.calls.vision.length, 2);
  let draft = createEmptyFieldReportDraft(); values.forEach(p => { draft = addPhoto(draft, p); });
  draft = selectPrimaryPhoto(draft, 'A');
  assert.equal(draft.imageValidation.summary, 'A.jpg');
  draft = selectPrimaryPhoto(draft, 'C');
  assert.equal(draft.imageValidation.summary, 'C.jpg');
});

test('semantic 402 preserves upload, YOLO and model metadata; retry only calls semantic', async () => {
  const a = api(); let attempts = 0; const original = a.validateImageSemantics;
  a.validateImageSemantics = async url => { if (!attempts++) throw { response: { status: 503, data: { providerStatus: 402 } } }; return original(url); };
  const failed = await run(photo('A'), a);
  assert.equal(failed.uploadState, 'UPLOADED');
  assert.equal(failed.visionState, 'OK');
  assert.equal(failed.semanticStage, 'FAILED');
  assert.match(failed.analysis.semanticError, /402/);
  assert.equal(failed.analysis.detectedObjects[0].model_id, 'model-a');
  const retried = await run(failed, a);
  assert.equal(retried.analysis.semanticState, 'COMPLETE');
  assert.equal(a.calls.upload.length, 1); assert.equal(a.calls.vision.length, 1);
  const cached = await run(retried, a);
  assert.equal(a.calls.semantic.length, 1);
  assert.equal(cached.analysis.summary, 'A.jpg');
});

test('Vision failure preserves successful upload and still attempts independent semantic analysis', async () => {
  const a = api(); const vision = a.analyzeUploadedImage; let attempts = 0;
  a.analyzeUploadedImage = async url => { if (!attempts++) throw Error('unreachable'); return vision(url); };
  const failed = await run(photo('A'), a);
  assert.equal(failed.uploadState, 'UPLOADED');
  assert.equal(failed.visionState, 'FAILED');
  assert.equal(failed.semanticStage, 'COMPLETE');
  const retried = await run(failed, a);
  assert.equal(retried.visionState, 'OK');
  assert.equal(a.calls.upload.length, 1); assert.equal(a.calls.semantic.length, 1);
});

test('no_detection is not a network error and must not skip semantic; TEXT_ONLY/UNCLASSIFIED stay honest', async () => {
  for (const extra of [{ analysisMode: 'TEXT_ONLY' }, { category: 'UNCLASSIFIED', classificationStatus: 'UNCLASSIFIED', confidenceTier: 'UNCLASSIFIED' }]) {
    const a = api(); a.analyzeUploadedImage = async () => ({ status: 'no_detection', detections: [], requiresManualReview: true });
    a.validateImageSemantics = async () => semantic(extra);
    const p = await run(photo('A'), a);
    assert.equal(p.visionState, 'NO_DETECTION'); assert.equal(p.semanticStage, 'COMPLETE');
    assert.equal(p.analysis.suggestedCategory, null); assert.equal(p.analysis.detectedObjects.length, 0);
  }
});

test('changed original identity invalidates upload and both analysis caches; interrupted PROCESSING recovers', async () => {
  const a = api(); const complete = await run(photo('A'), a);
  const changed = { ...complete, originalLocalUri: 'file:///new.jpg' };
  const p = await run(changed, a);
  assert.equal(p.analysis.summary, 'new.jpg'); assert.equal(a.calls.upload.length, 2);
  assert.equal(p.analysisIdentity, photoAnalysisIdentity(p));
  const interrupted = { ...photo('B'), uploadState: 'UPLOADING', visionState: 'PROCESSING', semanticStage: 'PROCESSING' };
  assert.equal((await run(interrupted, a)).semanticStage, 'COMPLETE');
});

test('explicit semantic retry refreshes UNCLASSIFIED without re-uploading or rerunning YOLO', async () => {
  const a = api(); a.validateImageSemantics = async () => semantic({ category: 'UNCLASSIFIED', classificationStatus: 'UNCLASSIFIED', confidenceTier: 'UNCLASSIFIED' });
  const unclassified = await run(photo('A'), a);
  a.validateImageSemantics = async () => semantic();
  const p = await run(unclassified, a, { retrySemantic: true });
  assert.equal(p.analysis.suggestedCategory, 'illegal_dumping');
  assert.equal(a.calls.upload.length, 1); assert.equal(a.calls.vision.length, 1);
});
