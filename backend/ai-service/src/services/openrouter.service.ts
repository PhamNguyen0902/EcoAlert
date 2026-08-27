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
  // Backward-compatible parsing protects in-flight v1 messages while every
  // newly requested OpenRouter response uses the v2 schema below.
  confidence: z.number().min(0).max(1).optional(),
  summary: z.string().trim().min(1).max(800).optional(),
  reasoningSummary: z.string().trim().min(1).max(500).optional(),
}).strict();

export type IncidentAnalysisMode = 'TEXT_ONLY' | 'IMAGE_AND_TEXT';

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

  if (config.usesLegacyModel && !legacyWarningEmitted) {
    legacyWarningEmitted = true;
    logger.warn('OPENROUTER_MODEL is deprecated. Configure task-specific models.', {
      tasksUsingLegacyModel: ['INCIDENT_ANALYSIS'],
    });
  }

  logger.info('OpenRouter configured', {
    configured: true,
    analysisModel: config.analysisModel,
    analysisFallbackConfigured: Boolean(config.analysisFallbackModel),
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
    throw new OpenRouterResponseError('OpenRouter trả về dữ liệu JSON không hợp lệ.');
  }

  const result = rawIncidentAnalysisSchema.safeParse(parsed);
  if (!result.success) {
    throw new OpenRouterResponseError(
      'OpenRouter trả về dữ liệu phân tích sự cố không hợp lệ.',
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
    throw new OpenRouterResponseError('OpenRouter trả về dữ liệu phân tích sự cố chưa đầy đủ.');
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
      },
    },
  },
};

const buildUserContent = (input: IncidentAnalysisInput, includeImage: boolean) => {
  const text = [
    `Tiêu đề: ${input.title?.trim() || 'Không được cung cấp'}`,
    `Mô tả: ${input.description.trim() || 'Không được cung cấp'}`,
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
        'Bạn là trợ lý AI chuyên phân tích và phân loại sự cố môi trường của hệ thống EcoAlert.',
        'Phân tích trực tiếp dựa trên ảnh báo cáo (nếu có), tiêu đề và mô tả do người dân cung cấp.',
        'Không được suy đoán hoặc bịa ra vật thể, tình trạng hay bằng chứng không xuất hiện trong ảnh hoặc mô tả. Không tiết lộ quá trình suy luận nội bộ.',
        `Chỉ sử dụng chính xác một category chuẩn từ danh sách sau: ${Object.values(AlertCategory).join(', ')}, hoặc ${UNCLASSIFIED_CATEGORY} khi bằng chứng không đủ hoặc không phù hợp.`,
        `Chỉ sử dụng chính xác một severity từ danh sách sau: ${Object.values(Severity).join(', ')}.`,
        'Giữ nguyên chính xác các tên trường kỹ thuật trong JSON theo schema được cung cấp; không dịch tên trường, category hoặc severity. Các giá trị confidence phải nằm trong khoảng từ 0 đến 1 và phản ánh đúng mức độ chắc chắn của bằng chứng.',
        'overallSummary phải hoàn toàn bằng tiếng Việt, gồm 2 đến 4 câu ngắn gọn, tự nhiên, rõ ràng cho người dùng tại Việt Nam; mô tả sự cố, giải thích mức độ nghiêm trọng và chỉ đưa ra nhận xét hoặc khuyến nghị khi có đủ bằng chứng.',
        'shortReason phải hoàn toàn bằng tiếng Việt, ngắn gọn và nêu bằng chứng chính dẫn đến kết quả phân loại. Không sử dụng tiếng Anh trong phần giải thích cho người dùng, trừ tên kỹ thuật hoặc object class khi thực sự cần thiết.',
        'AI chỉ đóng vai trò hỗ trợ ra quyết định. AI không có quyền tự xác minh báo cáo, phân công nhân viên xử lý, giải quyết hoặc đóng sự cố.',
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
    throw new OpenRouterResponseError('OpenRouter không trả về nội dung phân tích.');
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
      'Không thể xác thực với dịch vụ OpenRouter.',
      status,
      code,
    );
  }
  return new OpenRouterProviderError(
    'Yêu cầu phân tích tới OpenRouter không thành công.',
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
  const includeImage = isUsableImageUrl(input.imageUrl);

  try {
    const result = await request(includeImage);
    return {
      ...result.analysis,
      analysisMode: includeImage ? 'IMAGE_AND_TEXT' : 'TEXT_ONLY',
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
          analysisMode: 'TEXT_ONLY',
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
  // Model quan sát trực tiếp ảnh và nội dung báo cáo, sau đó trả JSON theo schema sự cố.
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
