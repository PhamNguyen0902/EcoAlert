import mongoose from "mongoose";
import {
  AddOfficerNoteDto,
  AssignOfficerDto,
  CloseAlertDto,
  ConfirmArrivalDto,
  CreateAlertDto,
  ResolveAlertDto,
  ReviewClassificationDto,
  UpdateAlertDto,
  UpdateAlertStatusDto,
} from "../dtos/alert.dto";
import {
  IAlert,
  IAlertClassification,
  IImageValidation,
  ITimelineEntry,
  IStatusHistoryEntry,
  WorkflowActorRole,
} from "../models/alert.model";
import { alertRepository } from "../repositories/alert.repository";
import {
  AlertCategory,
  AlertStatus,
  BadRequestError,
  ConflictError,
  EVENTS,
  ForbiddenError,
  IAiAnalysisCompletedData,
  NotFoundError,
  resolveOverallAiConfidence,
  Severity,
} from "@ecoalert/shared";
import { rabbitMQService } from "./rabbitmq.service";
import { userDirectoryService } from "./user-directory.service";
import { envConfig } from "../config/env.config";
import { haversineDistanceMeters } from "../utils/geo-evidence.util";

export interface WorkflowActor {
  id: string;
  role: string;
  correlationId?: string;
}

const LEGACY_REVIEW_TRANSITIONS: Record<string, AlertStatus[]> = {
  [AlertStatus.PENDING]: [AlertStatus.VERIFIED, AlertStatus.REJECTED],
  [AlertStatus.AI_ANALYZING]: [AlertStatus.VERIFIED, AlertStatus.REJECTED],
};

const normalizeRole = (role?: string): WorkflowActorRole =>
  (role || "").toUpperCase() as WorkflowActorRole;

const normalizeStatus = (status?: string): AlertStatus =>
  (status || "").toLowerCase() as AlertStatus;

const statusFilter = (status: AlertStatus) => ({
  $regex: new RegExp(`^${status}$`, "i"),
});

const validAiSuggestion = (
  category?: AlertCategory | "UNCLASSIFIED" | null,
  confidence?: number | null,
) =>
  Boolean(
    category &&
    category !== "UNCLASSIFIED" &&
    confidence !== null &&
    confidence !== undefined &&
    confidence >= 0.5 &&
    Object.values(AlertCategory).includes(category as AlertCategory),
  );

export class AlertService {
  // các function hỗ trợ nội bộ dùng chung cho mọi role
  private ensureValidId(id: string) {
    if (!mongoose.isValidObjectId(id)) {
      throw new NotFoundError("Alert not found");
    }
  }

  private async requireAlert(id: string): Promise<IAlert> {
    this.ensureValidId(id);
    const alert = await alertRepository.findById(id);
    if (!alert) throw new NotFoundError("Alert not found");
    return alert;
  }

  private requireRole(actor: WorkflowActor, allowedRoles: WorkflowActorRole[]) {
    if (!allowedRoles.includes(normalizeRole(actor.role))) {
      throw new ForbiddenError(
        "You do not have permission to perform this action",
      );
    }
  }
  // yêu cầu actor là officer được phân công cho alert
  private requireAssignedOfficer(alert: IAlert, actor: WorkflowActor) {
    this.requireRole(actor, ["OFFICER"]);
    if (!alert.assignedOfficerId || alert.assignedOfficerId !== actor.id) {
      throw new ForbiddenError("This incident is not assigned to you");
    }
  }

  private historyEntry(
    fromStatus: AlertStatus | undefined,
    toStatus: AlertStatus,
    actor: WorkflowActor,
    changedAt: Date,
    note?: string,
  ): IStatusHistoryEntry {
    return {
      fromStatus,
      toStatus,
      changedBy: actor.id,
      changedByRole: normalizeRole(actor.role),
      changedAt,
      note,
      correlationId: actor.correlationId,
    };
  }

  private timelineEntry(
    eventType: string,
    label: string,
    actor: WorkflowActor,
    timestamp: Date,
    options: Pick<
      ITimelineEntry,
      "note" | "status" | "evidenceUrls" | "metadata"
    > = {},
  ): ITimelineEntry {
    return {
      eventType,
      label,
      timestamp,
      actorId: actor.id,
      actorRole: normalizeRole(actor.role),
      correlationId: actor.correlationId,
      ...options,
    };
  }

  private async publishWorkflowEvent(
    eventName: string,
    alert: IAlert,
    actor: WorkflowActor,
    extra: Record<string, unknown> = {},
  ) {
    const payload = {
      alertId: alert._id.toString(),
      title: alert.title,
      citizenId: alert.citizenId,
      assignedOfficerId: alert.assignedOfficerId,
      status: alert.status,
      actorId: actor.id,
      actorRole: normalizeRole(actor.role),
      ...extra,
    };

    await rabbitMQService.publishEvent(eventName, payload, actor.correlationId);
    await rabbitMQService.publishEvent(
      EVENTS.ALERT_UPDATED,
      { ...alert.toObject(), workflowNotificationHandled: true },
      actor.correlationId,
    );
  }

  // citizen tạo báo cáo sự cố
  // role: chỉ citizen; citizenId lấy từ actor đã xác thực, không lấy từ request body
  async createAlert(actor: WorkflowActor, data: CreateAlertDto) {
    // lưu báo cáo mới rồi phát alert.created để các read model và ai xử lý bất đồng bộ
    this.requireRole(actor, ["CITIZEN"]);
    const citizenId = actor.id;
    const createdAt = new Date();
    const {
      imageValidation: validation,
      classification: citizenClassification,
      ...alertData
    } = data;
    if (validation?.decision === "INVALID") {
      throw new ConflictError(
        "The selected image is not suitable for an environmental incident report. Please choose another image.",
      );
    }
    const aiSuggestedCategory = validAiSuggestion(
      validation?.suggestedCategory,
      validation?.confidence,
    )
      ? (validation?.suggestedCategory ?? null)
      : null;
    const storedImageValidation: IImageValidation | undefined = validation
      ? {
          ...validation,
          suggestedCategory: aiSuggestedCategory,
          validatedAt: new Date(validation.validatedAt),
        }
      : undefined;
    const selectedCategory =
      citizenClassification?.selectedCategory || data.category;
    const citizenConfirmedSuggestion =
      citizenClassification?.decision === "CONFIRM" &&
      Boolean(aiSuggestedCategory && selectedCategory === aiSuggestedCategory);
    const classification: IAlertClassification = selectedCategory
      ? {
          status: citizenConfirmedSuggestion
            ? //đồng ý với kết quả của category AI
              "USER_CONFIRMED"
            : //citizen chọn category khác
              "USER_CORRECTED",
          aiSuggestedCategory,
          aiConfidence: validation?.confidence ?? null,
          aiReason: validation?.reason ?? null,
          finalCategory: selectedCategory,
          finalCategorySource: "CITIZEN",
          citizenSelectedCategory: selectedCategory,
          citizenDecisionAt: createdAt,
          confirmedBy: citizenId,
          confirmedAt: createdAt,
        }
      : {
          status: aiSuggestedCategory ? "AI_SUGGESTED" : "UNCLASSIFIED",
          aiSuggestedCategory,
          aiConfidence: validation?.confidence ?? null,
          aiReason: validation?.reason ?? null,
          finalCategory: null,
          finalCategorySource: null,
          citizenSelectedCategory: null,
          citizenDecisionAt: null,
          confirmedBy: null,
          confirmedAt: null,
        };

    // Chống gửi trùng cùng nội dung trong khoảng thời gian ngắn.
    const recentDuplicate = await alertRepository.findOne({
      citizenId,
      title: data.title,
      description: data.description,
      createdAt: { $gte: new Date(createdAt.getTime() - 10000) },
    });
    if (recentDuplicate) {
      return recentDuplicate;
    }

    const alert = await alertRepository.create({
      ...alertData,
      category: selectedCategory || "UNCLASSIFIED",
      classification,
      ...(storedImageValidation
        ? { imageValidation: storedImageValidation }
        : {}),
      severity: (data.severity as Severity) || Severity.LOW,
      citizenId,
      status: AlertStatus.PENDING,
      isAnonymous: data.isAnonymous || false,
      confirmationsCount: 1,
      confirmations: [{ citizenId, confirmedAt: createdAt }],
      createdBy: citizenId,
      statusHistory: [
        this.historyEntry(undefined, AlertStatus.PENDING, actor, createdAt),
      ],
      timeline: [
        this.timelineEntry(
          "INCIDENT_REPORTED",
          "Incident reported",
          actor,
          createdAt,
          { status: AlertStatus.PENDING },
        ),
      ],
    });

    await rabbitMQService.publishEvent(EVENTS.ALERT_CREATED, alert);
    return alert;
  }
  // lấy danh sách báo cáo theo phạm vi
  // role: citizen xem báo cáo của mình; admin xem toàn bộ; controller truyền phạm vi qua citizenId và filters
  async getAlerts(
    page: number,
    limit: number,
    citizenId?: string,
    filters: {
      status?: string;
      category?: string;
      severity?: string;
      isDeleted?: string;
    } = {},
  ) {
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};

    if (citizenId) filter.citizenId = citizenId;
    if (filters.isDeleted === "true" || filters.status === "deleted") {
      filter.includeDeleted = true;
      filter.isDeleted = true;
    } else if (filters.status) {
      const statusList = filters.status
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (statusList.length > 1) {
        filter.status = {
          $in: statusList.map((s) => new RegExp(`^${s}$`, "i")),
        };
      } else if (filters.status.toLowerCase() === "pending") {
        filter.status = {
          $in: [
            new RegExp("^pending$", "i"),
            new RegExp("^ai_analyzing$", "i"),
          ],
        };
      } else {
        filter.status = { $regex: new RegExp(`^${filters.status}$`, "i") };
      }
    }
    if (filters.category)
      filter.category = { $regex: new RegExp(`^${filters.category}$`, "i") };
    if (filters.severity)
      filter.severity = { $regex: new RegExp(`^${filters.severity}$`, "i") };

    return alertRepository.findPaginated(filter, skip, limit);
  }
  // officer lấy danh sách nhiệm vụ được giao
  // role: chỉ officer; chỉ trả alert có assignedOfficerId trùng actor.id
  async getOfficerTasks(
    actor: WorkflowActor,
    page: number,
    limit: number,
    status?: string,
  ) {
    this.requireRole(actor, ["OFFICER"]);
    const filter: Record<string, unknown> = { assignedOfficerId: actor.id };
    if (status) {
      const normalizedStatus = normalizeStatus(status);
      if (
        ![
          AlertStatus.ASSIGNED,
          AlertStatus.IN_PROGRESS,
          AlertStatus.RESOLVED,
          AlertStatus.CLOSED,
        ].includes(normalizedStatus)
      ) {
        throw new BadRequestError("Unsupported Officer task status filter");
      }
      filter.status = statusFilter(normalizedStatus);
    }
    return alertRepository.findPaginated(filter, (page - 1) * limit, limit);
  }
  // lấy chi tiết alert cho cả ba role
  // role: admin xem mọi alert; citizen chỉ xem alert của mình; officer chỉ xem alert được giao
  async getAlertById(id: string, actor: WorkflowActor) {
    const alert = await this.requireAlert(id);
    const role = normalizeRole(actor.role);

    if (role === "ADMIN") return alert;
    if (role === "CITIZEN" && alert.citizenId === actor.id) return alert;
    if (role === "OFFICER" && alert.assignedOfficerId === actor.id)
      return alert;

    throw new ForbiddenError("You do not have access to this incident");
  }
  // admin phân công officer
  // role: chỉ admin; chỉ alert VERIFIED mới được chuyển sang ASSIGNED
  async assignOfficer(
    id: string,
    actor: WorkflowActor,
    data: AssignOfficerDto,
  ) {
    this.requireRole(actor, ["ADMIN"]);
    const alert = await this.requireAlert(id);
    const currentStatus = normalizeStatus(alert.status);
    if (currentStatus !== AlertStatus.VERIFIED) {
      throw new ConflictError("Only a verified incident can be assigned");
    }
    if (!mongoose.isValidObjectId(data.officerId)) {
      throw new NotFoundError("Officer not found");
    }
    const officer = await userDirectoryService.requireOfficer(
      data.officerId,
      actor,
    );

    const assignedAt = new Date();
    const updatedAlert = await alertRepository.findOneAndUpdate(
      { _id: id, status: statusFilter(currentStatus) },
      {
        $set: {
          status: AlertStatus.ASSIGNED,
          assignedOfficerId: data.officerId,
          assignedOfficerName: officer.fullName,
          assignedOfficerEmail: officer.email,
          assignedAt,
          assignedBy: actor.id,
          updatedBy: actor.id,
        },
        $push: {
          statusHistory: this.historyEntry(
            currentStatus,
            AlertStatus.ASSIGNED,
            actor,
            assignedAt,
          ),
          timeline: this.timelineEntry(
            "OFFICER_ASSIGNED",
            "Incident assigned to Officer",
            actor,
            assignedAt,
            { status: AlertStatus.ASSIGNED },
          ),
        },
      },
    );
    if (!updatedAlert)
      throw new ConflictError(
        "Incident assignment changed. Refresh and try again",
      );

    await this.publishWorkflowEvent(
      EVENTS.OFFICER_ASSIGNED,
      updatedAlert,
      actor,
    );
    return updatedAlert;
  }

  // officer bắt đầu xử lý alert được phân công
  // role: chỉ officer được phân công; chuyển trạng thái ASSIGNED -> IN_PROGRESS
  async startHandling(id: string, actor: WorkflowActor) {
    const alert = await this.requireAlert(id);
    this.requireAssignedOfficer(alert, actor);
    if (normalizeStatus(alert.status) !== AlertStatus.ASSIGNED) {
      throw new ConflictError("Only an assigned incident can be started");
    }

    const startedAt = new Date();
    const updatedAlert = await alertRepository.findOneAndUpdate(
      {
        _id: id,
        assignedOfficerId: actor.id,
        status: statusFilter(AlertStatus.ASSIGNED),
      },
      {
        $set: {
          status: AlertStatus.IN_PROGRESS,
          startedAt,
          startedBy: actor.id,
          updatedBy: actor.id,
        },
        $push: {
          statusHistory: this.historyEntry(
            AlertStatus.ASSIGNED,
            AlertStatus.IN_PROGRESS,
            actor,
            startedAt,
          ),
          timeline: this.timelineEntry(
            "OFFICER_STARTED_HANDLING",
            "Officer started handling",
            actor,
            startedAt,
            { status: AlertStatus.IN_PROGRESS },
          ),
        },
      },
    );
    if (!updatedAlert)
      throw new ConflictError("Incident status changed. Refresh and try again");

    await this.publishWorkflowEvent(EVENTS.ALERT_STARTED, updatedAlert, actor);
    return updatedAlert;
  }
  // officer check-in tại hiện trường
  // role: chỉ officer được giao; yêu cầu trạng thái IN_PROGRESS, gps chính xác và nằm trong bán kính cho phép
  async confirmArrival(
    id: string,
    actor: WorkflowActor,
    data: ConfirmArrivalDto,
  ) {
    const alert = await this.requireAlert(id);
    this.requireAssignedOfficer(alert, actor);
    if (normalizeStatus(alert.status) !== AlertStatus.IN_PROGRESS) {
      throw new ConflictError(
        "Arrival can only be confirmed for an incident in progress",
      );
    }
    if (alert.arrivedAt) {
      throw new ConflictError("Arrival has already been confirmed");
    }

    if (data.accuracyMeters > envConfig.officerMaxGpsAccuracyMeters) {
      throw new ConflictError(
        `GPS accuracy is insufficient (${Math.round(data.accuracyMeters)} m). Please retry in a clearer location.`,
      );
    }
    const [incidentLongitude, incidentLatitude] = alert.location.coordinates;
    const distanceFromIncidentMeters = haversineDistanceMeters(
      incidentLatitude,
      incidentLongitude,
      data.latitude,
      data.longitude,
    );
    if (distanceFromIncidentMeters > envConfig.officerCheckinRadiusMeters) {
      throw new ConflictError(
        `You are ${Math.round(distanceFromIncidentMeters)} m from the incident. Move within ${envConfig.officerCheckinRadiusMeters} m and retry check-in.`,
      );
    }
    const arrivedAt = new Date();
    const arrivalLocation = {
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracyMeters,
    };
    const checkIn = {
      officerId: actor.id,
      location: {
        type: "Point" as const,
        coordinates: [data.longitude, data.latitude] as [number, number],
      },
      accuracyMeters: data.accuracyMeters,
      distanceFromIncidentMeters,
      checkedInAt: arrivedAt,
      verified: true,
    };
    const updatedAlert = await alertRepository.findOneAndUpdate(
      {
        _id: id,
        assignedOfficerId: actor.id,
        status: statusFilter(AlertStatus.IN_PROGRESS),
        arrivedAt: null,
      },
      {
        $set: {
          arrivedAt,
          arrivedBy: actor.id,
          arrivalLocation,
          checkIn,
          updatedBy: actor.id,
        },
        $push: {
          timeline: this.timelineEntry(
            "ARRIVED_ON_SCENE",
            "Officer arrived at the scene",
            actor,
            arrivedAt,
            {
              status: AlertStatus.IN_PROGRESS,
              metadata: {
                distanceFromIncidentMeters,
                accuracyMeters: data.accuracyMeters,
              },
            },
          ),
        },
      },
    );
    if (!updatedAlert)
      throw new ConflictError(
        "Arrival was already confirmed or the incident status changed",
      );

    await this.publishWorkflowEvent(EVENTS.ALERT_ARRIVED, updatedAlert, actor);
    return updatedAlert;
  }
  // officer hoàn thành xử lý
  // role: chỉ officer được giao; bắt buộc đã check-in và có bằng chứng sau xử lý hợp lệ
  // chuyển trạng thái IN_PROGRESS -> RESOLVED
  async resolveIncident(
    id: string,
    actor: WorkflowActor,
    data: ResolveAlertDto,
  ) {
    const alert = await this.requireAlert(id);
    this.requireAssignedOfficer(alert, actor);
    if (normalizeStatus(alert.status) !== AlertStatus.IN_PROGRESS) {
      throw new ConflictError("Only an incident in progress can be resolved");
    }
    if (!alert.checkIn?.verified || alert.checkIn.officerId !== actor.id) {
      throw new ConflictError(
        "A verified on-site GPS check-in is required before resolving this incident",
      );
    }

    const resolvedAt = new Date();
    const [incidentLongitude, incidentLatitude] = alert.location.coordinates;
    const evidence = data.evidence.map((item) => {
      const location = item.location;
      if (
        location &&
        location.accuracyMeters > envConfig.officerMaxGpsAccuracyMeters
      ) {
        throw new ConflictError(
          `GPS accuracy is insufficient for after-treatment evidence (${Math.round(location.accuracyMeters)} m). Please retry.`,
        );
      }
      const distanceFromIncidentMeters = location
        ? haversineDistanceMeters(
            incidentLatitude,
            incidentLongitude,
            location.latitude,
            location.longitude,
          )
        : undefined;
      if (
        distanceFromIncidentMeters !== undefined &&
        distanceFromIncidentMeters > envConfig.officerEvidenceRadiusMeters
      ) {
        throw new ConflictError(
          `After-treatment evidence is ${Math.round(distanceFromIncidentMeters)} m from the incident and cannot be accepted as on-site evidence.`,
        );
      }
      return {
        mediaId: item.mediaId,
        url: item.url,
        uploadedBy: actor.id,
        uploadedAt: resolvedAt,
        capturedAt: resolvedAt,
        ...(location
          ? {
              location: {
                type: "Point" as const,
                coordinates: [location.longitude, location.latitude] as [
                  number,
                  number,
                ],
              },
              accuracyMeters: location.accuracyMeters,
              distanceFromIncidentMeters,
            }
          : {}),
        type: "AFTER_TREATMENT" as const,
      };
    });
    const evidenceUrls = evidence.map((item) => item.url);

    const updatedAlert = await alertRepository.findOneAndUpdate(
      {
        _id: id,
        assignedOfficerId: actor.id,
        status: statusFilter(AlertStatus.IN_PROGRESS),
        "checkIn.verified": true,
        "checkIn.officerId": actor.id,
      },
      {
        $set: {
          status: AlertStatus.RESOLVED,
          resolvedAt,
          resolvedBy: actor.id,
          resolutionSummary: data.resolutionSummary.trim(),
          treatmentMethod: data.treatmentMethod.trim(),
          materialsUsed: data.materialsUsed?.trim(),
          resolutionNotes: data.additionalNotes?.trim(),
          resolutionEvidence: evidence,
          updatedBy: actor.id,
        },
        $push: {
          statusHistory: this.historyEntry(
            AlertStatus.IN_PROGRESS,
            AlertStatus.RESOLVED,
            actor,
            resolvedAt,
            data.resolutionSummary,
          ),
          timeline: {
            $each: [
              this.timelineEntry(
                "RESOLUTION_EVIDENCE_UPLOADED",
                "After-treatment evidence uploaded",
                actor,
                resolvedAt,
                { status: AlertStatus.IN_PROGRESS, evidenceUrls },
              ),
              this.timelineEntry(
                "INCIDENT_RESOLVED",
                "Incident marked as Resolved",
                actor,
                resolvedAt,
                {
                  status: AlertStatus.RESOLVED,
                  note: data.resolutionSummary,
                  evidenceUrls,
                },
              ),
            ],
          },
        },
      },
    );
    if (!updatedAlert)
      throw new ConflictError("Incident status changed. Refresh and try again");

    await rabbitMQService.publishEvent(
      EVENTS.ALERT_RESOLUTION_EVIDENCE_UPLOADED,
      {
        alertId: updatedAlert._id.toString(),
        citizenId: updatedAlert.citizenId,
        assignedOfficerId: updatedAlert.assignedOfficerId,
        evidenceUrls,
      },
      actor.correlationId,
    );
    await this.publishWorkflowEvent(
      EVENTS.ALERT_RESOLVED,
      updatedAlert,
      actor,
      { evidenceUrls },
    );
    return updatedAlert;
  }
  // admin kiểm tra và đóng sự cố
  // role: chỉ admin; yêu cầu trạng thái RESOLVED và có đủ officer, thời gian, bằng chứng xử lý
  // chuyển trạng thái RESOLVED -> CLOSED
  async closeIncident(id: string, actor: WorkflowActor, data: CloseAlertDto) {
    this.requireRole(actor, ["ADMIN"]);
    const alert = await this.requireAlert(id);
    if (normalizeStatus(alert.status) !== AlertStatus.RESOLVED) {
      throw new ConflictError("Only a resolved incident can be closed");
    }
    if (
      !alert.assignedOfficerId ||
      !alert.resolvedAt ||
      !alert.resolvedBy ||
      !alert.resolutionEvidence?.length
    ) {
      throw new ConflictError(
        "Resolution evidence, assigned Officer, and resolution timestamp are required before closing",
      );
    }

    const closedAt = new Date();
    const updatedAlert = await alertRepository.findOneAndUpdate(
      { _id: id, status: statusFilter(AlertStatus.RESOLVED) },
      {
        $set: {
          status: AlertStatus.CLOSED,
          closedAt,
          closedBy: actor.id,
          adminReviewNote: data.reviewNote?.trim(),
          updatedBy: actor.id,
        },
        $push: {
          statusHistory: this.historyEntry(
            AlertStatus.RESOLVED,
            AlertStatus.CLOSED,
            actor,
            closedAt,
            data.reviewNote,
          ),
          timeline: this.timelineEntry(
            "INCIDENT_CLOSED",
            "Incident Closed by Admin",
            actor,
            closedAt,
            { status: AlertStatus.CLOSED, note: data.reviewNote },
          ),
        },
      },
    );
    if (!updatedAlert)
      throw new ConflictError("Incident status changed. Refresh and try again");

    await this.publishWorkflowEvent(EVENTS.ALERT_CLOSED, updatedAlert, actor);
    return updatedAlert;
  }

  // admin xác minh hoặc từ chối báo cáo
  // role: chỉ admin; chỉ hỗ trợ PENDING hoặc AI_ANALYZING -> VERIFIED hoặc REJECTED
  // các bước workflow khác phải gọi function chuyên biệt, không đổi status trực tiếp
  async updateStatus(
    id: string,
    actor: WorkflowActor,
    data: UpdateAlertStatusDto,
  ) {
    this.requireRole(actor, ["ADMIN"]);
    const alert = await this.requireAlert(id);
    const currentStatus = normalizeStatus(alert.status);
    const newStatus = normalizeStatus(data.status);
    const allowedNext = LEGACY_REVIEW_TRANSITIONS[currentStatus] || [];

    if (!allowedNext.includes(newStatus)) {
      throw new ConflictError(
        "Use the assignment, start, arrival, resolution, or close action for workflow status changes",
      );
    }

    const changedAt = new Date();
    const updatedAlert = await alertRepository.findOneAndUpdate(
      { _id: id, status: statusFilter(currentStatus) },
      {
        $set: { status: newStatus, updatedBy: actor.id },
        $push: {
          statusHistory: this.historyEntry(
            currentStatus,
            newStatus,
            actor,
            changedAt,
          ),
          timeline: this.timelineEntry(
            newStatus === AlertStatus.REJECTED
              ? "INCIDENT_REJECTED"
              : "INCIDENT_VERIFIED",
            newStatus === AlertStatus.REJECTED
              ? "Incident rejected"
              : "Incident verified",
            actor,
            changedAt,
            { status: newStatus },
          ),
        },
      },
    );
    if (!updatedAlert)
      throw new ConflictError("Incident status changed. Refresh and try again");
    await this.publishWorkflowEvent(EVENTS.ALERT_UPDATED, updatedAlert, actor);
    return updatedAlert;
  }
  // admin duyệt phân loại do ai hoặc citizen cung cấp
  // role: chỉ admin; chỉ thực hiện trước khi phân công ở trạng thái PENDING hoặc VERIFIED
  async reviewClassification(
    id: string,
    actor: WorkflowActor,
    data: ReviewClassificationDto,
  ) {
    this.requireRole(actor, ["ADMIN"]);
    const alert = await this.requireAlert(id);
    const currentStatus = normalizeStatus(alert.status);
    if (![AlertStatus.PENDING, AlertStatus.VERIFIED].includes(currentStatus)) {
      throw new ConflictError(
        "Classification can only be reviewed before an incident is assigned",
      );
    }
    const currentClassification = alert.classification;
    const finalCategory =
      data.category ||
      currentClassification?.finalCategory ||
      (alert.category === "UNCLASSIFIED" ? undefined : alert.category);
    if (!finalCategory)
      throw new ConflictError("Select a classification before confirming it");

    const confirmedAt = new Date();
    const isCorrection = Boolean(
      data.category &&
      data.category !==
        (currentClassification?.finalCategory || alert.category),
    );
    const classification: IAlertClassification = {
      status: isCorrection ? "ADMIN_CORRECTED" : "ADMIN_CONFIRMED",
      aiSuggestedCategory: currentClassification?.aiSuggestedCategory ?? null,
      aiConfidence:
        currentClassification?.aiConfidence ?? alert.aiConfidence ?? null,
      aiReason:
        currentClassification?.aiReason ?? alert.aiReasoningSummary ?? null,
      finalCategory,
      finalCategorySource: "ADMIN",
      citizenSelectedCategory:
        currentClassification?.citizenSelectedCategory ?? null,
      citizenDecisionAt: currentClassification?.citizenDecisionAt ?? null,
      confirmedBy: actor.id,
      confirmedAt,
    };
    const updatedAlert = await alertRepository.findOneAndUpdate(
      { _id: id, status: statusFilter(currentStatus) },
      {
        $set: { category: finalCategory, classification, updatedBy: actor.id },
        $push: {
          timeline: this.timelineEntry(
            isCorrection
              ? "ADMIN_CLASSIFICATION_CORRECTED"
              : "ADMIN_CLASSIFICATION_CONFIRMED",
            isCorrection
              ? "Admin corrected incident classification"
              : "Admin confirmed incident classification",
            actor,
            confirmedAt,
            { status: currentStatus, metadata: { category: finalCategory } },
          ),
        },
      },
    );
    if (!updatedAlert)
      throw new ConflictError("Incident changed. Refresh and try again");
    await this.publishWorkflowEvent(EVENTS.ALERT_UPDATED, updatedAlert, actor);
    return updatedAlert;
  }
  // system cập nhật kết quả từ ai-service
  // role: luồng nội bộ system, không phải thao tác trực tiếp của ba role người dùng
  // ai chỉ đưa ra gợi ý và không ghi đè quyết định đã được con người xác nhận
  async internalUpdateAiResult(id: string, analysis: IAiAnalysisCompletedData) {
    if (!mongoose.isValidObjectId(id)) return null;
    const alert = await alertRepository.findById(id);
    if (!alert) return null;
    if (alert.aiAnalysisId === analysis.analysisId) return alert;

    const currentStatus = normalizeStatus(alert.status);
    // ai chỉ cung cấp gợi ý; admin vẫn là người xác minh và quyết định workflow
    const newStatus = AlertStatus.PENDING;
    const displayConfidence = resolveOverallAiConfidence({
      analysisMode: analysis.analysisMode,
      confidence: analysis.confidence,
      overallAnalysis: analysis.overallAnalysis,
    });
    const semanticCategoryConfidence =
      analysis.overallAnalysis?.categoryConfidence ??
      (analysis.analysisMode === "FAILED" ? null : analysis.confidence);
    const aiSuggestedCategory =
      analysis.overallAnalysis?.classificationStatus === "AI_SUGGESTED" &&
      validAiSuggestion(
        analysis.overallAnalysis.categorySuggestion,
        analysis.overallAnalysis.categoryConfidence,
      )
        ? analysis.overallAnalysis.categorySuggestion
        : validAiSuggestion(analysis.category, analysis.confidence)
          ? (analysis.category as AlertCategory)
          : null;
    const existingClassification = alert.classification;
    const humanFinalCategory =
      existingClassification?.finalCategory ||
      (alert.category !== "UNCLASSIFIED" ? alert.category : null);
    const hasHumanDecision = Boolean(
      existingClassification?.finalCategorySource === "CITIZEN" ||
      existingClassification?.finalCategorySource === "ADMIN" ||
      existingClassification?.status?.startsWith("USER_") ||
      existingClassification?.status?.startsWith("ADMIN_"),
    );
    const classification: IAlertClassification = hasHumanDecision
      ? {
          ...existingClassification,
          status: existingClassification?.status || "USER_CORRECTED",
          aiSuggestedCategory,
          aiConfidence: semanticCategoryConfidence,
          aiReason:
            analysis.overallAnalysis?.shortReason ?? analysis.reasoningSummary,
          finalCategory: humanFinalCategory as AlertCategory | null,
          finalCategorySource:
            existingClassification?.finalCategorySource || "CITIZEN",
        }
      : {
          status: aiSuggestedCategory ? "AI_SUGGESTED" : "UNCLASSIFIED",
          aiSuggestedCategory,
          aiConfidence: semanticCategoryConfidence,
          aiReason:
            analysis.overallAnalysis?.shortReason ?? analysis.reasoningSummary,
          finalCategory: null,
          finalCategorySource: null,
          citizenSelectedCategory: null,
          citizenDecisionAt: null,
          confirmedBy: null,
          confirmedAt: null,
        };
    const analyzedAt = new Date();
    const actor: WorkflowActor = { id: "ai-service", role: "SYSTEM" };

    const update: Record<string, unknown> = {
      $set: {
        category:
          hasHumanDecision && humanFinalCategory
            ? humanFinalCategory
            : "UNCLASSIFIED",
        classification,
        aiConfidence: displayConfidence.value,
        aiConfidenceSource: displayConfidence.source,
        aiSuggestedPriority: analysis.severity,
        severity: analysis.severity,
        aiSummary: analysis.overallAnalysis?.overallSummary ?? analysis.summary,
        aiReasoningSummary:
          analysis.overallAnalysis?.shortReason ?? analysis.reasoningSummary,
        aiAnalysisMode: analysis.analysisMode,
        aiAnalysisProvider: analysis.provider,
        aiAnalysisModel: analysis.model,
        aiFailureReason: analysis.failureReason ?? null,
        aiAnalysisId: analysis.analysisId,
        aiAnalyzedAt: analyzedAt,
        ...(analysis.pipelineVersion
          ? { aiPipelineVersion: analysis.pipelineVersion }
          : {}),
        ...(analysis.overallAnalysis
          ? { aiOverallAnalysis: analysis.overallAnalysis }
          : {}),
        ...(analysis.processingTimeMs !== undefined
          ? { aiSemanticProcessingTimeMs: analysis.processingTimeMs }
          : {}),
        ...(currentStatus === AlertStatus.PENDING ||
        currentStatus === AlertStatus.AI_ANALYZING
          ? { status: newStatus }
          : {}),
      },
      $push: {
        timeline: this.timelineEntry(
          "AI_ANALYSIS_COMPLETED",
          analysis.analysisMode === "FAILED"
            ? "AI analysis unavailable"
            : "AI analysis completed",
          actor,
          analyzedAt,
          {
            status: newStatus,
            note:
              analysis.analysisMode === "FAILED"
                ? analysis.failureReason ||
                  "Dịch vụ AI tạm thời không khả dụng."
                : displayConfidence.value === null
                  ? "Semantic confidence: Not available"
                  : `Confidence: ${Math.round(displayConfidence.value * 100)}% (${displayConfidence.source.toLowerCase()})`,
            metadata: {
              analysisMode: analysis.analysisMode,
              displayConfidence: displayConfidence.value,
              displayConfidenceSource: displayConfidence.source,
              failureReason: analysis.failureReason ?? null,
            },
          },
        ),
        ...((currentStatus === AlertStatus.PENDING ||
          currentStatus === AlertStatus.AI_ANALYZING) &&
        currentStatus !== newStatus
          ? {
              statusHistory: this.historyEntry(
                currentStatus,
                newStatus,
                actor,
                analyzedAt,
              ),
            }
          : {}),
      },
    };
    //cập nhật sự cố
    const updatedAlert = await alertRepository.findOneAndUpdate(
      {
        _id: id,
        status: statusFilter(currentStatus),
        aiAnalysisId: { $ne: analysis.analysisId },
      },
      update,
    );
    if (!updatedAlert) {
      const existingAlert = await alertRepository.findById(id);
      if (existingAlert?.aiAnalysisId === analysis.analysisId)
        return existingAlert;
    }
    if (updatedAlert)
      await rabbitMQService.publishEvent(EVENTS.ALERT_UPDATED, updatedAlert);
    return updatedAlert;
  }
  // citizen hoặc admin xóa mềm sự cố
  // role: citizen chỉ xóa alert của mình khi PENDING hoặc AI_ANALYZING; admin được xóa; officer bị cấm
  async deleteAlert(id: string, actor: WorkflowActor) {
    const alert = await this.requireAlert(id);
    const role = normalizeRole(actor.role);
    if (role === "OFFICER")
      throw new ForbiddenError("Officers cannot delete incidents");
    if (role === "CITIZEN") {
      if (alert.citizenId !== actor.id)
        throw new ForbiddenError("You can only delete your own alerts");
      if (
        ![AlertStatus.PENDING, AlertStatus.AI_ANALYZING].includes(
          normalizeStatus(alert.status),
        )
      ) {
        throw new ConflictError("This incident can no longer be deleted");
      }
    } else if (role !== "ADMIN") {
      throw new ForbiddenError(
        "You do not have permission to delete incidents",
      );
    }
    const success = await alertRepository.softDelete(id, actor.id);
    if (!success) throw new NotFoundError("Alert not found");

    // thông báo qua rabbitmq và socket.io rằng báo cáo đã bị xóa
    const deletedAlertData = {
      _id: alert._id,
      alertId: alert._id,
      citizenId: alert.citizenId,
      status: "deleted",
      isDeleted: true,
      deletedAt: new Date(),
      actorId: actor.id,
      updatedBy: actor.id,
    };
    await rabbitMQService.publishEvent(
      EVENTS.ALERT_UPDATED,
      deletedAlertData,
      actor.correlationId,
    );

    return true;
  }
  // admin khôi phục sự cố đã xóa mềm
  // role: chỉ admin
  async restoreAlert(id: string, actor: WorkflowActor) {
    this.requireRole(actor, ["ADMIN"]);
    this.ensureValidId(id);
    const alert = await alertRepository.findOne({
      _id: id,
      includeDeleted: true,
    } as never);
    if (!alert) throw new NotFoundError("Alert not found");
    alert.isDeleted = false;
    alert.deletedAt = null as never;
    alert.updatedBy = actor.id;
    await alert.save();
    await rabbitMQService.publishEvent(
      EVENTS.ALERT_UPDATED,
      alert,
      actor.correlationId,
    );
    return alert;
  }

  // citizen hoặc admin sửa nội dung sự cố
  // role: citizen chỉ sửa alert của mình khi PENDING hoặc AI_ANALYZING; admin được sửa; officer bị cấm
  async updateAlert(id: string, actor: WorkflowActor, data: UpdateAlertDto) {
    const alert = await this.requireAlert(id);
    const role = normalizeRole(actor.role);
    if (role === "OFFICER")
      throw new ForbiddenError("Officers cannot edit incident details");
    if (role === "CITIZEN") {
      if (alert.citizenId !== actor.id)
        throw new ForbiddenError("You can only update your own alerts");
      if (
        ![AlertStatus.PENDING, AlertStatus.AI_ANALYZING].includes(
          normalizeStatus(alert.status),
        )
      ) {
        throw new ConflictError(
          "Cannot edit an incident once it is verified or processed",
        );
      }
    } else if (role !== "ADMIN") {
      throw new ForbiddenError("You do not have permission to edit incidents");
    }

    const updatedAlert = await alertRepository.update(id, {
      ...data,
      updatedBy: actor.id,
    });
    if (!updatedAlert) throw new NotFoundError("Alert not found during update");
    await rabbitMQService.publishEvent(
      EVENTS.ALERT_UPDATED,
      updatedAlert,
      actor.correlationId,
    );
    return updatedAlert;
  }
  // officer hoặc admin thêm ghi chú nghiệp vụ
  // role: officer chỉ ghi chú alert được giao cho mình; admin có thể ghi chú mọi alert
  async addOfficerNote(
    id: string,
    actor: WorkflowActor,
    data: AddOfficerNoteDto,
  ) {
    const alert = await this.requireAlert(id);
    const role = normalizeRole(actor.role);
    if (role === "OFFICER" && alert.assignedOfficerId !== actor.id) {
      throw new ForbiddenError("This incident is not assigned to you");
    }
    if (!["OFFICER", "ADMIN"].includes(role)) {
      throw new ForbiddenError("Only officers and admins can add notes");
    }
    const updatedAlert = await alertRepository.update(id, {
      officerNote: data.note.trim(),
      updatedBy: actor.id,
    });
    if (!updatedAlert) throw new NotFoundError("Alert not found during update");
    await rabbitMQService.publishEvent(
      EVENTS.ALERT_UPDATED,
      updatedAlert,
      actor.correlationId,
    );
    return updatedAlert;
  }
  // tìm các sự cố lân cận
  // role: service không tự kiểm tra role; route và controller quyết định quyền truy cập endpoint
  async checkNearbyAlerts(
    longitude: number,
    latitude: number,
    radiusMeters: number = 200,
  ) {
    return alertRepository.findNearby(longitude, latitude, radiusMeters);
  }
  // citizen xác nhận cũng nhìn thấy sự cố
  // role: citizen; mỗi citizen chỉ được tính một lượt xác nhận cho cùng một alert
  async confirmAlert(id: string, citizenId: string) {
    const alert = await this.requireAlert(id);
    const hasAlreadyConfirmed = alert.confirmations?.some(
      (c) => c.citizenId === citizenId,
    );
    if (hasAlreadyConfirmed) {
      return alert;
    }

    const updatedAlert = await alertRepository.findOneAndUpdate(
      { _id: id },
      {
        $inc: { confirmationsCount: 1 },
        $push: { confirmations: { citizenId, confirmedAt: new Date() } },
      },
    );

    if (updatedAlert) {
      await rabbitMQService.publishEvent(EVENTS.ALERT_UPDATED, updatedAlert);
    }
    return updatedAlert || alert;
  }
}

export const alertService = new AlertService();
