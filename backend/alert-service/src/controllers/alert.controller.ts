import { Request, Response } from "express";
import { alertService, WorkflowActor } from "../services/alert.service";
import { officerShiftService } from "../services/officer-shift.service";
import {
  ForbiddenError,
  paginatedResponse,
  successResponse,
} from "@ecoalert/shared";

const workflowActor = (req: Request): WorkflowActor => ({
  id: req.headers["x-user-id"] as string,
  role: req.headers["x-user-role"] as string,
  correlationId: req.headers["x-request-id"] as string | undefined,
});

const pagination = (req: Request) => ({
  page: Math.max(1, Number.parseInt(req.query.page as string, 10) || 1),
  limit: Math.min(
    100,
    Math.max(1, Number.parseInt(req.query.limit as string, 10) || 10),
  ),
});

export class AlertController {
  async createAlert(req: Request, res: Response) {
    // Nhận báo cáo của Citizen và chuyển actor đã xác thực xuống tầng nghiệp vụ.
    const result = await alertService.createAlert(workflowActor(req), req.body);
    res.status(201).json(successResponse(result, "Alert created successfully"));
  }

  async getAlerts(req: Request, res: Response) {
    const { page, limit } = pagination(req);
    const actor = workflowActor(req);
    const role = actor.role?.toUpperCase();
    if (role === "OFFICER") {
      const result = await alertService.getOfficerTasks(
        actor,
        page,
        limit,
        req.query.status as string | undefined,
      );
      res
        .status(200)
        .json(paginatedResponse(result.items, result.total, page, limit));
      return;
    }
    if (role !== "CITIZEN" && role !== "ADMIN") {
      throw new ForbiddenError("You do not have permission to view incidents");
    }
    const citizenId =
      role === "CITIZEN" ? (req.headers["x-user-id"] as string) : undefined;
    const filters = {
      //chưa lấy req.query.title
      status: req.query.status as string | undefined,
      category: req.query.category as string | undefined,
      severity: req.query.severity as string | undefined,
      isDeleted: req.query.isDeleted as string | undefined,
    };
    const { items, total } = await alertService.getAlerts(
      page,
      limit,
      citizenId,
      filters,
    );
    res.status(200).json(paginatedResponse(items, total, page, limit));
  }

  public getOfficerTasks = async (req: Request, res: Response) => {
    try {
      const actor = workflowActor(req);
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const status = req.query.status as string | undefined;

      // Chỉ trả các nhiệm vụ được phân công cho Officer đang đăng nhập.
      const result = await alertService.getOfficerTasks(
        actor,
        page,
        limit,
        status,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(error.status || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  };

  async getAlertById(req: Request, res: Response) {
    const result = await alertService.getAlertById(
      req.params.id,
      workflowActor(req),
    );
    res.status(200).json(successResponse(result));
  }

  async assignOfficer(req: Request, res: Response) {
    const result = await alertService.assignOfficer(
      req.params.id,
      workflowActor(req),
      req.body,
    );
    res
      .status(200)
      .json(successResponse(result, "Officer assigned successfully"));
  }

  async startHandling(req: Request, res: Response) {
    const result = await alertService.startHandling(
      req.params.id,
      workflowActor(req),
    );
    res.status(200).json(successResponse(result, "Incident handling started"));
  }

  async confirmArrival(req: Request, res: Response) {
    const result = await alertService.confirmArrival(
      req.params.id,
      workflowActor(req),
      req.body,
    );
    res.status(200).json(successResponse(result, "Arrival confirmed"));
  }

  async resolveIncident(req: Request, res: Response) {
    const result = await alertService.resolveIncident(
      req.params.id,
      workflowActor(req),
      req.body,
    );
    res.status(200).json(successResponse(result, "Incident resolved"));
  }

  async closeIncident(req: Request, res: Response) {
    const result = await alertService.closeIncident(
      req.params.id,
      workflowActor(req),
      req.body,
    );
    res.status(200).json(successResponse(result, "Incident closed"));
  }

  async updateStatus(req: Request, res: Response) {
    const result = await alertService.updateStatus(
      req.params.id,
      workflowActor(req),
      req.body,
    );
    res.status(200).json(successResponse(result, "Alert status updated"));
  }

  async reviewClassification(req: Request, res: Response) {
    const result = await alertService.reviewClassification(
      req.params.id,
      workflowActor(req),
      req.body,
    );
    res.status(200).json(successResponse(result, "Classification reviewed"));
  }

  async deleteAlert(req: Request, res: Response) {
    await alertService.deleteAlert(req.params.id, workflowActor(req));
    res.status(200).json(successResponse(null, "Alert deleted successfully"));
  }

  async restoreAlert(req: Request, res: Response) {
    const result = await alertService.restoreAlert(
      req.params.id,
      workflowActor(req),
    );
    res
      .status(200)
      .json(successResponse(result, "Alert restored successfully"));
  }

  async updateAlert(req: Request, res: Response) {
    const result = await alertService.updateAlert(
      req.params.id,
      workflowActor(req),
      req.body,
    );
    res.status(200).json(successResponse(result, "Alert updated successfully"));
  }

  async addOfficerNote(req: Request, res: Response) {
    const result = await alertService.addOfficerNote(
      req.params.id,
      workflowActor(req),
      req.body,
    );
    res
      .status(200)
      .json(successResponse(result, "Officer note saved successfully"));
  }

  async checkNearbyAlerts(req: Request, res: Response) {
    const lng = Number.parseFloat(
      (req.query.lng as string) || (req.query.longitude as string),
    );
    const lat = Number.parseFloat(
      (req.query.lat as string) || (req.query.latitude as string),
    );
    const radius = Number.parseInt(req.query.radius as string, 10) || 200;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      res.status(400).json({
        success: false,
        message: "Valid latitude and longitude query parameters are required",
      });
      return;
    }

    const nearbyAlerts = await alertService.checkNearbyAlerts(lng, lat, radius);
    res
      .status(200)
      .json(
        successResponse(nearbyAlerts, "Nearby alerts retrieved successfully"),
      );
  }

  async confirmAlert(req: Request, res: Response) {
    const citizenId = req.headers["x-user-id"] as string;
    const result = await alertService.confirmAlert(req.params.id, citizenId);
    res
      .status(200)
      .json(successResponse(result, "Alert confirmed successfully"));
  }

  async startShift(req: Request, res: Response) {
    const result = await officerShiftService.startShift(
      workflowActor(req),
      req.body,
    );
    res.status(201).json(successResponse(result, "Shift started"));
  }

  async endShift(req: Request, res: Response) {
    const result = await officerShiftService.endShift(
      workflowActor(req),
      req.body,
    );
    res.status(200).json(successResponse(result, "Shift ended"));
  }

  async getCurrentShift(req: Request, res: Response) {
    const result = await officerShiftService.getCurrentShift(
      workflowActor(req),
    );
    res.status(200).json(successResponse(result));
  }

  async getShiftHistory(req: Request, res: Response) {
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit as string, 10) || 20),
    );
    const result = await officerShiftService.getShiftHistory(
      workflowActor(req),
      limit,
    );
    res.status(200).json(successResponse(result));
  }

  async getOfficerAvailability(req: Request, res: Response) {
    const result = await officerShiftService.getAvailability(
      workflowActor(req),
    );
    res.status(200).json(successResponse(result));
  }
}

export const alertController = new AlertController();
