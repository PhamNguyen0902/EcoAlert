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
  reason: 'Automatic image validation is temporarily unavailable. Your report can still be reviewed manually.',
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
  try { parsedUrl = new URL(imageUrl); } catch { throw new OpenRouterResponseError('A valid image URL is required.'); }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new OpenRouterResponseError('A valid image URL is required.');
  try {
    const provider = getOpenRouterProvider();
    const generation = await provider.generate(AiTask.IMAGE_VALIDATION, {
      messages: [
        { role: 'system', content: [
          'You validate an image before an EcoAlert environmental incident report is submitted.',
          'Decide only whether it plausibly shows an environmental or urban incident, is clearly unrelated, or is unclear.',
          `Only suggest a category if visually defensible and one of: ${AI_SUPPORTED_CATEGORIES.join(', ')}.`,
          'A selfie, food, pet, document, meme, screenshot, or ordinary indoor image is clearly unrelated unless it visibly documents an environmental incident.',
          'If evidence is weak or outside this visual scope, return null category and isEnvironmentalIncident null.',
          'Give a concise user-facing reason. Do not reveal hidden reasoning.',
        ].join(' ') },
        { role: 'user', content: [{ type: 'text', text: 'Validate this incident image.' }, { type: 'image_url', image_url: { url: imageUrl } }] },
      ],
      temperature: 0.1,
      response_format: responseFormat,
    });
    const content = generation.response.choices[0]?.message.content;
    if (!content) throw new OpenRouterResponseError('Image validation returned no result.');
    const result = responseSchema.parse(JSON.parse(content));
    return deriveImageValidation(result, generation.model);
  } catch {
    return unavailable();
  }
};

export const imageValidationUnavailable = unavailable;
