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
    }) } }] };
  } } } };
  const result = await analyzeIncidentWithClient(client, 'openai/gpt-4o-mini', { title: 'Rác ven đường', description: 'Có rác.', imageUrl: 'https://example.com/evidence.jpg' });
  const messages = request?.messages as Array<{ role: string; content: unknown }>;
  assert.match(String(messages[0]?.content), /trợ lý AI chuyên phân tích/);
  assert.doesNotMatch(String(messages[0]?.content), /secondary evidence/);
  assert.equal(result.analysisMode, 'IMAGE_AND_TEXT');
  assert.equal(result.category, 'illegal_dumping');
});

test('rejects malformed direct analysis responses', () => {
  assert.throws(() => parseIncidentAnalysis('not-json'));
});
