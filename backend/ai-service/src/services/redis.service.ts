import Redis from 'ioredis';
import { createLogger } from '@ecoalert/shared';
import { envConfig } from '../config/env.config';

const logger = createLogger('ai-service');

class AssistantRedisService {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(envConfig.redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    this.client.on('error', () => logger.warn('Assistant Redis operation failed'));
  }

  private async ensureConnection(): Promise<void> {
    if (this.client.status === 'wait') await this.client.connect();
  }

  async consumeRateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
    try {
      await this.ensureConnection();
      const count = await this.client.incr(key);
      if (count === 1) await this.client.expire(key, windowSeconds);
      return count <= max;
    } catch {
      // Failing closed prevents a Redis outage from silently disabling this
      // user-scoped abuse control.
      return false;
    }
  }

  async getJson<T>(key: string): Promise<T | undefined> {
    try {
      await this.ensureConnection();
      const value = await this.client.get(key);
      return value ? (JSON.parse(value) as T) : undefined;
    } catch {
      return undefined;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.ensureConnection();
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Cached assistant context is an optimisation; requests remain safe without it.
    }
  }
}

export const assistantRedis = new AssistantRedisService();
