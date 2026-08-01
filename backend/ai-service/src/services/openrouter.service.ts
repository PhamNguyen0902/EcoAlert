import OpenAI from 'openai';
import { z } from 'zod';
import { AlertCategory, createLogger, Severity } from '@ecoalert/shared';

const logger = createLogger('ai-service');

const incidentAnalysisSchema = z.object({
  category: z.nativeEnum(AlertCategory),
  severity: z.nativeEnum(Severity),
  confidence: z.number().min(0).max(1),
  summary: z.string().trim().min(1).max(500),
  reasoningSummary: z.string().trim().min(1).max(500),
}).strict();

export type IncidentAnalysis = z.infer<typeof incidentAnalysisSchema>;
export type IncidentAnalysisMode = 'text' | 'vision' | 'text_fallback';

export interface IncidentAnalysisResult extends IncidentAnalysis {
  analysisMode: IncidentAnalysisMode;
  provider: 'openrouter';
  model: string;
}

export interface IncidentAnalysisInput {
  title?: string;
  description: string;
  imageUrl?: string;
}

export interface OpenRouterConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  siteURL: string;
  appName: string;
}

type OpenRouterClientOptions = ConstructorParameters<typeof OpenAI>[0];

export interface OpenAiSdkClient {
  chat: {
    completions: {
      create: (request: Record<string, unknown>) => Promise<{
        choices: Array<{ message: { content: string | null } }>;
      }>;
    };
  };
}

export type OpenAiClientFactory = (options: OpenRouterClientOptions) => OpenAiSdkClient;

export class OpenRouterConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenRouterConfigurationError';
  }
}

export class OpenRouterResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenRouterResponseError';
  }
}

export class OpenRouterProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'OpenRouterProviderError';
  }
}

export const readOpenRouterConfig = (
  environment: NodeJS.ProcessEnv = process.env,
): OpenRouterConfig => {
  const apiKey = environment.OPENROUTER_API_KEY?.trim();
  const model = environment.OPENROUTER_MODEL?.trim();

  if (!apiKey) {
    throw new OpenRouterConfigurationError(
      'OPENROUTER_API_KEY is required but is not configured.',
    );
  }
  if (!model) {
    throw new OpenRouterConfigurationError(
      'OPENROUTER_MODEL is required but is not configured.',
    );
  }

  return {
    apiKey,
    model,
    baseURL:
      environment.OPENROUTER_BASE_URL?.trim() ||
      'https://openrouter.ai/api/v1',
    siteURL:
      environment.OPENROUTER_SITE_URL?.trim() || 'http://localhost:5173',
    appName: environment.OPENROUTER_APP_NAME?.trim() || 'EcoAlert',
  };
};

const defaultClientFactory: OpenAiClientFactory = (options) =>
  new OpenAI(options) as unknown as OpenAiSdkClient;

export const createOpenRouterClient = (
  config: OpenRouterConfig,
  factory: OpenAiClientFactory = defaultClientFactory,
): OpenAiSdkClient => factory({
  apiKey: config.apiKey,
  baseURL: config.baseURL,
  defaultHeaders: {
    'HTTP-Referer': config.siteURL,
    'X-Title': config.appName,
  },
});

let runtime: { config: OpenRouterConfig; client: OpenAiSdkClient } | null = null;

export const initializeOpenRouter = (
  environment: NodeJS.ProcessEnv = process.env,
  factory: OpenAiClientFactory = defaultClientFactory,
) => {
  const config = readOpenRouterConfig(environment);
  runtime = { config, client: createOpenRouterClient(config, factory) };
  logger.info('OpenRouter incident analysis configured', {
    provider: 'openrouter',
    model: config.model,
    baseURL: config.baseURL,
    keyConfigured: true,
  });
  return runtime;
};

export const resetOpenRouterForTests = () => {
  runtime = null;
};

export const parseIncidentAnalysis = (content: string): IncidentAnalysis => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new OpenRouterResponseError('OpenRouter returned malformed JSON.');
  }

  const result = incidentAnalysisSchema.safeParse(parsed);
  if (!result.success) {
    throw new OpenRouterResponseError(
      'OpenRouter returned an invalid incident analysis payload.',
    );
  }
  return result.data;
};

const structuredResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'environmental_incident_analysis',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'category',
        'severity',
        'confidence',
        'summary',
        'reasoningSummary',
      ],
      properties: {
        category: { type: 'string', enum: Object.values(AlertCategory) },
        severity: { type: 'string', enum: Object.values(Severity) },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        summary: { type: 'string', minLength: 1, maxLength: 500 },
        reasoningSummary: { type: 'string', minLength: 1, maxLength: 500 },
      },
    },
  },
};

const buildUserContent = (input: IncidentAnalysisInput, includeImage: boolean) => {
  const text = [
    `Title: ${input.title?.trim() || 'Not provided'}`,
    `Description: ${input.description.trim() || 'Not provided'}`,
  ].join('\n');

  if (!includeImage || !input.imageUrl) return text;
  return [
    { type: 'text', text },
    { type: 'image_url', image_url: { url: input.imageUrl } },
  ];
};

export const requestIncidentAnalysis = async (
  client: OpenAiSdkClient,
  model: string,
  input: IncidentAnalysisInput,
  includeImage: boolean,
): Promise<IncidentAnalysis> => {
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: [
          'You classify environmental incident reports for EcoAlert.',
          `Use exactly one category from: ${Object.values(AlertCategory).join(', ')}.`,
          `Use exactly one severity from: ${Object.values(Severity).join(', ')}.`,
          'Return confidence as a number from 0 to 1, including 0 when warranted.',
          'Return a concise factual summary and a concise evidence-based reasoningSummary.',
          'Do not provide hidden chain-of-thought or step-by-step internal reasoning.',
        ].join(' '),
      },
      { role: 'user', content: buildUserContent(input, includeImage) },
    ],
    temperature: 0.1,
    response_format: structuredResponseFormat,
  });

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new OpenRouterResponseError('OpenRouter returned an empty response.');
  }
  return parseIncidentAnalysis(content);
};

const statusFromError = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
};

export const safeOpenRouterErrorMetadata = (error: unknown) => {
  const status = statusFromError(error);
  const rawCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
  return {
    provider: 'openrouter',
    status,
    code: typeof rawCode === 'string' ? rawCode : undefined,
    errorType: error instanceof Error ? error.name : 'UnknownError',
  };
};

export const mapProviderError = (error: unknown): Error => {
  if (
    error instanceof OpenRouterConfigurationError ||
    error instanceof OpenRouterResponseError ||
    error instanceof OpenRouterProviderError
  ) {
    return error;
  }

  const status = statusFromError(error);
  const rawCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
  const code = typeof rawCode === 'string' ? rawCode : undefined;
  if (status === 401) {
    return new OpenRouterProviderError(
      'OpenRouter authentication failed.',
      status,
      code,
    );
  }
  return new OpenRouterProviderError(
    'OpenRouter incident analysis request failed.',
    status,
    code,
  );
};

const isUsableImageUrl = (imageUrl?: string) => {
  if (!imageUrl) return false;
  try {
    const url = new URL(imageUrl);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

export const analyzeIncidentWithClient = async (
  client: OpenAiSdkClient,
  model: string,
  input: IncidentAnalysisInput,
): Promise<IncidentAnalysisResult> => {
  const requestedImage = Boolean(input.imageUrl);
  const includeImage = isUsableImageUrl(input.imageUrl);

  try {
    const analysis = await requestIncidentAnalysis(client, model, input, includeImage);
    return {
      ...analysis,
      analysisMode: includeImage ? 'vision' : requestedImage ? 'text_fallback' : 'text',
      provider: 'openrouter',
      model,
    };
  } catch (error) {
    const status = statusFromError(error);
    if (includeImage && (status === 400 || status === 422)) {
      logger.warn('OpenRouter image input was rejected; retrying with report text', {
        provider: 'openrouter',
        model,
        status,
      });
      try {
        const analysis = await requestIncidentAnalysis(client, model, input, false);
        return {
          ...analysis,
          analysisMode: 'text_fallback',
          provider: 'openrouter',
          model,
        };
      } catch (fallbackError) {
        logger.error('OpenRouter text fallback failed', safeOpenRouterErrorMetadata(fallbackError));
        throw mapProviderError(fallbackError);
      }
    }

    logger.error('OpenRouter incident analysis failed', safeOpenRouterErrorMetadata(error));
    throw mapProviderError(error);
  }
};

export const analyzeIncidentWithOpenRouter = async (
  input: IncidentAnalysisInput,
): Promise<IncidentAnalysisResult> => {
  const activeRuntime = runtime || initializeOpenRouter();
  return analyzeIncidentWithClient(activeRuntime.client, activeRuntime.config.model, input);
};
