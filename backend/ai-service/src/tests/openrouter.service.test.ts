import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeIncidentWithClient, OpenAiSdkClient, OpenRouterConfigurationError,
  parseIncidentAnalysis, readOpenRouterConfig,
} from '../services/openrouter.service';

test('requires an analysis model without a second model configuration', () => {
  assert.throws(() => readOpenRouterConfig({ OPENROUTER_API_KEY: 'key' }), OpenRouterConfigurationError);
  const config = readOpenRouterConfig({ OPENROUTER_API_KEY: 'key', OPENROUTER_ANALYSIS_MODEL: 'openai/gpt-4o-mini' });
  assert.equal(config.analysisModel, 'openai/gpt-4o-mini');
});

test('sends Vietnamese direct multimodal instructions without secondary evidence', async () => {
  let request: Record<string, unknown> | undefined;
  const client: OpenAiSdkClient = { chat: { completions: { create: async (value) => {
    request = value;
    return { choices: [{ message: { content: JSON.stringify({
      isIncident: true, incidentConfidence: 0.9, category: 'illegal_dumping', categoryConfidence: 0.85,
      severity: 'high', severityScore: 70, severityConfidence: 0.8,
      overallSummary: 'Báo cáo cho thấy rác bị đổ ven đường.', shortReason: 'Ảnh và mô tả cho thấy chất thải tập trung.',
      massEstimate: {
        available: true, minKg: 18, maxKg: 35, mostLikelyKg: 26,
        confidence: 0.64, scale: 'MEDIUM', reasoningSummary: 'Nhiều bao rác tập trung ven đường.',
        limitations: ['Một phần chất thải bị che khuất.'],
      },
    }) } }] };
  } } } };
  const result = await analyzeIncidentWithClient(client, 'openai/gpt-4o-mini', { title: 'Rác ven đường', description: 'Có rác.', imageUrl: 'https://example.com/evidence.jpg' });
  const messages = request?.messages as Array<{ role: string; content: unknown }>;
  assert.match(String(messages[0]?.content), /trợ lý AI chuyên phân tích/);
  assert.doesNotMatch(String(messages[0]?.content), /secondary evidence/);
  assert.equal(result.analysisMode, 'IMAGE_AND_TEXT');
  assert.equal(result.category, 'illegal_dumping');
  assert.deepEqual(result.massEstimate, {
    available: true, minKg: 18, maxKg: 35, mostLikelyKg: 26,
    confidence: 0.64, scale: 'MEDIUM', reasoningSummary: 'Nhiều bao rác tập trung ven đường.',
    limitations: ['Một phần chất thải bị che khuất.'],
  });
});

test('rejects malformed direct analysis responses', () => {
  assert.throws(() => parseIncidentAnalysis('not-json'));
});

const fixture = (extra: Record<string, unknown> = {}) => JSON.stringify({
  isIncident: true, incidentConfidence: 0.9, category: 'illegal_dumping', categoryConfidence: 0.9,
  severity: 'high', severityConfidence: 0.8, overallSummary: 'Có rác thải tập trung.', shortReason: 'Ảnh có chất thải.',
  massEstimate: { available: true, minKg: 2, maxKg: 5, mostLikelyKg: 3, confidence: 0.7, scale: 'SMALL', reasoningSummary: 'Có vật tham chiếu.', limitations: [] },
  ...extra,
});

test('distinguishes valid category, unknown and low confidence without lowering thresholds', () => {
  assert.equal(parseIncidentAnalysis(fixture()).classificationReason, 'CLASSIFIED');
  const low = parseIncidentAnalysis(fixture({ categoryConfidence: 0.01 }));
  assert.equal(low.category, 'UNCLASSIFIED');
  assert.equal(low.classificationReason, 'LOW_CONFIDENCE');
  assert.equal(parseIncidentAnalysis(fixture({ category: 'UNCLASSIFIED' })).classificationReason, 'UNKNOWN_CATEGORY');
  assert.equal(parseIncidentAnalysis(fixture({ isIncident: false })).classificationReason, 'NOT_INCIDENT');
  assert.equal(parseIncidentAnalysis(fixture({ category: 'CONSTRUCTION_WASTE' })).category, 'illegal_construction_waste');
});

test('preserves valid mass and rejects inconsistent mass without claiming text-only', () => {
  const valid = parseIncidentAnalysis(fixture());
  assert.equal(valid.massEstimate.minKg, 2);
  const invalid = parseIncidentAnalysis(fixture({ massEstimate: { ...valid.massEstimate, minKg: 7 } }));
  assert.equal(invalid.massEstimate.available, false);
  assert.deepEqual(invalid.massEstimate.limitations, []);
  const unavailable = parseIncidentAnalysis(fixture({ massEstimate: { ...valid.massEstimate, available: false, reasoningSummary: 'Ảnh thiếu vật tham chiếu.' } }));
  assert.equal(unavailable.massEstimate.minKg, null);
  assert.equal(unavailable.massEstimate.reasoningSummary, 'Ảnh thiếu vật tham chiếu.');
  assert.equal(parseIncidentAnalysis(fixture(), false).massEstimate.available, false);
});

test('image rejection is explicitly TEXT_ONLY and cannot retain visual mass', async () => {
  let calls = 0;
  const client: OpenAiSdkClient = { chat: { completions: { create: async () => {
    if (++calls === 1) throw Object.assign(new Error('image rejected'), { status: 400 });
    return { choices: [{ message: { content: fixture() } }] };
  } } } };
  const result = await analyzeIncidentWithClient(client, 'test-model', { imageUrl: 'https://example.com/test.jpg', description: 'Rác thải.' });
  assert.equal(calls, 2);
  assert.equal(result.analysisMode, 'TEXT_ONLY');
  assert.equal(result.massEstimate.available, false);
});

test('503 is a semantic failure, never a fabricated successful classification', async () => {
  const client: OpenAiSdkClient = { chat: { completions: { create: async () => { throw Object.assign(new Error('unavailable'), { status: 503 }); } } } };
  await assert.rejects(analyzeIncidentWithClient(client, 'test-model', { imageUrl: 'https://example.com/test.jpg', description: 'Rác thải.' }));
});
