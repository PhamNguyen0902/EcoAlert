import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { auditLogService } from '../services/audit-log.service';
import { ForbiddenError, UserRole, successResponse, paginatedResponse } from '@ecoalert/shared';

export class UserController {
  async getMe(req: Request, res: Response) {
    const userId = req.headers['x-user-id'] as string;
    const user = await userService.getProfile(userId);
    res.status(200).json(successResponse(user));
  }

  async updateProfile(req: Request, res: Response) {
    const userId = req.headers['x-user-id'] as string;
    const user = await userService.updateProfile(userId, req.body);
    res.status(200).json(successResponse(user, 'Profile updated'));
  }

  async changePassword(req: Request, res: Response) {
    const userId = req.headers['x-user-id'] as string;
    await userService.changePassword(userId, req.body);
    res.status(200).json(successResponse(null, 'Password changed'));
  }

  async listUsers(req: Request, res: Response) {
    const rawPage = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
    const rawLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 10;
    const page = Math.max(1, Number.isFinite(rawPage) ? rawPage : 1);
    const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 10));
    const role = typeof req.query.role === 'string' ? req.query.role : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const isDeleted = typeof req.query.isDeleted === 'string' ? req.query.isDeleted : undefined;
    const { items, total } = await userService.getUsers(page, limit, role, search, isDeleted);
    res.status(200).json(paginatedResponse(items, total, page, limit));
  }

  async createUser(req: Request, res: Response) {
    const user = await userService.createUser(req.body);
    await auditLogService.log({
      user: 'Admin',
      action: 'USER_CREATED',
      resource: `User: ${user.email}`,
      details: `Created new ${user.role} user account`,
    });
    res.status(201).json(successResponse(user, 'User created successfully'));
  }

  async getUserById(req: Request, res: Response) {
    const currentUserId = req.headers['x-user-id'] as string;
    const currentUserRole = ((req.headers['x-user-role'] as string) || '').toUpperCase();
    if (currentUserRole !== UserRole.ADMIN && req.params.id !== currentUserId) {
      throw new ForbiddenError('Insufficient permissions');
    }
    const user = await userService.getProfile(req.params.id);
    res.status(200).json(successResponse(user));
  }

  async changeRole(req: Request, res: Response) {
    const currentUserId = req.headers['x-user-id'] as string;
    const user = await userService.changeRole(currentUserId, req.params.id, req.body.role);
    await auditLogService.log({
      user: 'Admin',
      userId: currentUserId,
      action: 'ROLE_CHANGED',
      resource: `User: ${user?.email}`,
      details: `Changed role to ${user?.role}`,
    });
    res.status(200).json(successResponse(user, 'Role updated'));
  }

  async toggleStatus(req: Request, res: Response) {
    const currentUserId = req.headers['x-user-id'] as string;
    const user = await userService.toggleStatus(currentUserId, req.params.id, req.body.isActive);
    await auditLogService.log({
      user: 'Admin',
      userId: currentUserId,
      action: 'STATUS_TOGGLED',
      resource: `User: ${user?.email}`,
      details: `Set status to ${user?.isActive ? 'Active' : 'Inactive'}`,
    });
    res.status(200).json(successResponse(user, 'Status updated'));
  }

  async deleteUser(req: Request, res: Response) {
    const currentUserId = req.headers['x-user-id'] as string;
    const deletedUser = await userService.deleteUser(currentUserId, req.params.id);
    await auditLogService.log({
      user: 'Admin',
      userId: currentUserId,
      action: 'USER_DELETED',
      resource: `User: ${deletedUser?.email || req.params.id}`,
      details: 'Permanently deleted user account from DB',
    });
    res.status(200).json(successResponse(null, 'User permanently deleted'));
  }

}


export const userController = new UserController();
