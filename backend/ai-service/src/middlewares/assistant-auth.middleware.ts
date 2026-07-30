import { NextFunction, Request, Response } from 'express';
import { errorResponse } from '@ecoalert/shared';
import { envConfig } from '../config/env.config';
import { AssistantRole, AuthorizedActor } from '../assistant/types';

const VALID_ROLES: AssistantRole[] = ['CITIZEN', 'OFFICER', 'ADMIN'];

const readHeader = (value: string | string[] | undefined): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export const requireAssistantAuth = (req: Request, res: Response, next: NextFunction) => {
  const configuredSecret = envConfig.internalGatewaySecret;
  const providedSecret = readHeader(req.headers['x-internal-gateway-secret']);
  if (configuredSecret && providedSecret !== configuredSecret) {
    return res.status(401).json(errorResponse('Unauthorized internal request'));
  }
  if (envConfig.nodeEnv === 'production' && !configuredSecret) {
    return res.status(503).json(errorResponse('Assistant gateway trust is not configured'));
  }

  const userId = readHeader(req.headers['x-user-id']);
  const role = readHeader(req.headers['x-user-role'])?.toUpperCase() as AssistantRole | undefined;
  if (!userId || !role || !VALID_ROLES.includes(role)) {
    return res.status(401).json(errorResponse('Authenticated user context is required'));
  }

  res.locals.actor = {
    userId,
    role,
    requestId: readHeader(req.headers['x-request-id']),
  } satisfies AuthorizedActor;
  next();
};
