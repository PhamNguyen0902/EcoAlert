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

export type WasteScale = 'VERY_SMALL' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'VERY_LARGE';

export interface VisualMassEstimate {
  available: boolean;
  minKg: number | null;
  maxKg: number | null;
  mostLikelyKg: number | null;
  confidence: number | null;
  scale: WasteScale | null;
  reasoningSummary: string | null;
  limitations: string[];
}

export interface VisionDetectionClassSummary {
  materialClass: string;
  count: number;
  averageConfidence: number;
}

export interface VisionDetectionSummary {
  objectCount: number;
  dominantClass?: string;
  averageConfidence?: number;
  classes?: VisionDetectionClassSummary[];
}

// Kết quả phân tích sự cố môi trường do AI đưa ra.
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
  massEstimate: VisualMassEstimate;
}

const rawMassEstimateSchema = z.object({
  available: z.boolean(),
  minKg: z.number().min(0).nullable(),
  maxKg: z.number().min(0).nullable(),
  mostLikelyKg: z.number().min(0).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  scale: z.enum(['VERY_SMALL', 'SMALL', 'MEDIUM', 'LARGE', 'VERY_LARGE']).nullable(),
  reasoningSummary: z.string().trim().min(1).max(600).nullable(),
  limitations: z.array(z.string().trim().min(1).max(250)).max(5),
}).strict();

// Backward-compatible parsing: các message cũ có thể chưa chứa massEstimate.
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
  massEstimate: rawMassEstimateSchema.optional(),
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
  /** All report images. imageUrl is retained for backwards compatibility. */
  imageUrls?: string[];
  visionSummary?: VisionDetectionSummary;
  reportVisionSummary?: string;
}

type OpenRouterClientOptions = ConstructorParameters<typeof OpenAI>[0];

// Kết quả trả về từ OpenRouter, bao gồm phản hồi, mô hình được cấu hình, mô hình thực tế và độ trễ
export interface OpenAiCompletionResponse {
  choices: Array<{ message: { content: string | null } }>;
  model?: string;
  usage?: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    total_tokens?: number | null;
  };
}
 // Giao diện cho client SDK OpenAI, bao gồm phương thức tạo hoàn thành chat
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
 // Lỗi xảy ra khi OpenRouter trả về phản hồi không hợp lệ hoặc không thể phân tích được
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

 // Tạo client OpenRouter với cấu hình và factory được cung cấp
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

// Lấy mô hình được cấu hình cho một tác vụ AI cụ thể, dựa trên cấu hình OpenRouter
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

const unavailableMassEstimate = (reason: string): VisualMassEstimate => ({
  available: false,
  minKg: null,
  maxKg: null,
  mostLikelyKg: null,
  confidence: null,
  scale: null,
  reasoningSummary: reason,
  limitations: ['Phân tích đang chạy ở chế độ TEXT_ONLY.'],
});

const normalizeMassEstimate = (
  raw: z.infer<typeof rawMassEstimateSchema> | undefined,
  allowVisualMassEstimate: boolean,
): VisualMassEstimate => {
  if (!allowVisualMassEstimate) {
    return unavailableMassEstimate('Không có dữ liệu hình ảnh để ước tính khối lượng.');
  }

  if (!raw) {
    return unavailableMassEstimate('Mô hình chưa trả về kết quả ước tính khối lượng.');
  }

  if (!raw.available) {
    return {
      ...raw,
      minKg: null,
      maxKg: null,
      mostLikelyKg: null,
      confidence: raw.confidence ?? null,
      scale: raw.scale ?? null,
      reasoningSummary: raw.reasoningSummary ?? 'Ảnh chưa đủ bằng chứng để ước tính khối lượng đáng tin cậy.',
    };
  }

  const { minKg, maxKg, mostLikelyKg, confidence } = raw;
  const invalidRange =
    minKg === null ||
    maxKg === null ||
    mostLikelyKg === null ||
    confidence === null ||
    maxKg < minKg ||
    mostLikelyKg < minKg ||
    mostLikelyKg > maxKg;

  if (invalidRange) {
    return unavailableMassEstimate('Kết quả ước tính khối lượng không đủ nhất quán để hiển thị.');
  }

  return raw;
};

export const parseIncidentAnalysis = (
  content: string,
  allowVisualMassEstimate = true,
): IncidentAnalysis => {
  let parsed: unknown;
  try {
    const cleanContent = content.replace(/^```(?:json)?\n?/, '').replace(/```$/, '').trim();
    parsed = JSON.parse(cleanContent);
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
    massEstimate: normalizeMassEstimate(raw.massEstimate, allowVisualMassEstimate),
  };
};
 // Sau khi phân tích ảnh xong thì AI sẽ phân tích mức độ nghiêm trọng và đánh giá tổng quan cho người dùng từ 0 đến 100%
const severityScoreFor = (severity: Severity): number => ({
  [Severity.LOW]: 20,
  [Severity.MEDIUM]: 45,
  [Severity.HIGH]: 70,
  [Severity.CRITICAL]: 90,
}[severity]);
  
// Định dạng phản hồi JSON Schema mà AI trả về cho việc phân tích sự cố môi trường
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
        'massEstimate',
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
        massEstimate: {
          type: 'object',
          additionalProperties: false,
          required: [
            'available',
            'minKg',
            'maxKg',
            'mostLikelyKg',
            'confidence',
            'scale',
            'reasoningSummary',
            'limitations',
          ],
          properties: {
            available: { type: 'boolean' },
            minKg: { type: ['number', 'null'], minimum: 0 },
            maxKg: { type: ['number', 'null'], minimum: 0 },
            mostLikelyKg: { type: ['number', 'null'], minimum: 0 },
            confidence: { type: ['number', 'null'], minimum: 0, maximum: 1 },
            scale: {
              type: ['string', 'null'],
              enum: ['VERY_SMALL', 'SMALL', 'MEDIUM', 'LARGE', 'VERY_LARGE', null],
            },
            reasoningSummary: { type: ['string', 'null'], maxLength: 600 },
            limitations: {
              type: 'array',
              maxItems: 5,
              items: { type: 'string', minLength: 1, maxLength: 250 },
            },
          },
        },
      },
    },
  },
};

const buildVisionSummaryText = (summary?: VisionDetectionSummary): string => {
  if (!summary) return '';

  const lines = [
    '',
    'Kết quả YOLO hỗ trợ (chỉ là tín hiệu bổ sung, không phải số đo khối lượng):',
    `- Tổng vùng phát hiện: ${Math.max(0, Math.round(summary.objectCount))}`,
  ];

  if (summary.dominantClass?.trim()) {
    lines.push(`- Nhóm vật thể chủ đạo: ${summary.dominantClass.trim()}`);
  }

  if (typeof summary.averageConfidence === 'number' && Number.isFinite(summary.averageConfidence)) {
    lines.push(`- Confidence YOLO trung bình: ${Math.max(0, Math.min(1, summary.averageConfidence)).toFixed(3)}`);
  }

  for (const item of summary.classes?.slice(0, 12) ?? []) {
    lines.push(
      `- ${item.materialClass}: ${Math.max(0, Math.round(item.count))} vùng, confidence TB ${Math.max(0, Math.min(1, item.averageConfidence)).toFixed(3)}`,
    );
  }

  return lines.join('\n');
};

const buildUserContent = (input: IncidentAnalysisInput, includeImage: boolean) => {
  const text = [
    'Bạn đang phân tích MỘT báo cáo sự cố môi trường. Các ảnh là nhiều góc nhìn của CÙNG MỘT hiện trường; không coi mỗi ảnh là một đống rác độc lập và không cộng khối lượng giữa ảnh.',
    `Tiêu đề: ${input.title?.trim() || 'Không được cung cấp'}`,
    `Mô tả: ${input.description.trim() || 'Không được cung cấp'}`,
    input.reportVisionSummary,
    buildVisionSummaryText(input.visionSummary),
  ].filter(Boolean).join('\n');

  const imageUrls = Array.from(new Set([...(input.imageUrls ?? []), input.imageUrl].filter(isUsableImageUrl))).slice(0, 6);
  if (!includeImage || imageUrls.length === 0) return text;
  return [
    { type: 'text', text },
    ...imageUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
  ];
};

// Sau khi phân tích ảnh xong thì AI sẽ phân tích mức độ nghiêm trọng và đánh giá tổng quan cho người dùng
const incidentCompletionRequest = (
  input: IncidentAnalysisInput,
  includeImage: boolean,
): Record<string, unknown> => ({
  messages: [
    {
      role: 'system',
      content: [
        'Bạn là trợ lý AI chuyên phân tích sự cố môi trường và ước tính quy mô chất thải cho hệ thống EcoAlert.',
        'Ảnh chụp camera/điện thoại thông thường là ảnh 2D hợp lệ và phải được phân tích khi nội dung liên quan đến sự cố môi trường.',
        'Không phân tích ảnh hoạt hình, ảnh render, ảnh không liên quan hoặc ảnh không đủ bằng chứng thực địa.',
        'Phân tích toàn cảnh ảnh gốc; không suy luận quy mô chỉ từ một vật thể bị phóng to hoặc một bounding box riêng lẻ.',
        'Kết quả YOLO nếu được cung cấp chỉ là tín hiệu hỗ trợ về loại và số vùng phát hiện. Không được tính khối lượng bằng công thức số object nhân với một trọng lượng cố định.',
        'YOLO của EcoAlert chỉ là model chuyên nhận diện rác/chất thải. Nếu sự cố không thuộc nhóm rác/chất thải, không được suy diễn YOLO, không được đưa ra khối lượng chất thải và massEstimate.available phải là false.',
        'Các ảnh của một báo cáo là nhiều góc nhìn của cùng một sự cố. Dùng chúng để tăng bằng chứng về quy mô và độ tin cậy, tuyệt đối không cộng số vật thể hoặc khối lượng giữa các ảnh.',
        'Khi ước tính khối lượng, hãy xem xét toàn cảnh: kích thước tương đối của đống rác, số bao/túi nhìn thấy, mức độ đầy, vật thể tham chiếu, độ chồng lấp, phần bị che khuất, mật độ chất thải, loại vật liệu và phối cảnh.',
        'Luôn ưu tiên trả về một khoảng minKg-maxKg thay vì một con số tuyệt đối. mostLikelyKg phải nằm trong khoảng này.',
        'massEstimate.confidence là độ tin cậy riêng của ước tính khối lượng, không được sao chép categoryConfidence, incidentConfidence, severityConfidence hoặc confidence YOLO.',
        'Không được đặt massEstimate.available=false chỉ vì ảnh là 2D, không có cảm biến chiều sâu, không có cân thực tế hoặc không biết kích thước tuyệt đối. Đây là chức năng ước tính trực quan; hãy đưa range với confidence phù hợp khi ảnh có đủ vật thể tham chiếu và dấu hiệu hiện trường.',
        'Nếu ảnh không đủ thông tin thị giác để ước tính hợp lý, massEstimate.available phải là false và minKg, maxKg, mostLikelyKg phải là null.',
        'Nếu không có ảnh và chỉ có văn bản, massEstimate.available phải là false.',
        'massEstimate.reasoningSummary phải là mô tả ngắn bằng tiếng Việt về căn cứ quan sát được; không tiết lộ chuỗi suy luận nội bộ.',
        'massEstimate.limitations phải nêu tối đa 5 hạn chế quan trọng như che khuất, thiếu vật tham chiếu, góc chụp hoặc không biết độ sâu tuyệt đối.',
        'Đánh giá mức độ nghiêm trọng dựa trên phạm vi ảnh hưởng, quy mô/tích tụ chất thải, dấu hiệu nguy hại, vật tư y tế hoặc nguy cơ môi trường nhìn thấy được.',
        'Phân tích trực tiếp dựa trên ảnh báo cáo, tiêu đề, mô tả và tín hiệu YOLO nếu có.',
        'Không được bịa ra vật thể, tình trạng hay bằng chứng không xuất hiện trong ảnh hoặc mô tả. Không tiết lộ quá trình suy luận nội bộ.',
        `Chỉ sử dụng chính xác một category chuẩn từ danh sách sau: ${Object.values(AlertCategory).join(', ')}, hoặc ${UNCLASSIFIED_CATEGORY} khi bằng chứng không đủ hoặc không phù hợp.`,
        `Chỉ sử dụng chính xác một severity từ danh sách sau: ${Object.values(Severity).join(', ')}.`,
        'Giữ nguyên chính xác các tên trường kỹ thuật trong JSON theo schema được cung cấp; không dịch tên trường, category hoặc severity. Các giá trị confidence phải nằm trong khoảng từ 0 đến 1.',
        'overallSummary phải hoàn toàn bằng tiếng Việt, gồm 3 đến 5 câu ngắn gọn, tự nhiên và rõ ràng; mô tả sự cố, giải thích mức độ nghiêm trọng và chỉ đưa ra nhận xét hoặc khuyến nghị khi có đủ bằng chứng.',
        'shortReason phải hoàn toàn bằng tiếng Việt, ngắn gọn và nêu bằng chứng chính dẫn đến kết quả phân loại.',
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
  includeImage: boolean,
): IncidentAnalysis => {
  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new OpenRouterResponseError('OpenRouter không trả về nội dung phân tích.');
  }
  return parseIncidentAnalysis(content, includeImage);
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
  return analysisFromCompletion(response, includeImage);
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
  const includeImage = [...(input.imageUrls ?? []), input.imageUrl].some(isUsableImageUrl);

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
  logger.info('Vision mass estimation request', {
    imageCount: Array.from(new Set([...(input.imageUrls ?? []), input.imageUrl].filter(isUsableImageUrl))).length,
    objectCount: input.visionSummary?.objectCount,
    dominantClass: input.visionSummary?.dominantClass,
  });

  const result = await analyzeIncident(
    async (includeImage) => {
      const generation = await provider.generate(
        AiTask.INCIDENT_ANALYSIS,
        incidentCompletionRequest(input, includeImage),
      );
      return {
        analysis: analysisFromCompletion(generation.response, includeImage),
        model: generation.model,
        latencyMs: generation.latencyMs,
      };
    },
    input,
    configuredModel,
  );

  logger.info('Vision mass estimation result', {
    available: result.massEstimate.available,
    minKg: result.massEstimate.minKg,
    maxKg: result.massEstimate.maxKg,
    mostLikelyKg: result.massEstimate.mostLikelyKg,
    confidence: result.massEstimate.confidence,
    analysisMode: result.analysisMode,
  });

  return result;
};
