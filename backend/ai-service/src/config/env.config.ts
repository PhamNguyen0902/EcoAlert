import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const booleanValue = (value: string | undefined, fallback = false) =>
  value === undefined ? fallback : value.trim().toLowerCase() === 'true';

const threshold = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
};

export const envConfig = {
  port: parseInt(process.env.PORT || '3005', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  rabbitMqUrl: process.env.RABBITMQ_URL || 'amqp://localhost',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/ecoalert-ai-db',
  alertMongoUri:
    process.env.ALERT_MONGO_URI ||
    process.env.MONGO_URI_ALERT ||
    'mongodb://localhost:27017/ecoalert-alert-db',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  assistantRateLimit: parseInt(process.env.ASSISTANT_RATE_LIMIT || '20', 10),
  assistantRateWindowSeconds: parseInt(
    process.env.ASSISTANT_RATE_WINDOW_SECONDS || '60',
    10,
  ),
  internalGatewaySecret: process.env.INTERNAL_GATEWAY_SHARED_SECRET,
  visionAiEnabled: booleanValue(process.env.VISION_AI_ENABLED),
  visionSegmentationEnabled: booleanValue(process.env.VISION_SEGMENTATION_ENABLED),
  visionServiceUrl: process.env.VISION_SERVICE_URL || 'http://vision-service:3007',
  visionTimeoutMs: parseInt(process.env.VISION_TIMEOUT_MS || '45000', 10),
  mediaServiceUrl: process.env.MEDIA_SERVICE_URL || 'http://media-service:3003',
  imageValidationHighThreshold: threshold(process.env.AI_IMAGE_VALIDATION_HIGH_THRESHOLD, 0.8),
  imageValidationLowThreshold: threshold(process.env.AI_IMAGE_VALIDATION_LOW_THRESHOLD, 0.5),
};
