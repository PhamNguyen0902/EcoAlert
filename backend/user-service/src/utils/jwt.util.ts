import jwt from 'jsonwebtoken';
import { IUserPayload } from '@ecoalert/shared';
import { envConfig } from '../config/env.config';
import crypto from 'crypto';

export const generateAccessToken = (payload: IUserPayload): string => {
  return jwt.sign(payload, envConfig.jwtSecret, { expiresIn: envConfig.jwtExpiresIn });
};

export const generateRefreshToken = (): string => {
  return crypto.randomUUID();
};
