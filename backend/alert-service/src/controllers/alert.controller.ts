import { Request, Response } from 'express';
import { alertService } from '../services/alert.service';
import { successResponse, paginatedResponse } from '@ecoalert/shared';

export class AlertController {
  async createAlert(req: Request, res: Response) {
    const citizenId = req.headers['x-user-id'] as string;
    const result = await alertService.createAlert(citizenId, req.body);
    res.status(201).json(successResponse(result, 'Alert created successfully'));
  }

  async getAlerts(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    // If citizen, only show their own. If admin/officer, show all (handled simply here, ideally would check role)
    const role = req.headers['x-user-role'] as string;
    const citizenId = role === 'CITIZEN' ? req.headers['x-user-id'] as string : undefined;

    const { items, total } = await alertService.getAlerts(page, limit, citizenId);
    res.status(200).json(paginatedResponse(items, total, page, limit));
  }

  async getAlertById(req: Request, res: Response) {
    const result = await alertService.getAlertById(req.params.id);
    res.status(200).json(successResponse(result));
  }

  async updateStatus(req: Request, res: Response) {
    const userId = req.headers['x-user-id'] as string;
    const result = await alertService.updateStatus(req.params.id, userId, req.body);
    res.status(200).json(successResponse(result, 'Alert status updated'));
  }
}

export const alertController = new AlertController();
