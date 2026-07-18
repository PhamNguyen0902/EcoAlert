import Redis from 'ioredis';
import { envConfig } from './env.config';
import { createLogger } from '@ecoalert/shared';

const logger = createLogger('user-service');

export const redisClient = new Redis(envConfig.redisUrl);

redisClient.on('connect', () => logger.info('Connected to Redis'));
redisClient.on('error', (err) => logger.error('Redis error:', err));
