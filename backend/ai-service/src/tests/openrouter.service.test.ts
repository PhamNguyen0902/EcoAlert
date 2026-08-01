import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeIncidentWithClient,
  createOpenRouterClient,
  mapProviderError,
  OpenAiSdkClient,
  OpenRouterConfigurationError,
  OpenRouterProviderError,
  OpenRouterResponseError,
  parseIncidentAnalysis,
  readOpenRouterConfig,
  safeOpenRouterErrorMetadata,
} from '../services/openrouter.service';

const validEnvironment = (): NodeJS.ProcessEnv => ({
  OPENROUTER_API_KEY: 'test-openrouter-key',
  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
  OPENROUTER_MODEL: 'openai/gpt-4o-mini',
  OPENROUTER_SITE_URL: 'http://localhost:5173',
  OPENROUTER_APP_NAME: 'EcoAlert',
});

test('missing and whitespace-only OpenRouter keys fail fast', () => {
  assert.throws(
    () => readOpenRouterConfig({ OPENROUTER_MODEL: 'openai/gpt-4o-mini' }),
    OpenRouterConfigurationError,
  );
  assert.throws(
    () => readOpenRouterConfig({
      OPENROUTER_API_KEY: '   ',
      OPENROUTER_MODEL: 'openai/gpt-4o-mini',
    }),
    OpenRouterConfigurationError,
  );
});

test('missing OpenRouter model fails fast', () => {
  assert.throws(
    () => readOpenRouterConfig({ OPENROUTER_API_KEY: 'test-key' }),
    OpenRouterConfigurationError,
  );
});

test('the SDK receives the trimmed key, base URL, and safe attribution headers', () => {
  const config = readOpenRouterConfig({
    ...validEnvironment(),
    OPENROUTER_API_KEY: '  test-openrouter-key  ',
  });
  let capturedOptions: Record<string, unknown> | undefined;

  createOpenRouterClient(config, (options) => {
    capturedOptions = options as Record<string, unknown>;
    return {
      chat: { completions: { create: async () => ({ choices: [] }) } },
    };
  });

  assert.equal(capturedOptions?.apiKey, 'test-openrouter-key');
  assert.equal(capturedOptions?.baseURL, 'https://openrouter.ai/api/v1');
  assert.deepEqual(capturedOptions?.defaultHeaders, {
    'HTTP-Referer': 'http://localhost:5173',
    'X-Title': 'EcoAlert',
  });
});

test('configured model is used and confidence zero is preserved', async () => {
  let capturedRequest: Record<string, unknown> | undefined;
  const client: OpenAiSdkClient = {
    chat: {
      completions: {
        create: async (request) => {
          capturedRequest = request;
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  category: 'illegal_dumping',
                  severity: 'high',
                  confidence: 0,
                  summary: 'Waste was reported beside a road.',
                  reasoningSummary: 'The report explicitly describes roadside dumping.',
                }),
              },
            }],
          };
        },
      },
    },
  };

  const result = await analyzeIncidentWithClient(
    client,
    'openai/gpt-4o-mini',
    { title: 'Roadside waste', description: 'Bags of waste beside the road.' },
  );

  assert.equal(capturedRequest?.model, 'openai/gpt-4o-mini');
  assert.equal(result.confidence, 0);
  assert.equal(result.category, 'illegal_dumping');
  assert.equal(result.severity, 'high');
  assert.equal(result.analysisMode, 'text');
});

test('malformed or out-of-schema AI JSON is rejected', () => {
  assert.throws(() => parseIncidentAnalysis('not-json'), OpenRouterResponseError);
  assert.throws(
    () => parseIncidentAnalysis(JSON.stringify({
      category: 'invented_category',
      severity: 'low',
      confidence: 0.5,
      summary: 'Invalid category.',
      reasoningSummary: 'Invalid category.',
    })),
    OpenRouterResponseError,
  );
});

test('401 errors are mapped without retaining a key or authorization value', () => {
  const secret = 'test-secret-that-must-not-be-logged';
  const providerError = Object.assign(
    new Error(`Authorization: Bearer ${secret}`),
    { status: 401, code: 'unauthorized' },
  );
  const mapped = mapProviderError(providerError);
  const metadata = safeOpenRouterErrorMetadata(providerError);

  assert.ok(mapped instanceof OpenRouterProviderError);
  assert.equal((mapped as OpenRouterProviderError).status, 401);
  assert.equal(mapped.message, 'OpenRouter authentication failed.');
  assert.ok(!mapped.message.includes(secret));
  assert.ok(!JSON.stringify(metadata).includes(secret));
});

test('a rejected image payload retries once with text and marks the fallback', async () => {
  const requests: Array<Record<string, unknown>> = [];
  const client: OpenAiSdkClient = {
    chat: {
      completions: {
        create: async (request) => {
          requests.push(request);
          if (requests.length === 1) throw Object.assign(new Error('bad image'), { status: 400 });
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  category: 'water_pollution',
                  severity: 'medium',
                  confidence: 0.8,
                  summary: 'Discolored water was reported.',
                  reasoningSummary: 'The text describes visible contamination in water.',
                }),
              },
            }],
          };
        },
      },
    },
  };

  const result = await analyzeIncidentWithClient(
    client,
    'openai/gpt-4o-mini',
    {
      description: 'The canal water has turned dark.',
      imageUrl: 'https://example.com/evidence.jpg',
    },
  );

  assert.equal(requests.length, 2);
  assert.equal(result.analysisMode, 'text_fallback');
});
