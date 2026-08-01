import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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
};
