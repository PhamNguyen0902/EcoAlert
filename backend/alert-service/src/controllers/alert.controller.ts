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
    
    // If citizen, only show their own. If admin/officer, show all
    const role = req.headers['x-user-role'] as string;
    const citizenId = role === 'CITIZEN' ? req.headers['x-user-id'] as string : undefined;

    // Optional filters
    const status = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;
    const severity = req.query.severity as string | undefined;

    const { items, total } = await alertService.getAlerts(page, limit, citizenId, { status, category, severity });
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

  async deleteAlert(req: Request, res: Response) {
    const userId = req.headers['x-user-id'] as string;
    const userRole = req.headers['x-user-role'] as string;
    await alertService.deleteAlert(req.params.id, userId, userRole);
    res.status(200).json(successResponse(null, 'Alert deleted successfully'));
  }

  async restoreAlert(req: Request, res: Response) {
    const userId = req.headers['x-user-id'] as string;
    const result = await alertService.restoreAlert(req.params.id, userId);
    res.status(200).json(successResponse(result, 'Alert restored successfully'));
  }

  async updateAlert(req: Request, res: Response) {
    const userId = req.headers['x-user-id'] as string;
    const userRole = req.headers['x-user-role'] as string;
    const result = await alertService.updateAlert(req.params.id, userId, userRole, req.body);
    res.status(200).json(successResponse(result, 'Alert updated successfully'));
  }

  async addOfficerNote(req: Request, res: Response) {
    const officerId = req.headers['x-user-id'] as string;
    const userRole = req.headers['x-user-role'] as string;
    const result = await alertService.addOfficerNote(req.params.id, officerId, userRole, req.body);
    res.status(200).json(successResponse(result, 'Officer note saved successfully'));
  }
}

export const alertController = new AlertController();

