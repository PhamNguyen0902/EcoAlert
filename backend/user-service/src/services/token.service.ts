import { refreshTokenRepository } from '../repositories/refresh-token.repository';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.util';
import { IUserPayload } from '@ecoalert/shared';
import { envConfig } from '../config/env.config';
import { redisClient } from '../config/redis.config';
import ms from 'ms';

export class TokenService {
  async generateAuthTokens(userPayload: IUserPayload) {
    const accessToken = generateAccessToken(userPayload);
    const refreshToken = generateRefreshToken();

    const expiresInMs = ms(envConfig.refreshTokenExpiresIn);
    const expiresAt = new Date(Date.now() + expiresInMs);

    await refreshTokenRepository.create({
      token: refreshToken,
      userId: userPayload.userId,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  async blacklistToken(token: string): Promise<void> {
    const ttl = ms(envConfig.jwtExpiresIn) / 1000;
    await redisClient.setex(`blacklist:${token}`, ttl, 'true');
  }

  async verifyRefreshToken(token: string) {
    const doc = await refreshTokenRepository.findByToken(token);
    if (!doc) return null;
    if (new Date() > doc.expiresAt) {
      await refreshTokenRepository.deleteByToken(token);
      return null;
    }
    return doc;
  }

  async deleteRefreshToken(token: string) {
    await refreshTokenRepository.deleteByToken(token);
  }
}

export const tokenService = new TokenService();
