import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { tokenService } from '../services/token.service';
import { auditLogService } from '../services/audit-log.service';
import { successResponse } from '@ecoalert/shared';

export class AuthController {
  async confirmOtp(req: Request, res: Response) {
    const { email, code } = req.body;
    const result = await authService.confirmOtp(email, code);
    await auditLogService.log({
      user: email,
      action: 'USER_CONFIRM_OTP',
      resource: `User: ${email}`,
      details: 'User confirmed OTP code via Cognito',
      ipAddress: req.ip,
    });
    res.status(200).json(successResponse(result, result.message));
  }

  async resendOtp(req: Request, res: Response) {
    const { email } = req.body;
    const result = await authService.resendOtp(email);
    res.status(200).json(successResponse(result, result.message));
  }

  async register(req: Request, res: Response) {
    const result = await authService.register(req.body);
    await auditLogService.log({
      user: result.user.fullName || result.user.email,
      userId: result.user._id,
      action: 'USER_REGISTER',
      resource: `User: ${result.user.email}`,
      details: 'Registered a new user account with pending verification',
      ipAddress: req.ip,
    });
    res.status(201).json(successResponse(result, result.message));
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
