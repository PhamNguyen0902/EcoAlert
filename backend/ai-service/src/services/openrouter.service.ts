import OpenAI from 'openai';
import { z } from 'zod';
import { AlertCategory, createLogger, Severity } from '@ecoalert/shared';
import {
  OpenRouterConfig,
  OpenRouterConfigurationError,
  readOpenRouterConfig,
} from '../config/openrouter.config';
import { AiTask, resolveModel } from './ai-task-router';
import { envConfig } from '../config/env.config';
import {
  ClassifiedAlertCategory,
  normalizeIncidentCategory,
  normalizeIncidentSeverity,
  UNCLASSIFIED_CATEGORY,
} from './category-normalizer.service';
import { CompactVisionEvidence, formatVisionEvidenceLines } from './vision-evidence.service';

export {
  OpenRouterConfig,
  OpenRouterConfigurationError,
  readOpenRouterConfig,
} from '../config/openrouter.config';

const logger = createLogger('ai-service');

export interface IncidentAnalysis {
  category: ClassifiedAlertCategory;
  severity: Severity;
  confidence: number;
  summary: string;
  reasoningSummary: string;
  isIncident: boolean;
  incidentConfidence: number;
  categoryConfidence: number;
  classificationStatus: 'AI_SUGGESTED' | 'UNCLASSIFIED';
  confidenceTier: 'HIGH_CONFIDENCE' | 'REVIEW_REQUIRED' | 'UNCLASSIFIED';
  severityScore: number;
  severityConfidence: number;
  overallSummary: string;
  shortReason: string;
  visionEvidenceUsed: string[];
}

const rawIncidentAnalysisSchema = z.object({
  isIncident: z.boolean().optional(),
  incidentConfidence: z.number().min(0).max(1).optional(),
  category: z.string().trim().min(1).max(100).nullable(),
  categoryConfidence: z.number().min(0).max(1).optional(),
  severity: z.string().trim().min(1).max(30),
  severityScore: z.number().min(0).max(100).optional(),
  severityConfidence: z.number().min(0).max(1).optional(),
  overallSummary: z.string().trim().min(1).max(800).optional(),
  shortReason: z.string().trim().min(1).max(500).optional(),
  visionEvidenceUsed: z.array(z.string().trim().min(1).max(120)).max(6).optional(),
  // Backward-compatible parsing protects in-flight v1 messages while every
  // newly requested OpenRouter response uses the v2 schema below.
  confidence: z.number().min(0).max(1).optional(),
  summary: z.string().trim().min(1).max(800).optional(),
  reasoningSummary: z.string().trim().min(1).max(500).optional(),
}).strict();

export type IncidentAnalysisMode = 'text' | 'vision' | 'text_fallback';

export interface IncidentAnalysisResult extends IncidentAnalysis {
  analysisMode: IncidentAnalysisMode;
  provider: 'openrouter';
  model: string;
  semanticProcessingTimeMs?: number;
}

export interface IncidentAnalysisInput {
  title?: string;
  description: string;
  imageUrl?: string;
  visionEvidence?: CompactVisionEvidence;
}

type OpenRouterClientOptions = ConstructorParameters<typeof OpenAI>[0];

export interface OpenAiCompletionResponse {
  choices: Array<{ message: { content: string | null } }>;
  model?: string;
  usage?: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    total_tokens?: number | null;
  };
}

export interface OpenAiSdkClient {
  chat: {
    completions: {
      create: (request: Record<string, unknown>) => Promise<OpenAiCompletionResponse>;
    };
  };
}

export type OpenAiClientFactory = (options: OpenRouterClientOptions) => OpenAiSdkClient;

export interface OpenRouterGenerationResult {
  response: OpenAiCompletionResponse;
  configuredModel: string;
  model: string;
  latencyMs: number;
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

const defaultClientFactory: OpenAiClientFactory = (options) =>
  new OpenAI(options) as unknown as OpenAiSdkClient;

export const createOpenRouterClient = (
  config: OpenRouterConfig,
  factory: OpenAiClientFactory = defaultClientFactory,
): OpenAiSdkClient => factory({
  apiKey: config.apiKey,
  baseURL: config.baseURL,
  maxRetries: 1,
  timeout: 15_000,
  defaultHeaders: {
    'HTTP-Referer': config.siteURL,
    'X-Title': config.appName,
  },
});

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined;

export class OpenRouterProvider {
  constructor(
    private readonly client: OpenAiSdkClient,
    private readonly config: OpenRouterConfig,
  ) {}

  getModel(task: AiTask): string {
    return resolveModel(task, this.config);
  }

  async generate(
    task: AiTask,
    request: Record<string, unknown>,
  ): Promise<OpenRouterGenerationResult> {
    const configuredModel = this.getModel(task);
    const startedAt = Date.now();

    logger.info('OpenRouter request started', {
      provider: 'openrouter',
      task,
      model: configuredModel,
    });

    try {
      // The routed model is written last so callers cannot override task routing.
      const response = await this.client.chat.completions.create({
        ...request,
        model: configuredModel,
      });
      const latencyMs = Date.now() - startedAt;
      const returnedModel = response.model?.trim() || configuredModel;

      logger.info('OpenRouter request completed', {
        provider: 'openrouter',
        task,
        model: configuredModel,
        returnedModel,
        latencyMs,
        promptTokens: numberOrUndefined(response.usage?.prompt_tokens),
        completionTokens: numberOrUndefined(response.usage?.completion_tokens),
        totalTokens: numberOrUndefined(response.usage?.total_tokens),
      });

      return {
        response,
        configuredModel,
        model: returnedModel,
        latencyMs,
      };
    } catch (error) {
      logger.warn('OpenRouter request failed', {
        ...safeOpenRouterErrorMetadata(error),
        task,
        model: configuredModel,
        latencyMs: Date.now() - startedAt,
      });
      throw error;
    }
  }
}

export interface OpenRouterRuntime {
  config: OpenRouterConfig;
  client: OpenAiSdkClient;
  provider: OpenRouterProvider;
}

let runtime: OpenRouterRuntime | null = null;
let legacyWarningEmitted = false;

export const initializeOpenRouter = (
  environment: NodeJS.ProcessEnv = process.env,
  factory: OpenAiClientFactory = defaultClientFactory,
): OpenRouterRuntime => {
  const config = readOpenRouterConfig(environment);
  const client = createOpenRouterClient(config, factory);
  runtime = { config, client, provider: new OpenRouterProvider(client, config) };

  if (config.legacyModelTasks.length > 0 && !legacyWarningEmitted) {
    legacyWarningEmitted = true;
    logger.warn('OPENROUTER_MODEL is deprecated. Configure task-specific models.', {
      tasksUsingLegacyModel: config.legacyModelTasks,
    });
  }

  logger.info('OpenRouter configured', {
    configured: true,
    analysisModel: config.analysisModel,
    chatModel: config.chatModel,
    analysisFallbackConfigured: Boolean(config.analysisFallbackModel),
    chatFallbackConfigured: Boolean(config.chatFallbackModel),
    baseURL: config.baseURL,
  });
  return runtime;
};

export const getOpenRouterProvider = (): OpenRouterProvider =>
  (runtime || initializeOpenRouter()).provider;

export const resetOpenRouterForTests = () => {
  runtime = null;
  legacyWarningEmitted = false;
};

export const parseIncidentAnalysis = (content: string): IncidentAnalysis => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new OpenRouterResponseError('OpenRouter returned malformed JSON.');
  }

  const result = rawIncidentAnalysisSchema.safeParse(parsed);
  if (!result.success) {
    throw new OpenRouterResponseError(
      'OpenRouter returned an invalid incident analysis payload.',
    );
  }
  const raw = result.data;
  const categoryConfidence = raw.categoryConfidence ?? raw.confidence;
  const incidentConfidence = raw.incidentConfidence ?? raw.confidence;
  const severityConfidence = raw.severityConfidence ?? raw.confidence;
  const summary = raw.overallSummary ?? raw.summary;
  const reason = raw.shortReason ?? raw.reasoningSummary;
  const severity = normalizeIncidentSeverity(raw.severity);
  if (
    categoryConfidence === undefined ||
    incidentConfidence === undefined ||
    severityConfidence === undefined ||
    !summary ||
    !reason ||
    !severity
  ) {
    throw new OpenRouterResponseError('OpenRouter returned an incomplete incident analysis payload.');
  }

  const rawCategory = normalizeIncidentCategory(raw.category);
  const isIncident = raw.isIncident ?? incidentConfidence >= envConfig.aiCategoryUnclassifiedThreshold;
  const canSuggest = isIncident
    && rawCategory !== UNCLASSIFIED_CATEGORY
    && categoryConfidence >= envConfig.aiCategoryUnclassifiedThreshold;
  const category = canSuggest ? rawCategory : UNCLASSIFIED_CATEGORY;
  const confidenceTier = !canSuggest
    ? 'UNCLASSIFIED' as const
    : categoryConfidence >= envConfig.aiCategorySuggestionThreshold
      ? 'HIGH_CONFIDENCE' as const
      : 'REVIEW_REQUIRED' as const;
  return {
    category,
    severity,
    confidence: categoryConfidence,
    summary,
    reasoningSummary: reason,
    isIncident,
    incidentConfidence,
    categoryConfidence,
    classificationStatus: canSuggest ? 'AI_SUGGESTED' : 'UNCLASSIFIED',
    confidenceTier,
    severityScore: raw.severityScore ?? severityScoreFor(severity),
    severityConfidence,
    overallSummary: summary,
    shortReason: reason,
    visionEvidenceUsed: raw.visionEvidenceUsed ?? [],
  };
};

const severityScoreFor = (severity: Severity): number => ({
  [Severity.LOW]: 20,
  [Severity.MEDIUM]: 45,
  [Severity.HIGH]: 70,
  [Severity.CRITICAL]: 90,
}[severity]);

const structuredResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'environmental_incident_analysis',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'isIncident',
        'incidentConfidence',
        'category',
        'categoryConfidence',
        'severity',
        'severityScore',
        'severityConfidence',
        'overallSummary',
        'shortReason',
        'visionEvidenceUsed',
      ],
      properties: {
        isIncident: { type: 'boolean' },
        incidentConfidence: { type: 'number', minimum: 0, maximum: 1 },
        category: { type: 'string', enum: [...Object.values(AlertCategory), UNCLASSIFIED_CATEGORY] },
        categoryConfidence: { type: 'number', minimum: 0, maximum: 1 },
        severity: { type: 'string', enum: Object.values(Severity) },
        severityScore: { type: 'number', minimum: 0, maximum: 100 },
        severityConfidence: { type: 'number', minimum: 0, maximum: 1 },
        overallSummary: { type: 'string', minLength: 1, maxLength: 800 },
        shortReason: { type: 'string', minLength: 1, maxLength: 500 },
        visionEvidenceUsed: { type: 'array', maxItems: 6, items: { type: 'string', minLength: 1, maxLength: 120 } },
      },
    },
  },
};

const buildUserContent = (input: IncidentAnalysisInput, includeImage: boolean) => {
  const visionEvidence = input.visionEvidence;
  const visionText = !visionEvidence
    ? 'Vision evidence: not requested for this analysis.'
    : !visionEvidence.detectorAvailable
      ? 'Vision evidence: detector unavailable. This does not mean there is no incident.'
      : [
        `Vision evidence: custom EcoAlert detector ${visionEvidence.model || 'unknown model'} completed.`,
        `Detected objects: ${visionEvidence.totalObjects}.`,
        `Objects: ${formatVisionEvidenceLines(visionEvidence).join('; ') || 'none'}.`,
        `Detector confidence: ${visionEvidence.detectorConfidence === null ? 'not available' : visionEvidence.detectorConfidence}.`,
      ].join('\n');
  const text = [
    `Title: ${input.title?.trim() || 'Not provided'}`,
    `Description: ${input.description.trim() || 'Not provided'}`,
    visionText,
  ].join('\n');

  if (!includeImage || !input.imageUrl) return text;
  return [
    { type: 'text', text },
    { type: 'image_url', image_url: { url: input.imageUrl } },
  ];
};

const incidentCompletionRequest = (
  input: IncidentAnalysisInput,
  includeImage: boolean,
): Record<string, unknown> => ({
  messages: [
    {
      role: 'system',
      content: [
        'You are EcoAlert’s environmental incident classification assistant.',
        'Perform an incident-level interpretation only from the report image, citizen title/description, and supplied Vision evidence.',
        'Vision evidence is object-level supporting evidence only. The custom detector recognizes only plastic_bottle, plastic_bag, plastic_cup, metal_can, cardboard, and glass_bottle.',
        'Zero Vision detections does not mean there is no incident; flooding and other categories can still be supported by the report image and description.',
        'Do not invent objects that are not visible in the image or supplied Vision evidence. Do not expose hidden reasoning.',
        `Use exactly one canonical category from: ${Object.values(AlertCategory).join(', ')}, or ${UNCLASSIFIED_CATEGORY} when the evidence is insufficient or unsupported.`,
        `Use exactly one severity from: ${Object.values(Severity).join(', ')}.`,
        'Use calibrated confidence values from 0 to 1. overallSummary must be 2–4 concise human-readable sentences; shortReason must be a short evidence-based explanation.',
        'List only concise supplied Vision evidence strings in visionEvidenceUsed. AI is decision support only and never verifies, assigns, resolves, or closes an incident.',
      ].join(' '),
    },
    { role: 'user', content: buildUserContent(input, includeImage) },
  ],
  temperature: 0.1,
  response_format: structuredResponseFormat,
});

const analysisFromCompletion = (
  response: OpenAiCompletionResponse,
): IncidentAnalysis => {
  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new OpenRouterResponseError('OpenRouter returned an empty response.');
  }
  return parseIncidentAnalysis(content);
};

export const requestIncidentAnalysis = async (
  client: OpenAiSdkClient,
  model: string,
  input: IncidentAnalysisInput,
  includeImage: boolean,
): Promise<IncidentAnalysis> => {
  const response = await client.chat.completions.create({
    ...incidentCompletionRequest(input, includeImage),
    model,
  });
  return analysisFromCompletion(response);
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
    'OpenRouter request failed.',
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

type IncidentRequester = (
  includeImage: boolean,
) => Promise<{ analysis: IncidentAnalysis; model: string; latencyMs?: number }>;

const analyzeIncident = async (
  request: IncidentRequester,
  input: IncidentAnalysisInput,
  loggedModel: string,
): Promise<IncidentAnalysisResult> => {
  const requestedImage = Boolean(input.imageUrl);
  const includeImage = isUsableImageUrl(input.imageUrl);

  try {
    const result = await request(includeImage);
    return {
      ...result.analysis,
      analysisMode: includeImage ? 'vision' : requestedImage ? 'text_fallback' : 'text',
      provider: 'openrouter',
      model: result.model,
      ...(result.latencyMs !== undefined ? { semanticProcessingTimeMs: result.latencyMs } : {}),
    };
  } catch (error) {
    const status = statusFromError(error);
    if (includeImage && (status === 400 || status === 422)) {
      logger.warn('OpenRouter image input was rejected; retrying with report text', {
        provider: 'openrouter',
        task: AiTask.INCIDENT_ANALYSIS,
        model: loggedModel,
        status,
      });
      try {
        const result = await request(false);
        return {
          ...result.analysis,
          analysisMode: 'text_fallback',
          provider: 'openrouter',
          model: result.model,
          ...(result.latencyMs !== undefined ? { semanticProcessingTimeMs: result.latencyMs } : {}),
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

export const analyzeIncidentWithClient = async (
  client: OpenAiSdkClient,
  model: string,
  input: IncidentAnalysisInput,
): Promise<IncidentAnalysisResult> => analyzeIncident(
  async (includeImage) => {
    const startedAt = Date.now();
    return {
      analysis: await requestIncidentAnalysis(client, model, input, includeImage),
      model,
      latencyMs: Date.now() - startedAt,
    };
  },
  input,
  model,
);

export const analyzeIncidentWithOpenRouter = async (
  input: IncidentAnalysisInput,
): Promise<IncidentAnalysisResult> => {
  const provider = getOpenRouterProvider();
  const configuredModel = provider.getModel(AiTask.INCIDENT_ANALYSIS);
  return analyzeIncident(
    async (includeImage) => {
      const generation = await provider.generate(
        AiTask.INCIDENT_ANALYSIS,
        incidentCompletionRequest(input, includeImage),
      );
      return {
        analysis: analysisFromCompletion(generation.response),
        model: generation.model,
        latencyMs: generation.latencyMs,
      };
    },
    input,
    configuredModel,
  );
};

export const translateTextWithOpenRouter = async (
  text: string,
  targetLang: 'vi' | 'en' = 'en',
): Promise<string> => {
  const provider = getOpenRouterProvider();
  const systemPrompt =
    targetLang === 'en'
      ? 'You are a translation assistant for the EcoAlert environmental system. Translate the user input from Vietnamese into clear, professional English. Output ONLY the translated string without commentary, extra notes, or quotes.'
      : 'Bạn là trợ lý dịch thuật cho hệ thống EcoAlert. Hãy dịch văn bản sang tiếng Việt chính xác, tự nhiên. CHỈ trả về văn bản đã dịch, không kèm bất kỳ giải thích hay dấu ngoặc kép nào.';

  const generation = await provider.generate(
    AiTask.CHAT,
    {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.1,
    },
  );

  const content = generation.response.choices[0]?.message.content;
  return content ? content.trim() : text;
};
