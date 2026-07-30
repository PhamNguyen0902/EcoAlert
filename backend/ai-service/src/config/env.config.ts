import dotenv from 'dotenv';
dotenv.config();

export const envConfig = {
  port: parseInt(process.env.PORT || '3005', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  rabbitMqUrl: process.env.RABBITMQ_URL || 'amqp://localhost',
  geminiApiKey: process.env.GEMINI_API_KEY || 'YOUR_API_KEY',
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
  chatProvider: (process.env.AI_CHAT_PROVIDER || 'disabled').toLowerCase(),
  chatModel: process.env.AI_CHAT_MODEL || 'gpt-4o-mini',
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiBaseUrl: process.env.OPENAI_BASE_URL,
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  internalGatewaySecret: process.env.INTERNAL_GATEWAY_SHARED_SECRET,
};
