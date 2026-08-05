import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { tokenService } from '../services/token.service';
import { auditLogService } from '../services/audit-log.service';
import { successResponse } from '@ecoalert/shared';

export class AuthController {
  async register(req: Request, res: Response) {
    const result = await authService.register(req.body);
    await auditLogService.log({
      user: result.user.fullName || result.user.email,
      userId: result.user._id,
      action: 'USER_REGISTER',
      resource: `User: ${result.user.email}`,
      details: 'Registered a new user account',
      ipAddress: req.ip,
    });
    res.status(201).json(successResponse(result, 'User registered successfully'));
  }

  async login(req: Request, res: Response) {
    console.log('Login request body received in user-service:', req.body);
    const result = await authService.login(req.body);
    await auditLogService.log({
      user: result.user.fullName || result.user.email,
      userId: result.user._id,
      action: 'USER_LOGIN',
      resource: `User: ${result.user.email}`,
      details: `User logged in with role ${result.user.role}`,
      ipAddress: req.ip,
    });
    res.status(200).json(successResponse(result, 'Login successful'));
  }

  async refreshToken(req: Request, res: Response) {
    const result = await authService.refreshToken(req.body.refreshToken);
    res.status(200).json(successResponse(result, 'Token refreshed successfully'));
  }

  async logout(req: Request, res: Response) {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      await tokenService.blacklistToken(token);
    }
    if (req.body.refreshToken) {
      await tokenService.deleteRefreshToken(req.body.refreshToken);
    }
    res.status(200).json(successResponse(null, 'Logout successful'));
  }
}

export const authController = new AuthController();
