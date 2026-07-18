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
    const userRole = req.headers['x-user-role'] as UserRole;
    if (!userRole || !roles.includes(userRole)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
};
