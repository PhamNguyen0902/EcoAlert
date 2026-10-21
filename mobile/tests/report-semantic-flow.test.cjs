// Component/contract tests with mocked native transports, not device UI automation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText, { exports, Error, Date, Number, console, setTimeout, clearTimeout, require(id) { assert.ok(id in imports, id); return imports[id]; } });
  return exports;
}
const utils = load('citizen/report/semanticResult.ts');
const photoTypes = load('citizen/report/types.ts');
const photoDraft = load('citizen/report/photoDraft.ts', { './types': photoTypes });
const photoAnalysis = load('citizen/report/photoAnalysis.ts', { './semanticResult': utils });
const fieldPresentation = load('citizen/report/components/stitch/fieldPresentation.ts', { '../../types': photoTypes });
const reviewPolicy = load('citizen/report/reviewPolicy.ts', {
  './photoDraft': photoDraft, './photoAnalysis': photoAnalysis,
  './components/stitch/fieldPresentation': fieldPresentation, './semanticResult': utils,
});
const result = (extra = {}) => ({
  category: 'illegal_dumping', categoryConfidence: 0.75, incidentConfidence: 0.9, isIncident: true,
  classificationStatus: 'AI_SUGGESTED', confidenceTier: 'REVIEW_REQUIRED', analysisMode: 'IMAGE_AND_TEXT',
  severity: 'high', overallSummary: 'Rác thải tập trung cần được thu gom.', shortReason: 'Có rác trong ảnh.', model: 'test',
  massEstimate: { available: true, minKg: 2, maxKg: 5, mostLikelyKg: 3, confidence: 0.7, scale: 'SMALL', reasoningSummary: 'Có vật tham chiếu.', limitations: [] },
  ...extra,
});
test('valid semantic category uses backend classification status and carries mass/provenance', () => {
  const mapped = utils.mapSemanticResult(result());
  assert.equal(mapped.suggestedCategory, 'illegal_dumping');
  assert.equal(mapped.semanticState, 'COMPLETE');
  assert.equal(mapped.categoryConfidence, 0.75);
  assert.equal(mapped.massEstimate.minKg, 2);
  assert.equal(utils.massPresentation(mapped).value, '2 – 5 kg');
  assert.match(utils.massPresentation(mapped).note, /không phải khối lượng đo thực tế/);
});
test('UNCLASSIFIED and low confidence never become a detector-derived incident category', () => {
  for (const reason of ['UNKNOWN_CATEGORY', 'LOW_CONFIDENCE']) {
    const mapped = utils.mapSemanticResult(result({ category: 'UNCLASSIFIED', categoryConfidence: 0.2, classificationStatus: 'UNCLASSIFIED', confidenceTier: 'UNCLASSIFIED', classificationReason: reason }));
    assert.equal(mapped.suggestedCategory, null);
    assert.equal(mapped.semanticState, 'UNCLASSIFIED');
  }
});
test('unavailable mass preserves reason; invalid ranges/nonfinite/invalid probability stay unavailable', () => {
  const r = result();
  assert.match(utils.massPresentation(utils.mapSemanticResult(result({ massEstimate: { ...r.massEstimate, available: false, reasoningSummary: 'Thiếu vật tham chiếu.' } }))).note, /Thiếu vật tham chiếu/);
  for (const override of [{ minKg: -1 }, { minKg: 6 }, { maxKg: Infinity }, { mostLikelyKg: 9 }, { confidence: 2 }]) {
    assert.equal(utils.massPresentation(utils.mapSemanticResult(result({ massEstimate: { ...r.massEstimate, ...override } }))).value, 'Chưa có ước tính');
  }
});
test('TEXT_ONLY cannot masquerade as image classification or image mass', () => {
  const m = utils.mapSemanticResult(result({ analysisMode: 'TEXT_ONLY' }));
  assert.equal(m.suggestedCategory, null);
  assert.equal(m.summary, null);
  assert.equal(m.semanticState, 'TEXT_ONLY');
  assert.equal(utils.massPresentation(m).value, 'Chưa có ước tính');
});
test('bad response schema and unmapped categories are explicit failures', () => {
  for (const r of [null, {}, result({ category: 'plastic_bag' }), result({ categoryConfidence: NaN }), result({ classificationStatus: undefined })]) {
    assert.throws(() => utils.mapSemanticResult(r), /INVALID_SEMANTIC_RESPONSE/);
  }
  assert.match(utils.semanticErrorMessage({ response: { status: 503 } }), /503/);
  assert.match(utils.semanticErrorMessage({ code: 'ECONNABORTED' }), /thời gian chờ/);
});
test('manual selection stays separate from AI suggestion and serializes correct backend contract', () => {
  const a = utils.mapSemanticResult(result());
  assert.equal(utils.reportClassification(a).category, undefined);
  assert.equal(utils.reportClassification(a).classification, undefined);
  a.userSelectedCategory = 'illegal_construction_waste';
  const payload = utils.reportClassification(a);
  assert.equal(payload.classification.decision, 'CORRECT');
  assert.equal(a.suggestedCategory, 'illegal_dumping');
  assert.equal(payload.classification.selectedCategory, 'illegal_construction_waste');
  assert.equal(utils.reportClassification({ suggestedCategory: 'UNCLASSIFIED' }).category, undefined);
});
test('mobile API adapter preserves the real response envelope and mass fields', async () => {
  const data = result();
  let request;
  const service = load('shared/api/alertService.ts', { './client': { api: { post: async (...args) => { request = args; return { data: { success: true, data } }; } } } }).alertService;
  const response = await service.validateImageSemantics('https://example.com/evidence.jpg');
  assert.equal(response, data);
  assert.equal(request[0], '/v1/ai/validate-image');
  assert.equal(request[2].timeout, 60000);
});

test('Vision adapter rejects malformed results and service errors rather than fabricating no_detection', async () => {
  let vision;
  const service = load('shared/api/alertService.ts', { './client': { api: { post: async () => ({ data: { data: { aiAnalysis: vision } } }) } } }).alertService;
  for (const invalid of [{}, { status: 'ok', requiresManualReview: true, detections: [{ materialClass: 'plastic', confidence: .7, bbox: [10, 0, 5, 20] }] }]) {
    vision = invalid;
    await assert.rejects(service.analyzeUploadedImage('https://example.com/a.jpg'), /INVALID_VISION_RESPONSE/);
  }
  vision = { status: 'error', requiresManualReview: true, detections: [], errorCode: 'VISION_TIMEOUT' };
  await assert.rejects(service.analyzeUploadedImage('https://example.com/a.jpg'), e => e.code === 'VISION_TIMEOUT');
  vision = { status: 'no_detection', requiresManualReview: true, detections: [] };
  assert.equal((await service.analyzeUploadedImage('https://example.com/a.jpg')).status, 'no_detection');
});

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  return tree?.props ? text(tree.props.children) : '';
}
test('shared Step 3/confirmation card distinguishes category confidence from YOLO and displays API mass', () => {
  const Card = load('citizen/report/components/stitch/FieldAiResultCard.tsx', {
    react: { ...React, default: React },
    'react-native': { View: 'View', Text: 'Text', Animated: {}, StyleSheet: { create: x => x } },
    'lucide-react-native': new Proxy({}, { get: (_, key) => String(key) }),
    '../../../../shared/utils/aiAnalysis': { getCategoryLabel: x => x, getSeverityLabel: x => x },
    '../WasteDetectionChips': { WasteDetectionChips: 'WasteDetectionChips' },
    './fieldPresentation': { fieldConfidence: n => typeof n === 'number' ? n : null },
    './fieldDesign': { fieldColors: {}, fieldStyles: {} },
    './FieldUI': { FieldEntrance: 'FieldEntrance' },
    '../../semanticResult': utils,
    '../../reviewPolicy': reviewPolicy,
  }).FieldAiResultCard;
  const a = { ...utils.mapSemanticResult(result()), detectedObjects: [{ label: 'plastic_bag', confidence: 0.92 }], yoloConfidence: 0.92 };
  for (const compact of [true, false]) {
    const rendered = Card({ analysis: a, compact });
    assert.match(text(rendered), /TIN CẬY PHÂN LOẠI AI/);
    assert.match(text(rendered), /75.0%/);
    assert.match(text(rendered), /2 – 5 kg/);
    assert.doesNotMatch(text(rendered), /API hiện chưa cung cấp|ĐÃ NHẬN DIỆN/);
    assert.ok(nodes(rendered).find(n => n.type === 'WasteDetectionChips'));
  }
  const yoloOnly = Card({ analysis: { ...a, semanticState: 'UNAVAILABLE', suggestedCategory: null, categoryConfidence: null } });
  assert.match(text(yoloOnly), /TIN CẬY YOLO/);
  assert.match(text(yoloOnly), /92.0%/);
  assert.match(text(yoloOnly), /PHÂN TÍCH CHƯA KHẢ DỤNG/);
  const noDetection = Card({ analysis: { state: 'VALID', visionState: 'NO_DETECTION', semanticStage: 'COMPLETE',
    semanticState: 'UNCLASSIFIED', detectedObjects: [], yoloConfidence: .99 } });
  assert.match(text(noDetection), /Đánh giá tự động/);
  assert.match(text(noDetection), /Chưa nhận diện được vật thể/);
  assert.match(text(noDetection), /Chưa xác định được danh mục phù hợp/);
  assert.match(text(noDetection), /không phải kết luận cuối cùng/);
  assert.doesNotMatch(text(noDetection), /99.0%/);
  assert.equal(nodes(noDetection).find(n => n.type === 'WasteDetectionChips'), undefined);
});

test('Vision, Semantic and incident review labels are separate projections of existing states', () => {
  for (const [visionState, expected] of [['IDLE', 'Chờ nhận diện'], ['PROCESSING', 'Đang nhận diện'], ['OK', '1 vùng'], ['NO_DETECTION', 'Chưa nhận diện'], ['FAILED', 'Tạm thời']]) {
    const labels = reviewPolicy.aiStageLabels({ state: 'VALID', visionState, semanticStage: 'IDLE', detectedObjects: visionState === 'OK' ? [{ label: 'plastic_bag' }] : [] });
    assert.ok(labels.vision.includes(expected)); assert.equal(labels.semantic, 'Chờ phân loại'); assert.equal(labels.review, 'Chờ phân loại');
  }
  const processing = reviewPolicy.aiStageLabels({ state: 'PROCESSING', visionState: 'NO_DETECTION', semanticStage: 'PROCESSING', detectedObjects: [] });
  assert.match(processing.vision, /Chưa nhận diện/); assert.equal(processing.semantic, 'Đang phân loại AI');
  const failed = reviewPolicy.aiStageLabels({ state: 'UNAVAILABLE', visionState: 'FAILED', semanticStage: 'FAILED', detectedObjects: [] });
  assert.match(failed.vision, /Tạm thời/); assert.match(failed.semantic, /Tạm thời/);
});
function harness(semantic = async () => result(), vision = { status: 'ok', requiresManualReview: false, detections: [{ materialClass: 'plastic_bag', confidence: 0.92, bbox: [0,0,100,100] }] }) {
  let draft = {
    id: 'test-report',
    capture: { originalLocalUri: 'file://evidence.jpg', capturedAt: '2026-10-13T00:00:00.000Z' },
    location: { latitude: 10.8, longitude: 106.7, address: 'Địa chỉ hiện trường', accuracyMeters: 10, source: 'DEVICE_GPS', capturedAt: '2026-10-13T00:00:00.000Z' },
    title: '', description: '', imageValidation: { state: 'IDLE', detectedObjects: [] },
  };
  draft = photoDraft.normalizePhotoDraft(draft);
  let effects = [], refs = [], cursor = 0, stateCursor = 0, screenName = 'validation', offline = false, focused = true, payload, queued;
  const screenStates = {};
  const calls = { upload: 0, yolo: 0, semantic: 0, nav: [] };
  const react = { ...React, useCallback: fn => fn, useMemo: fn => fn(), useState: init => {
    const values = screenStates[screenName] ||= []; const index = stateCursor++;
    if (!(index in values)) values[index] = typeof init === 'function' ? init() : init;
    return [values[index], update => { values[index] = typeof update === 'function' ? update(values[index]) : update; }];
  },
    useRef: init => refs[cursor++] ||= { current: init }, useEffect: fn => effects.push(fn) };
  react.default = react;
  const native = Object.fromEntries(['View','Text','ScrollView','TouchableOpacity','Modal','ActivityIndicator','TextInput','KeyboardAvoidingView'].map(k => [k,k]));
  native.StyleSheet = { create: x => x }; native.Platform = { OS: 'ios' };
  const service = {
    uploadMedia: async () => { calls.upload++; return 'https://example.com/evidence.jpg'; },
    uploadFieldMedia: async uri => { calls.upload++; return { url: `https://example.com/${uri.split('/').pop()}`, ownershipProof: 'test-proof' }; },
    analyzeUploadedImage: async url => { calls.yolo++; return typeof vision === 'function' ? vision(url) : vision; },
    validateImageSemantics: async url => { calls.semantic++; return semantic(url); },
  };
  const imports = {
    react, 'react-native': native,
    '@react-navigation/native': { useIsFocused: () => focused },
    'lucide-react-native': new Proxy({}, { get: (_, key) => String(key) }),
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '../../../shared/theme/civicDesign': { civicSpace: {}, civicRadius: {}, civicType: {} },
    '../../../shared/api/alertService': { alertService: service },
    '../hooks/useOfflineSync': { useOfflineSync: () => ({ isOffline: offline }) },
    '../../../shared/hooks/useAlerts': { useCheckNearbyAlerts: () => ({ data: [] }), useConfirmAlert: () => ({}), useCreateAlert: () => ({ mutateAsync: async p => { payload = p; return { _id: 'created' }; } }) },
    '../offlineQueue': { offlineQueue: { saveOfflineDraft: async p => { queued = p; } } },
    '../../../shared/utils/aiAnalysis': { getCategoryLabel: x => x, getSeverityLabel: x => x },
    '../useReportTheme': { useReportTheme: () => ({ colors: {} }) },
    '../FieldReportContext': { useFieldReport: () => ({ draft, completeDraft: async () => {}, setDraft: update => { draft = typeof update === 'function' ? update(draft) : update; } }) },
    '../photoDraft': photoDraft,
    '../photoAnalysis': photoAnalysis,
    '../reviewPolicy': reviewPolicy,
    '../components/stitch/fieldPresentation': { fieldIntegrity: () => ({ gps: true }) },
    '../semanticResult': utils,
    '../types': { MAX_FIELD_GPS_ACCURACY_METERS: 50 },
    '../components/stitch/fieldDesign': { fieldStyles: {} },
    'react-native-view-shot': { default: 'ViewShot', captureRef: async () => 'file://baked-yolo.jpg' },
    '../../../shared/utils/watermark': { persistWatermarkedDisplayImage: async uri => uri },
  };
  for (const [id, names] of Object.entries({
    '../components/ReportBottomActions': ['ReportBottomActions'], '../components/ReportHeader': ['ReportHeader'],
    '../components/ReportProgress': ['ReportProgress'], '../components/ReportScreenIntro': ['ReportScreenIntro'],
    '../../../shared/components/vision/WasteDetectionImage': ['WasteDetectionImage'], '../../../shared/components/media/ZoomableImageViewer': ['ZoomableImageViewer'],
    '../components/stitch/FieldAiResultCard': ['FieldAiResultCard'], '../components/stitch/FieldReportSummary': ['FieldReportSummary'],
    '../components/stitch/FieldUI': ['FieldEvidenceMetaOverlay','FieldNotice','FieldScanLine'],
  })) imports[id] = Object.fromEntries(names.map(n => [n,n]));
  const Validation = load('citizen/report/screens/ReportImageValidationScreen.tsx', imports).ReportImageValidationScreen;
  const Confirm = load('citizen/report/screens/ReportConfirmScreen.tsx', imports).ReportConfirmScreen;
  const navigation = { navigate: (...args) => calls.nav.push(args), goBack() {}, isFocused: () => true };
  return {
    calls, get draft() { return draft; }, get payload() { return payload; }, get queued() { return queued; },
    render(screen = 'validation') { cursor = 0; stateCursor = 0; screenName = screen; effects = []; return (screen === 'confirm' ? Confirm : Validation)({ navigation }); },
    start() { effects.forEach(fn => fn()); },
    setOffline(value) { offline = value; },
    setFocused(value) { focused = value; },
    patchDraft(update) { draft = update(draft); },
    appendPhotoButKeepCompletedPrimary() {
      const oldId = draft.primaryPhotoId;
      draft = photoDraft.addPhoto(draft, { id: 'new-photo', originalLocalUri: 'file://new.jpg', capturedAt: '2026-10-13T01:00:00.000Z', location: { ...draft.location, capturedAt: '2026-10-13T01:00:00.000Z' } });
      draft = photoDraft.selectPrimaryPhoto(draft, oldId);
    },
    replaceCapture(sameReport = false) { draft = photoDraft.normalizePhotoDraft({ ...draft, id: sameReport ? draft.id : 'replacement-report', photos: [{ originalLocalUri: 'file://new.jpg', capturedAt: '2026-10-13T01:00:00.000Z' }], primaryPhotoId: undefined, imageValidation: { state: 'IDLE', detectedObjects: [] } }); },
  };
}
const settle = async check => { for (let i=0;i<100;i++) { if (check()) return; await new Promise(r=>setTimeout(r,5)); } assert.fail('Async flow did not settle'); };

test('YOLO + semantic success survives navigation and online confirm submit', async () => {
  const h = harness(); h.render(); h.start();
  await settle(() => h.draft.imageValidation.state === 'VALID');
  assert.equal(h.draft.imageValidation.suggestedCategory, 'illegal_dumping');
  const selection = nodes(h.render('confirm')).find(n => n.props?.accessibilityRole === 'radio' && /illegal_dumping/.test(text(n)));
  selection.props.onPress();
  const analysis = h.draft.imageValidation;
  const tree = h.render('confirm');
  assert.equal(nodes(tree).find(n => n.type === 'FieldAiResultCard').props.analysis, analysis);
  const submit = nodes(tree).find(n => n.type === 'TouchableOpacity' && /GỬI BÁO CÁO/.test(text(n)));
  assert.equal(submit.props.disabled, false); submit.props.onPress();
  await settle(() => h.calls.nav.some(n => n[0] === 'ReportSuccess'));
  assert.equal(h.payload.category, 'illegal_dumping');
  assert.deepEqual(Array.from(h.payload.location.coordinates), [106.7,10.8]);
  assert.equal(h.payload.imageValidation.confidence, 0.75);
  assert.equal(h.draft.imageValidation.massEstimate.minKg, 2);
  assert.equal(h.calls.upload, 1);
});
test('semantic 503 retains YOLO and photo; retry calls only semantic and recovers', async () => {
  let attempts = 0;
  const h = harness(async () => { if (++attempts === 1) throw { response: { status: 503 } }; return result(); });
  h.render(); h.start(); await settle(() => h.draft.imageValidation.state === 'UNAVAILABLE');
  assert.equal(h.draft.imageValidation.semanticState, 'UNAVAILABLE');
  assert.equal(h.draft.imageValidation.backendValidation.decision, 'UNAVAILABLE');
  assert.equal(h.draft.imageValidation.suggestedCategory, null);
  assert.equal(h.draft.imageValidation.detectedObjects.length, 1);
  const retry = nodes(h.render()).find(n => n.type === 'TouchableOpacity' && /THỬ LẠI PHÂN LOẠI/.test(text(n)));
  retry.props.onPress(); await settle(() => h.draft.imageValidation.semanticState === 'COMPLETE');
  assert.equal(h.calls.yolo, 1); assert.equal(h.calls.upload, 1); assert.equal(h.calls.semantic, 2);
});
test('offline confirm preserves citizen category decision and evidence metadata', async () => {
  const h = harness(); h.render(); h.start(); await settle(() => h.draft.imageValidation.state === 'VALID');
  const manual = nodes(h.render('confirm')).find(n => n.props?.accessibilityRole === 'radio' && /illegal_construction_waste/.test(text(n)));
  manual.props.onPress(); h.setOffline(true);
  nodes(h.render('confirm')).find(n => n.type === 'TouchableOpacity' && /LƯU BÁO CÁO NGOẠI TUYẾN/.test(text(n))).props.onPress();
  await settle(() => h.queued);
  assert.equal(h.queued.category, 'illegal_construction_waste');
  assert.equal(h.queued.classification.decision, 'CORRECT');
  assert.equal(h.queued.imageValidation.suggestedCategory, 'illegal_dumping');
  assert.equal(h.queued.captureMetadata.method, 'LIVE_CAMERA');
});
test('late semantic response cannot overwrite a retaken photo draft', async () => {
  let resolve;
  const h = harness(() => new Promise(r => { resolve = r; }));
  h.render(); h.start(); await settle(() => resolve);
  h.replaceCapture(); resolve(result()); await new Promise(r => setTimeout(r, 10));
  assert.equal(h.draft.capture.originalLocalUri, 'file://new.jpg');
  assert.equal(h.draft.imageValidation.state, 'IDLE');
  assert.equal(h.draft.imageValidation.detectedObjects.length, 0);
});

test('late result for a deleted photo in the same report cannot fill a replacement photo', async () => {
  let resolve;
  const h = harness(() => new Promise(r => { resolve = r; }));
  h.render(); h.start(); await settle(() => resolve);
  h.replaceCapture(true); resolve(result()); await new Promise(r => setTimeout(r, 10));
  assert.equal(h.draft.capture.originalLocalUri, 'file://new.jpg');
  assert.equal(h.draft.capture.analysis, undefined);
  assert.equal(h.draft.imageValidation.state, 'IDLE');
  assert.equal(h.draft.imageValidation.detectedObjects.length, 0);
});

test('completed primary VALID never skips a new unprocessed sibling photo', async () => {
  const h = harness(); h.render(); h.start(); await settle(() => h.draft.imageValidation.state === 'VALID');
  h.appendPhotoButKeepCompletedPrimary();
  assert.equal(h.draft.imageValidation.state, 'VALID');
  h.render(); h.start(); await settle(() => h.draft.photos.find(p => p.id === 'new-photo')?.semanticStage === 'COMPLETE');
  assert.equal(h.calls.upload, 2); assert.equal(h.calls.yolo, 2); assert.equal(h.calls.semantic, 2);
  assert.equal(h.draft.photos.length, 2);
});

test('hidden AI screen cannot analyze photos until review navigates to it', async () => {
  const h = harness(); h.setFocused(false); h.render(); h.start();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(h.calls.upload, 0);
  h.setFocused(true); h.render(); h.start();
  await settle(() => h.draft.imageValidation.state === 'VALID');
  assert.equal(h.calls.upload, 1);
});

test('no_detection + UNCLASSIFIED can submit signed GPS evidence for review, without fake category or negative incident verdict', async () => {
  const h = harness(async () => result({ category: 'UNCLASSIFIED', classificationStatus: 'UNCLASSIFIED', confidenceTier: 'UNCLASSIFIED', categoryConfidence: .1, isIncident: false, massEstimate: { available: false } }),
    { status: 'no_detection', requiresManualReview: true, detections: [] });
  h.render(); h.start(); await settle(() => h.draft.capture.semanticStage === 'COMPLETE');
  assert.equal(h.draft.capture.visionState, 'NO_DETECTION');
  assert.equal(h.draft.imageValidation.backendValidation.decision, 'UNCERTAIN');
  assert.equal(h.draft.imageValidation.detectedObjects.length, 0);
  assert.equal(h.draft.imageValidation.yoloConfidence, null);
  assert.notEqual(h.draft.imageValidation.isWasteRelated, false);
  h.patchDraft(d => ({ ...d, title: 'Điểm cần kiểm tra', description: 'Khu vực này cần cán bộ tới kiểm tra thực tế.' }));
  const tree = h.render('confirm'); assert.match(text(tree), /Chờ phân loại/);
  const button = nodes(tree).find(n => n.type === 'TouchableOpacity' && /GỬI BÁO CÁO/.test(text(n)));
  assert.equal(button.props.disabled, false); button.props.onPress();
  await settle(() => h.payload);
  assert.equal(h.payload.category, undefined); assert.equal(h.payload.classification, undefined);
  assert.equal(h.payload.imageValidation.decision, 'UNCERTAIN');
  assert.equal(h.payload.fieldEvidence[0].originalOwnershipProof, 'test-proof');
});

test('technical failures stay UNAVAILABLE but can submit evidence for manual review, not an AI-confirmed category', async () => {
  for (const failure of ['vision', 'semantic']) {
    const h = harness(async () => { if (failure === 'semantic') throw { code: 'ECONNABORTED' }; return result(); },
      failure === 'vision' ? async () => { throw Error('unavailable'); } : { status: 'ok', requiresManualReview: true, detections: [{ materialClass: 'plastic_bag', confidence: .8, bbox: [0,0,20,20] }] });
    h.render(); h.start(); await settle(() => h.draft.imageValidation.state === 'UNAVAILABLE');
    assert.equal(h.draft.imageValidation.backendValidation.decision, 'UNAVAILABLE');
    h.patchDraft(d => ({ ...d, title: 'Cần kiểm tra hiện trường', description: 'Ảnh và GPS ghi nhận vị trí cần cán bộ rà soát.' }));
    const button = nodes(h.render('confirm')).find(n => n.type === 'TouchableOpacity' && /GỬI BÁO CÁO/.test(text(n)));
    assert.equal(button.props.disabled, false); button.props.onPress();
    await settle(() => h.payload);
    assert.equal(h.payload.category, undefined);
    assert.equal(h.payload.imageValidation.decision, 'UNAVAILABLE');
  }
});

test('manual review never bypasses signed upload, GPS integrity, processing or matching image identity', async () => {
  const h = harness(); h.render(); h.start(); await settle(() => h.draft.imageValidation.state === 'VALID');
  const draft = h.draft;
  assert.equal(reviewPolicy.canReviewReport(draft), true);
  for (const patch of [{ originalOwnershipProof: undefined }, { uploadState: 'FAILED' }, { visionState: 'PROCESSING' }, { semanticStage: 'IDLE' },
    { analysisIdentity: 'old-image' }, { originalLocalUri: 'https://example.com/gallery.jpg' },
    { location: { ...draft.location, source: 'MANUAL' } }, { location: { ...draft.location, accuracyMeters: 80 } },
    { location: { ...draft.location, capturedAt: '2026-10-12T00:00:00.000Z' } }]) {
    assert.equal(reviewPolicy.canReviewReport(photoDraft.updatePhoto(draft, draft.capture.id, patch)), false, JSON.stringify(patch));
  }
});

test('switching preview during analysis and a late sibling response never render another image result', async () => {
  const resolvers = {};
  const h = harness(url => new Promise(resolve => { resolvers[url.split('/').pop()] = resolve; }),
    async url => ({ status: 'ok', requiresManualReview: true, detections: [{ materialClass: url.includes('new.jpg') ? 'cardboard' : 'plastic_bag', confidence: .8, bbox: [0,0,20,20] }] }));
  h.appendPhotoButKeepCompletedPrimary(); h.render(); h.start();
  await settle(() => resolvers['evidence.jpg'] && resolvers['new.jpg']);
  nodes(h.render()).find(n => n.props?.accessibilityLabel === 'Xem kết quả phân tích ảnh 2').props.onPress();
  resolvers['evidence.jpg'](result({ overallSummary: 'Kết quả ảnh A' }));
  await settle(() => h.draft.photos[0].analysis);
  const pending = h.render();
  const image = nodes(pending).find(n => n.type === 'WasteDetectionImage');
  assert.equal(image.props.imageUri, 'file://new.jpg');
  assert.equal(image.props.detections[0].materialClass, 'cardboard');
  assert.equal(nodes(pending).find(n => n.type === 'FieldAiResultCard'), undefined);
  resolvers['new.jpg'](result({ overallSummary: 'Kết quả ảnh B' }));
  await settle(() => h.draft.imageValidation.state === 'VALID');
  assert.equal(nodes(h.render()).find(n => n.type === 'FieldAiResultCard').props.analysis.summary, 'Kết quả ảnh B');
  assert.equal(h.draft.imageValidation.summary, 'Kết quả ảnh A');
  assert.equal(h.calls.upload, 2); assert.equal(h.calls.yolo, 2);
});

test('multi-model detections reach ReportFlow with labels, original confidence, bbox and source', async () => {
  const vision = { status: 'ok', requiresManualReview: true, degraded: true, detections: [
    { materialClass: 'plastic_bottle', confidence: .61, bbox: [0, 0, 30, 50], model_id: 'ecoalert_general', original_class_name: 'plastic_bottle' },
    { materialClass: 'animal_waste', confidence: .89, bbox: [30, 20, 70, 60], model_id: 'asian_waste', original_class_name: 'Animal Waste' },
  ] };
  const h = harness(async () => result({ confidenceTier: 'HIGH_CONFIDENCE' }), vision);
  h.render(); h.start(); await settle(() => h.draft.imageValidation.state === 'VALID');
  const objects = h.draft.imageValidation.detectedObjects;
  assert.equal(objects.length, 2);
  assert.equal(objects[1].label, 'animal_waste');
  assert.equal(objects[1].confidence, .89);
  assert.deepEqual(Array.from(objects[1].bbox), [30,20,70,60]);
  assert.equal(objects[1].model_id, 'asian_waste');
  assert.equal(objects[1].original_class_name, 'Animal Waste');
  assert.equal(h.draft.imageValidation.yoloConfidence, null);
  assert.equal(h.draft.imageValidation.backendValidation.decision, 'UNCERTAIN');
  const labels = load('shared/utils/visionBoundingBox.ts');
  assert.equal(labels.getWasteDetectionLabel('animal_waste'), 'Chất thải động vật');
  assert.equal(labels.getWasteDetectionLabel('future_model:unknown'), 'future_model:unknown');
  assert.equal(labels.groupDetectionsByClass(vision.detections).length, 2);
});
