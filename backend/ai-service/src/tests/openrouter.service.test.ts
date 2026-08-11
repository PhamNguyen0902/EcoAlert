import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeIncidentWithClient,
  createOpenRouterClient,
  getOpenRouterProvider,
  initializeOpenRouter,
  mapProviderError,
  OpenAiSdkClient,
  OpenRouterConfigurationError,
  OpenRouterProvider,
  OpenRouterProviderError,
  OpenRouterResponseError,
  parseIncidentAnalysis,
  readOpenRouterConfig,
  resetOpenRouterForTests,
  safeOpenRouterErrorMetadata,
} from '../services/openrouter.service';
import { AiTask, resolveModel } from '../services/ai-task-router';
import { createAssistantLlmProvider } from '../assistant/llm-provider';

const validEnvironment = (): NodeJS.ProcessEnv => ({
  OPENROUTER_API_KEY: 'test-openrouter-key',
  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
  OPENROUTER_ANALYSIS_MODEL: 'openai/gpt-4o-mini',
  OPENROUTER_CHAT_MODEL: 'meta-llama/llama-3.1-8b-instruct',
  OPENROUTER_SITE_URL: 'http://localhost:5173',
  OPENROUTER_APP_NAME: 'EcoAlert',
});

test('missing and whitespace-only OpenRouter keys fail fast', () => {
  assert.throws(
    () => readOpenRouterConfig({
      OPENROUTER_ANALYSIS_MODEL: 'openai/gpt-4o-mini',
      OPENROUTER_CHAT_MODEL: 'meta-llama/llama-3.1-8b-instruct',
    }),
    OpenRouterConfigurationError,
  );
  assert.throws(
    () => readOpenRouterConfig({
      OPENROUTER_API_KEY: '   ',
      OPENROUTER_ANALYSIS_MODEL: 'openai/gpt-4o-mini',
      OPENROUTER_CHAT_MODEL: 'meta-llama/llama-3.1-8b-instruct',
    }),
    OpenRouterConfigurationError,
  );
});

test('missing task-specific OpenRouter models fail fast', () => {
  assert.throws(
    () => readOpenRouterConfig({ OPENROUTER_API_KEY: 'test-key' }),
    OpenRouterConfigurationError,
  );
  assert.throws(
    () => readOpenRouterConfig({
      OPENROUTER_API_KEY: 'test-key',
      OPENROUTER_ANALYSIS_MODEL: 'openai/gpt-4o-mini',
    }),
    OpenRouterConfigurationError,
  );
});

test('task routing selects analysis and chat models deterministically', () => {
  const config = readOpenRouterConfig(validEnvironment());
  assert.equal(resolveModel(AiTask.INCIDENT_ANALYSIS, config), 'openai/gpt-4o-mini');
  assert.equal(resolveModel(AiTask.CHAT, config), 'meta-llama/llama-3.1-8b-instruct');
});

test('legacy OPENROUTER_MODEL temporarily supplies either missing task model', () => {
  const config = readOpenRouterConfig({
    OPENROUTER_API_KEY: 'test-key',
    OPENROUTER_MODEL: 'legacy/model',
    OPENROUTER_ANALYSIS_MODEL: 'analysis/model',
  });

  assert.equal(config.analysisModel, 'analysis/model');
  assert.equal(config.chatModel, 'legacy/model');
  assert.deepEqual(config.legacyModelTasks, ['CHAT']);
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
  assert.equal(capturedOptions?.maxRetries, 1);
  assert.equal(capturedOptions?.timeout, 15_000);
});

test('runtime creates one shared client and reuses its provider', () => {
  resetOpenRouterForTests();
  let factoryCalls = 0;
  const runtime = initializeOpenRouter(validEnvironment(), () => {
    factoryCalls += 1;
    return { chat: { completions: { create: async () => ({ choices: [] }) } } };
  });

  assert.equal(factoryCalls, 1);
  assert.strictEqual(getOpenRouterProvider(), runtime.provider);
  assert.equal(factoryCalls, 1);
  resetOpenRouterForTests();
});

test('shared provider routes analysis and chat without allowing caller model overrides', async () => {
  const requests: Array<Record<string, unknown>> = [];
  const client: OpenAiSdkClient = {
    chat: {
      completions: {
        create: async (request) => {
          requests.push(request);
          return {
            model: String(request.model),
            choices: [{ message: { content: 'Assistant response' } }],
          };
        },
      },
    },
  };
  const provider = new OpenRouterProvider(client, readOpenRouterConfig(validEnvironment()));

  await provider.generate(AiTask.INCIDENT_ANALYSIS, { model: 'caller/override', messages: [] });
  const assistant = createAssistantLlmProvider(() => provider);
  const chat = await assistant.generate('System prompt', [], 'What is EcoAlert?');

  assert.equal(requests[0].model, 'openai/gpt-4o-mini');
  assert.equal(requests[1].model, 'meta-llama/llama-3.1-8b-instruct');
  assert.notEqual(requests[1].model, requests[0].model);
  assert.equal(chat.model, 'meta-llama/llama-3.1-8b-instruct');
  assert.equal(chat.content, 'Assistant response');
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
  assert.equal(result.category, 'UNCLASSIFIED');
  assert.equal(result.severity, 'high');
  assert.equal(result.analysisMode, 'text');
});

test('malformed AI JSON is rejected and unsupported categories are normalized safely', () => {
  assert.throws(() => parseIncidentAnalysis('not-json'), OpenRouterResponseError);
  assert.equal(parseIncidentAnalysis(JSON.stringify({
    category: 'invented_category',
    severity: 'low',
    confidence: 0.5,
    summary: 'Invalid category.',
    reasoningSummary: 'Invalid category.',
  })).category, 'UNCLASSIFIED');
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
  const messages = requests[0].messages as Array<{ role: string; content: unknown }>;
  const userContent = messages.find((message) => message.role === 'user')?.content;
  assert.ok(Array.isArray(userContent));
  assert.ok(userContent.some((part: any) =>
    part.type === 'image_url' && part.image_url?.url === 'https://example.com/evidence.jpg'));
});
