import { Request, Response } from 'express';
import { userService } from '../services/user.service';
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

  async getUserById(req: Request, res: Response) {
    const user = await userService.getProfile(req.params.id);
    res.status(200).json(successResponse(user));
  }

  async changeRole(req: Request, res: Response) {
    const currentUserId = req.headers['x-user-id'] as string;
    const user = await userService.changeRole(currentUserId, req.params.id, req.body.role);
    res.status(200).json(successResponse(user, 'Role updated'));
  }

  async toggleStatus(req: Request, res: Response) {
    const currentUserId = req.headers['x-user-id'] as string;
    const user = await userService.toggleStatus(currentUserId, req.params.id, req.body.isActive);
    res.status(200).json(successResponse(user, 'Status updated'));
  }

  async deleteUser(req: Request, res: Response) {
    const currentUserId = req.headers['x-user-id'] as string;
    await userService.softDelete(currentUserId, req.params.id);
    res.status(200).json(successResponse(null, 'User deleted'));
  }
}

export const userController = new UserController();
