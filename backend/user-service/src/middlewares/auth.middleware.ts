import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError, UserRole } from '@ecoalert/shared';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return next(new UnauthorizedError('Authentication required'));
  }
  next();
};

export const requireRoles = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const rawRole = ((req.headers['x-user-role'] as string) || '').toUpperCase();
    const allowedRoles = roles.map(r => r.toUpperCase());
    if (!rawRole || !allowedRoles.includes(rawRole)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
};
