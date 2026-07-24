import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { auditLogService } from '../services/audit-log.service';
import { successResponse, paginatedResponse } from '@ecoalert/shared';

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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const role = req.query.role as string;
    const search = req.query.search as string;
    const { items, total } = await userService.getUsers(page, limit, role, search);
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
    await userService.softDelete(currentUserId, req.params.id);
    await auditLogService.log({
      user: 'Admin',
      userId: currentUserId,
      action: 'USER_DELETED',
      resource: `User ID: ${req.params.id}`,
      details: 'Soft deleted user account',
    });
    res.status(200).json(successResponse(null, 'User deleted'));
  }

  async getAuditLogs(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const result = await auditLogService.getLogs(page, limit, search);
    res.status(200).json(paginatedResponse(result.items, result.total, page, limit));
  }
}


export const userController = new UserController();
