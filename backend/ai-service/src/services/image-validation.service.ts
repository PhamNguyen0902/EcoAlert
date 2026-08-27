import { AlertCategory } from '@ecoalert/shared';
import { z } from 'zod';
import { envConfig } from '../config/env.config';
import { AiTask } from './ai-task-router';
import { getOpenRouterProvider, OpenRouterResponseError } from './openrouter.service';

const AI_SUPPORTED_CATEGORIES = Object.values(AlertCategory);

export type ImageValidationDecision = 'VALID' | 'UNCERTAIN' | 'INVALID' | 'UNAVAILABLE';
export interface ImageValidationResult {
  decision: ImageValidationDecision;
  isEnvironmentalIncident: boolean | null;
  confidence: number | null;
  suggestedCategory: AlertCategory | null;
  reason: string;
  model: string | null;
  validatedAt: string;
}

const responseSchema = z.object({
  isEnvironmentalIncident: z.boolean().nullable(),
  confidence: z.number().min(0).max(1),
  suggestedCategory: z.nativeEnum(AlertCategory).nullable(),
  reason: z.string().trim().min(1).max(500),
}).strict();

const responseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'ecoalert_image_validation', strict: true,
    schema: {
      type: 'object', additionalProperties: false,
      required: ['isEnvironmentalIncident', 'confidence', 'suggestedCategory', 'reason'],
      properties: {
        isEnvironmentalIncident: { type: ['boolean', 'null'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        suggestedCategory: { type: ['string', 'null'], enum: [...Object.values(AlertCategory), null] },
        reason: { type: 'string', minLength: 1, maxLength: 500 },
      },
    },
  },
};

const unavailable = (): ImageValidationResult => ({
  decision: 'UNAVAILABLE', isEnvironmentalIncident: null, confidence: null, suggestedCategory: null,
  reason: 'Tính năng kiểm tra ảnh tự động tạm thời không khả dụng. Báo cáo vẫn có thể được kiểm tra thủ công.',
  model: null, validatedAt: new Date().toISOString(),
});

export const deriveImageValidation = (
  result: z.infer<typeof responseSchema>,
  model: string,
): ImageValidationResult => {
  const isSupported = result.suggestedCategory !== null && AI_SUPPORTED_CATEGORIES.includes(result.suggestedCategory);
  const suggestedCategory = result.confidence >= envConfig.imageValidationLowThreshold && isSupported
    ? result.suggestedCategory : null;
  const decision: ImageValidationDecision = result.isEnvironmentalIncident === false && result.confidence >= envConfig.imageValidationHighThreshold
    ? 'INVALID'
    : result.isEnvironmentalIncident === true && result.confidence >= envConfig.imageValidationHighThreshold
      ? 'VALID'
      : 'UNCERTAIN';
  return { decision, isEnvironmentalIncident: decision === 'UNCERTAIN' ? null : result.isEnvironmentalIncident, confidence: result.confidence, suggestedCategory, reason: result.reason, model, validatedAt: new Date().toISOString() };
};

export const validateIncidentImage = async (imageUrl: string): Promise<ImageValidationResult> => {
  let parsedUrl: URL;
  try { parsedUrl = new URL(imageUrl); } catch { throw new OpenRouterResponseError('Cần cung cấp đường dẫn ảnh hợp lệ.'); }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new OpenRouterResponseError('Cần cung cấp đường dẫn ảnh hợp lệ.');
  try {
    const provider = getOpenRouterProvider();
    const generation = await provider.generate(AiTask.IMAGE_VALIDATION, {
      messages: [
        { role: 'system', content: [
          'Bạn kiểm tra ảnh trước khi người dùng gửi báo cáo sự cố môi trường trên EcoAlert.',
          'Chỉ đánh giá liệu ảnh có khả năng thể hiện một sự cố môi trường hoặc đô thị, rõ ràng không liên quan, hoặc chưa đủ rõ để kết luận.',
          `Chỉ đề xuất danh mục khi có thể bảo vệ bằng bằng chứng trực quan và danh mục đó thuộc một trong các giá trị sau: ${AI_SUPPORTED_CATEGORIES.join(', ')}.`,
          'Ảnh chân dung, đồ ăn, thú cưng, tài liệu, ảnh chế, ảnh chụp màn hình hoặc ảnh trong nhà thông thường là không liên quan, trừ khi chúng hiển thị rõ một sự cố môi trường.',
          'Nếu bằng chứng yếu hoặc nằm ngoài phạm vi nhận diện trực quan này, hãy trả về category là null và isEnvironmentalIncident là null.',
          'reason phải là lời giải thích ngắn gọn, tự nhiên bằng tiếng Việt dành cho người dùng. Không tiết lộ quá trình suy luận nội bộ.',
        ].join(' ') },
        { role: 'user', content: [{ type: 'text', text: 'Hãy kiểm tra ảnh báo cáo sự cố này.' }, { type: 'image_url', image_url: { url: imageUrl } }] },
      ],
      temperature: 0.1,
      response_format: responseFormat,
    });
    const content = generation.response.choices[0]?.message.content;
    if (!content) throw new OpenRouterResponseError('Hệ thống kiểm tra ảnh không trả về kết quả.');
    const result = responseSchema.parse(JSON.parse(content));
    return deriveImageValidation(result, generation.model);
  } catch {
    return unavailable();
  }
};

export const imageValidationUnavailable = unavailable;
