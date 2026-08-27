import dotenv from 'dotenv';
dotenv.config();

const environmentValue = (name: string, fallback = ''): string =>
  process.env[name]?.trim() || fallback;

export const envConfig = {
  port: parseInt(environmentValue('PORT', '3004'), 10),
  nodeEnv: environmentValue('NODE_ENV', 'development'),
  mongoUri: environmentValue(
    'MONGO_URI',
    'mongodb://localhost:27017/ecoalert-gis-db',
  ),
  rabbitMqUrl: environmentValue('RABBITMQ_URL', 'amqp://localhost'),
};
