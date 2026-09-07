import { AlertCategory } from '@ecoalert/shared';
import { z } from 'zod';
import { envConfig } from '../config/env.config';
import { AiTask } from './ai-task-router';
import { getOpenRouterProvider, OpenRouterResponseError } from './openrouter.service';

const AI_SUPPORTED_CATEGORIES = Object.values(AlertCategory);
 // Kết quả kiểm tra ảnh do AI đưa ra, bao gồm quyết định, độ tin cậy, danh mục đề xuất và lý do
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
 // Định dạng phản hồi JSON Schema mà AI trả về cho việc kiểm tra ảnh
const responseSchema = z.object({
  isEnvironmentalIncident: z.boolean().nullable(),
  confidence: z.number().min(0).max(1),
  suggestedCategory: z.nativeEnum(AlertCategory).nullable(),
  reason: z.string().trim().min(1).max(500),
}).strict();
 // Định dạng phản hồi JSON Schema mà AI trả về cho việc kiểm tra ảnh
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
 // Trả về kết quả kiểm tra ảnh không khả dụng khi có lỗi xảy ra hoặc không thể phân tích ảnh
const unavailable = (): ImageValidationResult => ({
  decision: 'UNAVAILABLE', isEnvironmentalIncident: null, confidence: null, suggestedCategory: null,
  reason: 'Tính năng kiểm tra ảnh tự động tạm thời không khả dụng. Báo cáo vẫn có thể được kiểm tra thủ công.',
  model: null, validatedAt: new Date().toISOString(),
});

 // Chuyển đổi kết quả kiểm tra ảnh từ AI sang định dạng ImageValidationResult
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

 // AI xử lý hình ảnh trước khi người dùng gửi báo cáo. Kiểm tra ảnh và chọn danh mục cảnh báo nếu có thể. Nếu không thể xác định, trả về null và lý do.
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
            'Không phân tích ảnh hoạt họa, 2D, 3D, ảnh sử dụng AI, ảnh chụp màn hình, ảnh chế, ảnh trong nhà thông thường, ảnh đồ ăn, ảnh thú cưng, ảnh tài liệu hoặc ảnh chân dung.',

            'Rác thải đổ trộm nếu như thấy rác ở gần trụ điện, lề đường, bờ sông, bãi đất trống, bãi đất nông nghiệp, bãi đất công cộng hoặc bãi đất hoang. Không đánh giá rác thải trong nhà, rác thải sinh hoạt thông thường hoặc rác thải trong thùng rác.',
            'Ô nhiễm nước nếu như thấy nước bị đổi màu, nổi váng, nổi bọt, nổi rác thải hoặc có mùi hôi. Không đánh giá nước trong nhà, nước uống, nước sinh hoạt thông thường hoặc nước trong bể bơi.',
            'Ô nhiễm không khí: chỉ chọn khi ảnh cho thấy khói, bụi hoặc khí thải bất thường lan rộng nhưng không có bằng chứng trực quan rõ ràng của một đám cháy cụ thể. Nếu nhìn thấy nguồn cháy rõ ràng thì ưu tiên Hỏa hoạn hoặc Đốt rác trái phép tùy vật liệu đang cháy.',
            'Đốt rác trái phép: chỉ chọn khi ảnh cho thấy rõ một đống rác, túi rác, chai lọ, nhựa, giấy, phế thải hoặc vật liệu bỏ đi đang trực tiếp cháy hoặc âm ỉ bốc khói tại khu vực ngoài trời. Không được chọn danh mục này chỉ vì có lửa hoặc khói. Nếu không nhìn thấy rõ rác đang cháy thì không được suy đoán là đốt rác.',

            'Ngập lụt nếu như thấy nước ngập đường, nhà, đất hoặc các công trình khác. Không đánh giá nước trong nhà, nước trong bể bơi hoặc nước sinh hoạt thông thường.',
            'Cây đổ nếu thấy cây hoặc cành cây lớn bị ngã, chắn đường, đè lên công trình, phương tiện hoặc gây cản trở giao thông. Không đánh giá cây trong vườn, cây cảnh hoặc cây được trồng trong nhà.',
            'Chất thải xây dựng nếu như thấy vật liệu xây dựng, vật liệu xây dựng bị vứt bỏ trên đường phố, bãi đất trống hoặc bãi đất nông nghiệp. Không đánh giá vật liệu xây dựng trong nhà hoặc vật liệu xây dựng được xử lý đúng cách.',
            'Ô nhiễm tiếng ồn nếu như thấy tiếng ồn lớn, gây khó chịu cho người dân xung quanh. Không đánh giá tiếng ồn trong nhà, tiếng ồn từ thiết bị điện tử thông thường hoặc tiếng ồn từ phương tiện giao thông thông thường.',
            'Ô nhiễm đất nếu như thấy đất bị ô nhiễm bởi hóa chất, rác thải hoặc các chất độc hại. Không đánh giá đất trong nhà hoặc đất được xử lý đúng cách.',
            'Đe doạ động vật hoang dã nếu như thấy động vật bị đe dọa, bị thương hoặc bị bắt giữ trái phép. Không đánh giá động vật trong nhà hoặc động vật được chăm sóc đúng cách.',

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
