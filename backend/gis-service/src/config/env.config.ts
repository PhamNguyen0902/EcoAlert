import dotenv from 'dotenv';
import { resolve } from 'node:path';
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
  osrmBaseUrl: environmentValue('OSRM_BASE_URL', 'http://osrm:5000').replace(/\/+$/, ''),
  osrmRoutingProfile: environmentValue('OSRM_ROUTING_PROFILE', 'driving'),
  osrmDataRoot: environmentValue('OSRM_DATA_ROOT', resolve(__dirname, '../../../../data/osrm/hcm')),
  osrmTimeoutMs: Math.trunc(Math.min(30_000, Math.max(100,
    Number(environmentValue('OSRM_TIMEOUT_MS', '10000')) || 10_000))),
};
