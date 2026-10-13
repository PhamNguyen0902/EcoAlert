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
  }).outputText, { exports, Error, Date, Number, console, require(id) { assert.ok(id in imports, id); return imports[id]; } });
  return exports;
}
const utils = load('citizen/report/semanticResult.ts');
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
  assert.equal(utils.reportClassification(a).category, 'illegal_dumping');
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
});
function harness(semantic = async () => result()) {
  let draft = {
    capture: { originalLocalUri: 'file://evidence.jpg', capturedAt: '2026-10-13T00:00:00.000Z' },
    location: { latitude: 10.8, longitude: 106.7, address: 'Địa chỉ hiện trường', accuracyMeters: 10, source: 'DEVICE_GPS', capturedAt: '2026-10-13T00:00:00.000Z' },
    title: '', description: '', imageValidation: { state: 'IDLE', detectedObjects: [] },
  };
  let effects = [], refs = [], cursor = 0, offline = false, payload, queued;
  const calls = { upload: 0, yolo: 0, semantic: 0, nav: [] };
  const react = { ...React, useCallback: fn => fn, useMemo: fn => fn(), useState: init => [typeof init === 'function' ? init() : init, () => {}],
    useRef: init => refs[cursor++] ||= { current: init }, useEffect: fn => effects.push(fn) };
  react.default = react;
  const native = Object.fromEntries(['View','Text','ScrollView','TouchableOpacity','Modal','ActivityIndicator','TextInput','KeyboardAvoidingView'].map(k => [k,k]));
  native.StyleSheet = { create: x => x }; native.Platform = { OS: 'ios' };
  const service = {
    uploadMedia: async () => { calls.upload++; return 'https://example.com/evidence.jpg'; },
    analyzeUploadedImage: async () => { calls.yolo++; return { status: 'ok', requiresManualReview: false, detections: [{ materialClass: 'plastic_bag', confidence: 0.92, bbox: [0,0,100,100] }] }; },
    validateImageSemantics: async () => { calls.semantic++; return semantic(); },
  };
  const imports = {
    react, 'react-native': native,
    'lucide-react-native': new Proxy({}, { get: (_, key) => String(key) }),
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '../../../shared/theme/civicDesign': { civicSpace: {}, civicRadius: {}, civicType: {} },
    '../../../shared/api/alertService': { alertService: service },
    '../hooks/useOfflineSync': { useOfflineSync: () => ({ isOffline: offline }) },
    '../../../shared/hooks/useAlerts': { useCheckNearbyAlerts: () => ({ data: [] }), useConfirmAlert: () => ({}), useCreateAlert: () => ({ mutateAsync: async p => { payload = p; return { _id: 'created' }; } }) },
    '../offlineQueue': { offlineQueue: { saveOfflineDraft: async p => { queued = p; } } },
    '../../../shared/utils/aiAnalysis': { getCategoryLabel: x => x, getSeverityLabel: x => x },
    '../useReportTheme': { useReportTheme: () => ({ colors: {} }) },
    '../FieldReportContext': { useFieldReport: () => ({ draft, setDraft: update => { draft = typeof update === 'function' ? update(draft) : update; } }) },
    '../semanticResult': utils,
    '../types': { MAX_FIELD_GPS_ACCURACY_METERS: 50 },
    '../components/stitch/fieldDesign': { fieldStyles: {} },
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
  const navigation = { navigate: (...args) => calls.nav.push(args), goBack() {} };
  return {
    calls, get draft() { return draft; }, get payload() { return payload; }, get queued() { return queued; },
    render(screen = 'validation') { cursor = 0; effects = []; return (screen === 'confirm' ? Confirm : Validation)({ navigation }); },
    start() { effects.forEach(fn => fn()); },
    setOffline(value) { offline = value; },
    replaceCapture() { draft = { ...draft, capture: { originalLocalUri: 'file://new.jpg', capturedAt: '2026-10-13T01:00:00.000Z' }, imageValidation: { state: 'IDLE', detectedObjects: [] } }; },
  };
}
const settle = async check => { for (let i=0;i<100;i++) { if (check()) return; await new Promise(r=>setTimeout(r,5)); } assert.fail('Async flow did not settle'); };

test('YOLO + semantic success survives navigation and online confirm submit', async () => {
  const h = harness(); h.render(); h.start();
  await settle(() => h.draft.imageValidation.state === 'VALID');
  assert.equal(h.draft.imageValidation.suggestedCategory, 'illegal_dumping');
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
  h.render(); h.start(); await settle(() => h.draft.imageValidation.state === 'VALID');
  assert.equal(h.draft.imageValidation.semanticState, 'UNAVAILABLE');
  assert.equal(h.draft.imageValidation.backendValidation.decision, 'UNCERTAIN');
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
