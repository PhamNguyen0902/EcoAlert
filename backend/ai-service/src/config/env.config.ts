import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const threshold = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
};

export const envConfig = {
  port: parseInt(process.env.PORT || '3005', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  rabbitMqUrl: process.env.RABBITMQ_URL || 'amqp://localhost',
  imageValidationHighThreshold: threshold(process.env.AI_IMAGE_VALIDATION_HIGH_THRESHOLD, 0.8),
  imageValidationLowThreshold: threshold(process.env.AI_IMAGE_VALIDATION_LOW_THRESHOLD, 0.5),
  aiCategorySuggestionThreshold: threshold(process.env.AI_CATEGORY_SUGGESTION_THRESHOLD, 0.8),
  aiCategoryUnclassifiedThreshold: threshold(process.env.AI_CATEGORY_UNCLASSIFIED_THRESHOLD, 0.5),
};
