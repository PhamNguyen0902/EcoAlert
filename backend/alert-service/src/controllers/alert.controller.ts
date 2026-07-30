import { Request, Response } from 'express';
import { alertService, WorkflowActor } from '../services/alert.service';
import { paginatedResponse, successResponse } from '@ecoalert/shared';

const workflowActor = (req: Request): WorkflowActor => ({
  id: req.headers['x-user-id'] as string,
  role: req.headers['x-user-role'] as string,
  correlationId: req.headers['x-request-id'] as string | undefined,
});

const pagination = (req: Request) => ({
  page: Math.max(1, Number.parseInt(req.query.page as string, 10) || 1),
  limit: Math.min(100, Math.max(1, Number.parseInt(req.query.limit as string, 10) || 10)),
});

export class AlertController {
  async createAlert(req: Request, res: Response) {
    const citizenId = req.headers['x-user-id'] as string;
    const result = await alertService.createAlert(citizenId, req.body);
    res.status(201).json(successResponse(result, 'Alert created successfully'));
  }

  async getAlerts(req: Request, res: Response) {
    const { page, limit } = pagination(req);
    const role = req.headers['x-user-role'] as string;
    const citizenId = role?.toUpperCase() === 'CITIZEN'
      ? req.headers['x-user-id'] as string
      : undefined;
    const filters = {
      status: req.query.status as string | undefined,
      category: req.query.category as string | undefined,
      severity: req.query.severity as string | undefined,
      isDeleted: req.query.isDeleted as string | undefined,
    };
    const { items, total } = await alertService.getAlerts(page, limit, citizenId, filters);
    res.status(200).json(paginatedResponse(items, total, page, limit));
  }

  async getOfficerTasks(req: Request, res: Response) {
    const { page, limit } = pagination(req);
    const { items, total } = await alertService.getOfficerTasks(
      workflowActor(req),
      page,
      limit,
      req.query.status as string | undefined,
    );
    res.status(200).json(paginatedResponse(items, total, page, limit));
  }

  async getAlertById(req: Request, res: Response) {
    const result = await alertService.getAlertById(req.params.id, workflowActor(req));
    res.status(200).json(successResponse(result));
  }

  async assignOfficer(req: Request, res: Response) {
    const result = await alertService.assignOfficer(req.params.id, workflowActor(req), req.body);
    res.status(200).json(successResponse(result, 'Officer assigned successfully'));
  }

  async startHandling(req: Request, res: Response) {
    const result = await alertService.startHandling(req.params.id, workflowActor(req));
    res.status(200).json(successResponse(result, 'Incident handling started'));
  }

  async confirmArrival(req: Request, res: Response) {
    const result = await alertService.confirmArrival(req.params.id, workflowActor(req), req.body);
    res.status(200).json(successResponse(result, 'Arrival confirmed'));
  }

  async resolveIncident(req: Request, res: Response) {
    const result = await alertService.resolveIncident(req.params.id, workflowActor(req), req.body);
    res.status(200).json(successResponse(result, 'Incident resolved'));
  }

  async closeIncident(req: Request, res: Response) {
    const result = await alertService.closeIncident(req.params.id, workflowActor(req), req.body);
    res.status(200).json(successResponse(result, 'Incident closed'));
  }

  async updateStatus(req: Request, res: Response) {
    const result = await alertService.updateStatus(req.params.id, workflowActor(req), req.body);
    res.status(200).json(successResponse(result, 'Alert status updated'));
  }

  async deleteAlert(req: Request, res: Response) {
    await alertService.deleteAlert(req.params.id, workflowActor(req));
    res.status(200).json(successResponse(null, 'Alert deleted successfully'));
  }

  async restoreAlert(req: Request, res: Response) {
    const result = await alertService.restoreAlert(req.params.id, workflowActor(req));
    res.status(200).json(successResponse(result, 'Alert restored successfully'));
  }

  async updateAlert(req: Request, res: Response) {
    const result = await alertService.updateAlert(req.params.id, workflowActor(req), req.body);
    res.status(200).json(successResponse(result, 'Alert updated successfully'));
  }

  async addOfficerNote(req: Request, res: Response) {
    const result = await alertService.addOfficerNote(req.params.id, workflowActor(req), req.body);
    res.status(200).json(successResponse(result, 'Officer note saved successfully'));
  }

  async checkNearbyAlerts(req: Request, res: Response) {
    const lng = Number.parseFloat(req.query.lng as string || req.query.longitude as string);
    const lat = Number.parseFloat(req.query.lat as string || req.query.latitude as string);
    const radius = Number.parseInt(req.query.radius as string, 10) || 200;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      res.status(400).json({ success: false, message: 'Valid latitude and longitude query parameters are required' });
      return;
    }

    const nearbyAlerts = await alertService.checkNearbyAlerts(lng, lat, radius);
    res.status(200).json(successResponse(nearbyAlerts, 'Nearby alerts retrieved successfully'));
  }

  async confirmAlert(req: Request, res: Response) {
    const citizenId = req.headers['x-user-id'] as string;
    const result = await alertService.confirmAlert(req.params.id, citizenId);
    res.status(200).json(successResponse(result, 'Alert confirmed successfully'));
  }
}

export const alertController = new AlertController();
