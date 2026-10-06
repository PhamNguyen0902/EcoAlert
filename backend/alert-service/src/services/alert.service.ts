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
  WorkflowActorRole,
} from "../models/alert.model";
import { alertRepository } from "../repositories/alert.repository";
import {
  AlertStatus,
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
import { haversineDistanceMeters, isValidLatitude, isValidLongitude } from "../utils/geo-evidence.util";
import { BadRequestError } from "@ecoalert/shared";

export interface WorkflowActor {
  id: string;
  role: string;
  correlationId?: string;
}

const normRole = (r?: string) => (r || "").toUpperCase() as WorkflowActorRole;
const normStatus = (s?: string) => (s || "").toLowerCase() as AlertStatus;

export class AlertService {
  private validateFieldLocation(alert: IAlert, data: ConfirmArrivalDto, radiusMeters: number) {
    if (!isValidLatitude(data.latitude) || !isValidLongitude(data.longitude) ||
        !Number.isFinite(data.accuracyMeters) || data.accuracyMeters < 0)
      throw new BadRequestError("Vị trí GPS không hợp lệ. Vui lòng lấy lại vị trí.");
    if (data.accuracyMeters > envConfig.officerCheckinMaxAccuracyMeters)
      throw new BadRequestError("Độ chính xác GPS hiện chưa đủ tốt để xác nhận bạn đã đến hiện trường.");
    const coords = alert.location?.coordinates;
    if (!coords || !isValidLongitude(coords[0]) || !isValidLatitude(coords[1]))
      throw new BadRequestError("Báo cáo không có vị trí hiện trường hợp lệ.");
    const distance = haversineDistanceMeters(coords[1], coords[0], data.latitude, data.longitude);
    if (distance > radiusMeters)
      throw new BadRequestError(`Bạn hiện cách vị trí sự cố khoảng ${Math.round(distance)} mét. Vui lòng đến gần hiện trường hơn để xác nhận.`);
    return distance;
  }
  // helper nội bộ
  private async requireAlert(id: string): Promise<IAlert> {
    if (!mongoose.isValidObjectId(id))
      throw new NotFoundError("Sự cố không tồn tại");
    const alert = await alertRepository.findById(id);
    if (!alert) throw new NotFoundError("Sự cố không tồn tại");
    return alert;
  }

  private checkRole(actor: WorkflowActor, roles: WorkflowActorRole[]) {
    //  kiểm tra role do api gateway chuyển vào trước khi xử lý nghiệp vụ nhạy cảm
    if (!roles.includes(normRole(actor.role))) {
      throw new ForbiddenError("Không có quyền thực hiện hành động này");
    }
  }

  private checkAssignedOfficer(alert: IAlert, actor: WorkflowActor) {
    this.checkRole(actor, ["OFFICER"]);
    if (alert.assignedOfficerId !== actor.id) {
      throw new ForbiddenError("Sự cố không được phân công cho bạn");
    }
  }

  private makeHistory(
    from: AlertStatus | undefined,
    to: AlertStatus,
    actor: WorkflowActor,
    note?: string,
  ) {
    return {
      fromStatus: from,
      toStatus: to,
      changedBy: actor.id,
      changedByRole: normRole(actor.role),
      changedAt: new Date(),
      note,
      correlationId: actor.correlationId,
    };
  }

  private makeTimeline(
    type: string,
    label: string,
    actor: WorkflowActor,
    opts: Record<string, unknown> = {},
  ) {
    return {
      eventType: type,
      label,
      timestamp: new Date(),
      actorId: actor.id,
      actorRole: normRole(actor.role),
      correlationId: actor.correlationId,
      ...opts,
    };
  }

  private async emitEvent(
    eventName: string,
    alert: IAlert,
    actor: WorkflowActor,
    extra = {},
  ) {
    const payload = {
      alertId: alert._id.toString(),
      title: alert.title,
      citizenId: alert.citizenId,
      assignedOfficerId: alert.assignedOfficerId,
      status: alert.status,
      actorId: actor.id,
      actorRole: normRole(actor.role),
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
  async createAlert(actor: WorkflowActor, data: CreateAlertDto) {
    this.checkRole(actor, ["CITIZEN"]);
    const createdAt = new Date();
    const {
      classification: citizenClassification,
      imageValidation,
      captureMetadata,
      fieldEvidence,
      ...alertData
    } = data;
    // trích xuất danh mục và thiết lập thông tin phân loại ban đầu cho sự cố
    const categories = Array.from(new Set(data.categories || []));
    const primaryCategory = citizenClassification?.selectedCategory || data.category || categories[0];
    const category = primaryCategory || "UNCLASSIFIED";
    const classification: IAlertClassification = {
      status:
        !primaryCategory
          ? "UNCLASSIFIED"
          : citizenClassification?.decision === "CONFIRM"
            ? "USER_CONFIRMED"
            : "USER_CORRECTED",
      finalCategory: primaryCategory ?? null,
      finalCategorySource: primaryCategory ? "CITIZEN" : null,
      citizenSelectedCategory: primaryCategory ?? null,
      citizenDecisionAt: primaryCategory ? createdAt : null,
      confirmedBy: primaryCategory ? actor.id : null,
      confirmedAt: primaryCategory ? createdAt : null,
      aiSuggestedCategory: imageValidation?.suggestedCategory ?? null,
      aiConfidence: imageValidation?.confidence ?? null,
      aiReason: imageValidation?.reason ?? null,
    };
    const storedImageValidation: IImageValidation | undefined = imageValidation
      ? {
          ...imageValidation,
          validatedAt: new Date(imageValidation.validatedAt),
        }
      : undefined;
    const storedCaptureMetadata = captureMetadata
      ? {
          ...captureMetadata,
          capturedAt: new Date(captureMetadata.capturedAt),
        }
      : undefined;
    const storedFieldEvidence = fieldEvidence?.map((item) => ({
      ...item,
      capturedAt: new Date(item.capturedAt),
    }));
    const alert = await alertRepository.create({
      ...alertData,
      category,
      categories,
      classification,
      ...(storedImageValidation
        ? { imageValidation: storedImageValidation }
        : {}),
      ...(storedCaptureMetadata ? { captureMetadata: storedCaptureMetadata } : {}),
      ...(storedFieldEvidence ? { fieldEvidence: storedFieldEvidence } : {}),
      severity: (data.severity as Severity) || Severity.LOW,
      citizenId: actor.id,
      status: AlertStatus.PENDING,
      aiAnalysisStatus: 'PROCESSING',
      isAnonymous: Boolean(data.isAnonymous),
      confirmationsCount: 1,
      confirmations: [{ citizenId: actor.id, confirmedAt: createdAt }],
      createdBy: actor.id,
      statusHistory: [this.makeHistory(undefined, AlertStatus.PENDING, actor)],
      timeline: [
        this.makeTimeline(
          "INCIDENT_REPORTED",
          "Báo cáo sự cố được tạo",
          actor,
          { status: AlertStatus.PENDING },
        ),
      ],
    });

    // worker ai nhận dữ liệu minh chứng đã lưu và thực hiện phân tích sự cố
    await rabbitMQService.publishEvent(EVENTS.ALERT_CREATED, alert);
    return alert;
  }

  // citizen sửa báo cáo của mình khi đang chờ xử lý, admin sửa mọi báo cáo
  async updateAlert(id: string, actor: WorkflowActor, data: UpdateAlertDto) {
    const alert = await this.requireAlert(id);
    const role = normRole(actor.role);

    if (role === "CITIZEN") {
      if (alert.citizenId !== actor.id)
        throw new ForbiddenError("Chỉ sửa được báo cáo của mình");
      if (normStatus(alert.status) !== AlertStatus.PENDING)
        throw new ConflictError("Báo cáo đã duyệt không thể sửa");
    } else if (role !== "ADMIN") {
      throw new ForbiddenError("Không có quyền sửa báo cáo");
    }

    const updated = await alertRepository.update(id, {
      ...data,
      updatedBy: actor.id,
    });
    if (!updated) throw new NotFoundError("Không tìm thấy sự cố để cập nhật");
    await rabbitMQService.publishEvent(
      EVENTS.ALERT_UPDATED,
      updated,
      actor.correlationId,
    );
    return updated;
  }

  // citizen xóa báo cáo của mình khi đang chờ xử lý, admin xóa mọi báo cáo
  async deleteAlert(id: string, actor: WorkflowActor) {
    const alert = await this.requireAlert(id);
    const role = normRole(actor.role);

    if (role === "CITIZEN") {
      if (alert.citizenId !== actor.id)
        throw new ForbiddenError("Chỉ xóa được báo cáo của mình");
      if (normStatus(alert.status) !== AlertStatus.PENDING)
        throw new ConflictError("Báo cáo đã xử lý không thể xóa");
    } else if (role !== "ADMIN") {
      throw new ForbiddenError("Không có quyền xóa báo cáo");
    }

    await alertRepository.softDelete(id, actor.id);
    await rabbitMQService.publishEvent(
      EVENTS.ALERT_UPDATED,
      { _id: alert._id, status: "deleted", isDeleted: true },
      actor.correlationId,
    );
    return true;
  }

  // citizen xem báo cáo của mình, admin xem tất cả báo cáo
  async getAlerts(
    page: number,
    limit: number,
    citizenId?: string,
    filters: { status?: string; category?: string; severity?: string } = {},
  ) {
    const filter: Record<string, unknown> = {};
    if (citizenId) filter.citizenId = citizenId;
    if (filters.status) filter.status = new RegExp(`^${filters.status}$`, "i");
    if (filters.category)
      filter.category = new RegExp(`^${filters.category}$`, "i");
    if (filters.severity)
      filter.severity = new RegExp(`^${filters.severity}$`, "i");
    return alertRepository.findPaginated(filter, (page - 1) * limit, limit);
  }

  // citizen, officer và admin xem chi tiết báo cáo theo quyền truy cập
  async getAlertById(id: string, actor: WorkflowActor) {
    const alert = await this.requireAlert(id);
    const role = normRole(actor.role);
    if (
      role === "ADMIN" ||
      (role === "CITIZEN" && alert.citizenId === actor.id) ||
      (role === "OFFICER" && alert.assignedOfficerId === actor.id)
    ) {
      return alert;
    }
    throw new ForbiddenError("Không có quyền xem sự cố này");
  }

  // admin duyệt hoặc từ chối báo cáo
  async updateStatus(
    id: string,
    actor: WorkflowActor,
    data: UpdateAlertStatusDto,
  ) {
    this.checkRole(actor, ["ADMIN"]);
    const alert = await this.requireAlert(id);
    const newStatus = normStatus(data.status);

    const updated = await alertRepository.findOneAndUpdate(
      { _id: id, status: new RegExp(`^${alert.status}$`, "i") },
      {
        $set: { status: newStatus, updatedBy: actor.id },
        $push: {
          statusHistory: this.makeHistory(alert.status, newStatus, actor),
          timeline: this.makeTimeline(
            newStatus === AlertStatus.REJECTED
              ? "INCIDENT_REJECTED"
              : "INCIDENT_VERIFIED",
            `Admin ${newStatus}`,
            actor,
            { status: newStatus },
          ),
        },
      },
    );
    if (!updated) throw new ConflictError("Trạng thái đã thay đổi");
    await this.emitEvent(EVENTS.ALERT_UPDATED, updated, actor);
    return updated;
  }

  // admin xác nhận hoặc chỉnh sửa danh mục sự cố
  async reviewClassification(
    id: string,
    actor: WorkflowActor,
    data: ReviewClassificationDto,
  ) {
    // chỉ admin được xác nhận hoặc sửa category và hệ thống lưu nguồn quyết định
    this.checkRole(actor, ["ADMIN"]);
    const alert = await this.requireAlert(id);
    const finalCategory = data.category || alert.category;

    const updated = await alertRepository.findOneAndUpdate(
      { _id: id },
      {
        $set: { category: finalCategory, updatedBy: actor.id },
        $push: {
          timeline: this.makeTimeline(
            "ADMIN_CLASSIFICATION_CONFIRMED",
            "Admin xác nhận danh mục",
            actor,
            { metadata: { category: finalCategory } },
          ),
        },
      },
    );
    if (!updated) throw new ConflictError("Cập nhật danh mục thất bại");
    await this.emitEvent(EVENTS.ALERT_UPDATED, updated, actor);
    return updated;
  }

  // admin giao báo cáo đã duyệt cho officer
  async assignOfficer(
    id: string,
    actor: WorkflowActor,
    data: AssignOfficerDto,
  ) {
    // chỉ admin phân công alert đã verified; thành công chuyển status sang assigned và phát rabbitmq event
    this.checkRole(actor, ["ADMIN"]);
    const alert = await this.requireAlert(id);
    if (normStatus(alert.status) !== AlertStatus.VERIFIED)
      throw new ConflictError("Chỉ phân công sự cố đã duyệt");

    const officer = await userDirectoryService.requireOfficer(
      data.officerId,
      actor,
    );
    const updated = await alertRepository.findOneAndUpdate(
      { _id: id, status: new RegExp(`^${AlertStatus.VERIFIED}$`, "i") },
      {
        $set: {
          status: AlertStatus.ASSIGNED,
          assignedOfficerId: data.officerId,
          assignedOfficerName: officer.fullName,
          assignedOfficerEmail: officer.email,
          assignedAt: new Date(),
          updatedBy: actor.id,
        },
        $push: {
          statusHistory: this.makeHistory(
            alert.status,
            AlertStatus.ASSIGNED,
            actor,
          ),
          timeline: this.makeTimeline(
            "OFFICER_ASSIGNED",
            "Đã phân công cho cán bộ",
            actor,
            { status: AlertStatus.ASSIGNED },
          ),
        },
      },
    );
    if (!updated) throw new ConflictError("Phân công thất bại");
    await this.emitEvent(EVENTS.OFFICER_ASSIGNED, updated, actor);
    return updated;
  }

  // admin đóng sự cố đã được officer giải quyết
  async closeIncident(id: string, actor: WorkflowActor, data: CloseAlertDto) {
    this.checkRole(actor, ["ADMIN"]);
    const alert = await this.requireAlert(id);
    if (normStatus(alert.status) !== AlertStatus.RESOLVED)
      throw new ConflictError("Chỉ đóng sự cố đã giải quyết");

    const updated = await alertRepository.findOneAndUpdate(
      { _id: id, status: new RegExp(`^${AlertStatus.RESOLVED}$`, "i") },
      {
        $set: {
          status: AlertStatus.CLOSED,
          closedAt: new Date(),
          closedBy: actor.id,
          adminReviewNote: data.reviewNote?.trim(),
          updatedBy: actor.id,
        },
        $push: {
          statusHistory: this.makeHistory(
            AlertStatus.RESOLVED,
            AlertStatus.CLOSED,
            actor,
            data.reviewNote,
          ),
          timeline: this.makeTimeline(
            "INCIDENT_CLOSED",
            "Sự cố đã đóng",
            actor,
            { status: AlertStatus.CLOSED, note: data.reviewNote },
          ),
        },
      },
    );
    if (!updated) throw new ConflictError("Đóng sự cố thất bại");
    await this.emitEvent(EVENTS.ALERT_CLOSED, updated, actor);
    return updated;
  }

  // officer xem các báo cáo được giao cho mình
  async getOfficerTasks(
    actor: WorkflowActor,
    page: number,
    limit: number,
    status?: string,
  ) {
    this.checkRole(actor, ["OFFICER"]);
    const filter: Record<string, unknown> = { assignedOfficerId: actor.id };
    if (status) filter.status = new RegExp(`^${status}$`, "i");
    return alertRepository.findPaginated(filter, (page - 1) * limit, limit);
  }

  // officer bắt đầu xử lý báo cáo được giao
  async startHandling(id: string, actor: WorkflowActor) {
    const alert = await this.requireAlert(id);
    this.checkAssignedOfficer(alert, actor);
    if (normStatus(alert.status) !== AlertStatus.ASSIGNED)
      throw new ConflictError("Sự cố chưa được phân công");

    const updated = await alertRepository.findOneAndUpdate(
      {
        _id: id,
        assignedOfficerId: actor.id,
        status: new RegExp(`^${AlertStatus.ASSIGNED}$`, "i"),
      },
      {
        $set: {
          status: AlertStatus.IN_PROGRESS,
          startedAt: new Date(),
          updatedBy: actor.id,
        },
        $push: {
          statusHistory: this.makeHistory(
            AlertStatus.ASSIGNED,
            AlertStatus.IN_PROGRESS,
            actor,
          ),
          timeline: this.makeTimeline(
            "OFFICER_STARTED_HANDLING",
            "Cán bộ bắt đầu xử lý",
            actor,
            { status: AlertStatus.IN_PROGRESS },
          ),
        },
      },
    );
    if (!updated) throw new ConflictError("Bắt đầu xử lý thất bại");
    await this.emitEvent(EVENTS.ALERT_STARTED, updated, actor);
    return updated;
  }

  // officer xác nhận đã đến hiện trường
  async confirmArrival(
    id: string,
    actor: WorkflowActor,
    data: ConfirmArrivalDto,
  ) {
    const alert = await this.requireAlert(id);
    this.checkAssignedOfficer(alert, actor);
    if (normStatus(alert.status) !== AlertStatus.IN_PROGRESS)
      throw new ConflictError("Sự cố phải đang xử lý để check-in");

    const distance = this.validateFieldLocation(alert, data, envConfig.officerCheckinRadiusMeters);
    const now = new Date();
    const checkIn = {
      officerId: actor.id,
      location: {
        type: "Point" as const,
        coordinates: [data.longitude, data.latitude] as [number, number],
      },
      accuracyMeters: data.accuracyMeters,
      distanceFromIncidentMeters: distance,
      checkedInAt: now,
      verified: true,
    };

    const updated = await alertRepository.findOneAndUpdate(
      {
        _id: id,
        assignedOfficerId: actor.id,
        status: new RegExp(`^${AlertStatus.IN_PROGRESS}$`, "i"),
      },
      {
        $set: { arrivedAt: now, checkIn, updatedBy: actor.id },
        $push: {
          timeline: this.makeTimeline(
            "ARRIVED_ON_SCENE",
            "Cán bộ đã đến hiện trường",
            actor,
            { status: AlertStatus.IN_PROGRESS },
          ),
        },
      },
    );
    if (!updated) throw new ConflictError("Check-in thất bại");
    await this.emitEvent(EVENTS.ALERT_ARRIVED, updated, actor);
    return updated;
  }

  // officer gửi kết quả và minh chứng xử lý sự cố
  async resolveIncident(
    id: string,
    actor: WorkflowActor,
    data: ResolveAlertDto,
  ) {
    const alert = await this.requireAlert(id);
    this.checkAssignedOfficer(alert, actor);
    if (normStatus(alert.status) !== AlertStatus.IN_PROGRESS)
      throw new ConflictError("Sự cố phải đang xử lý");

    if (!alert.checkIn?.verified || alert.checkIn.officerId !== actor.id)
      throw new ConflictError(
        "Cần xác nhận đã đến hiện trường trước khi hoàn thành xử lý.",
      );
    if (!data.evidence?.length)
      throw new BadRequestError("Cần ít nhất một ảnh sau xử lý.");
    if (!data.resolutionSummary?.trim() || !data.treatmentMethod?.trim())
      throw new BadRequestError("Tóm tắt và phương pháp xử lý là bắt buộc.");
    const now = new Date();
    const evidence = data.evidence.map((e) => {
      if (!e.location)
        throw new BadRequestError(
          "Ảnh sau xử lý cần GPS hiện trường. Vui lòng chụp lại.",
        );
      const distance = this.validateFieldLocation(
        alert,
        e.location,
        envConfig.officerEvidenceRadiusMeters,
      );
      const capturedAt = e.capturedAt ? new Date(e.capturedAt) : undefined;
      if (capturedAt && !Number.isFinite(capturedAt.getTime()))
        throw new BadRequestError("Thời điểm chụp ảnh không hợp lệ.");
      return {
        mediaId: e.mediaId,
        url: e.url,
        uploadedBy: actor.id,
        uploadedAt: now,
        capturedAt,
        type: "AFTER_TREATMENT" as const,
        location: {
          type: "Point" as const,
          coordinates: [e.location.longitude, e.location.latitude] as [number, number],
        },
        accuracyMeters: e.location.accuracyMeters,
        distanceFromIncidentMeters: distance,
      };
    });
    const evidenceUrls = evidence.map((e) => e.url);

    const updated = await alertRepository.findOneAndUpdate(
      {
        _id: id,
        assignedOfficerId: actor.id,
        status: new RegExp(`^${AlertStatus.IN_PROGRESS}$`, "i"),
        "checkIn.verified": true,
        "checkIn.officerId": actor.id,
      },
      {
        $set: {
          status: AlertStatus.RESOLVED,
          resolvedAt: now,
          resolvedBy: actor.id,
          resolutionSummary: data.resolutionSummary.trim(),
          treatmentMethod: data.treatmentMethod.trim(),
          materialsUsed: data.materialsUsed?.trim(),
          resolutionNotes: data.additionalNotes?.trim(),
          resolutionEvidence: evidence,
          updatedBy: actor.id,
        },
        $push: {
          statusHistory: this.makeHistory(
            AlertStatus.IN_PROGRESS,
            AlertStatus.RESOLVED,
            actor,
            data.resolutionSummary,
          ),
          timeline: this.makeTimeline(
            "INCIDENT_RESOLVED",
            "Sự cố đã giải quyết",
            actor,
            { status: AlertStatus.RESOLVED, evidenceUrls },
          ),
        },
      },
    );
    if (!updated) throw new ConflictError("Hoàn tất xử lý thất bại");
    await this.emitEvent(EVENTS.ALERT_RESOLVED, updated, actor, {
      evidenceUrls,
    });
    return updated;
  }

  // system nhận kết quả ai
  async internalUpdateAiResult(id: string, analysis: IAiAnalysisCompletedData) {
    if (!mongoose.isValidObjectId(id)) return null;
    const alert = await alertRepository.findById(id);
    if (!alert || alert.aiAnalysisId === analysis.analysisId) return alert;

    const displayConfidence = resolveOverallAiConfidence({
      analysisMode: analysis.analysisMode,
      confidence: analysis.confidence,
      overallAnalysis: analysis.overallAnalysis,
    });

    const updated = await alertRepository.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          status: alert.status,
          category: analysis.category || alert.category,
          severity: analysis.severity || alert.severity,
          aiConfidence: displayConfidence.value,
          aiSummary:
            analysis.overallAnalysis?.overallSummary ?? analysis.summary,
          aiReasoningSummary:
            analysis.overallAnalysis?.shortReason ?? analysis.reasoningSummary,
          // lưu thông tin phân tích ai và dữ liệu nhận diện thị giác vào cơ sở dữ liệu
          aiAnalysisMode: analysis.analysisMode,
          analysisPipeline: analysis.analysisPipeline,
          ...(analysis.visionEvidence ? { visionEvidence: analysis.visionEvidence } : {}),
          aiAnalysisStatus: analysis.analysisMode === 'FAILED' ? 'FAILED' : 'COMPLETED',
          aiAnalysisProvider: analysis.provider,
          aiAnalysisModel: analysis.model,
          aiFailureReason: analysis.failureReason || null,
          aiPipelineVersion: analysis.pipelineVersion,
          aiOverallAnalysis: analysis.overallAnalysis,
          aiAnalysisId: analysis.analysisId,
          aiAnalyzedAt: new Date(),
        },
        $push: {
          timeline: this.makeTimeline(
            "AI_ANALYSIS_COMPLETED",
            "AI hoàn tất phân tích",
            { id: "ai-service", role: "SYSTEM" },
            {
              status: alert.status,
              note: `Độ tin cậy: ${Math.round((displayConfidence.value || 0) * 100)}%`,
            },
          ),
        },
      },
    );

    if (updated)
      await rabbitMQService.publishEvent(EVENTS.ALERT_UPDATED, updated);
    return updated;
  }

  // admin khôi phục sự cố đã xóa mềm
  async restoreAlert(id: string, actor: WorkflowActor) {
    this.checkRole(actor, ["ADMIN"]);
    if (!mongoose.isValidObjectId(id))
      throw new NotFoundError("Sự cố không tồn tại");
    const alert = await alertRepository.findOne({
      _id: id,
      includeDeleted: true,
    } as never);
    if (!alert) throw new NotFoundError("Sự cố không tồn tại");

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

  // officer ghi chú báo cáo được giao, admin ghi chú mọi báo cáo
  async addOfficerNote(
    id: string,
    actor: WorkflowActor,
    data: AddOfficerNoteDto,
  ) {
    const alert = await this.requireAlert(id);
    const role = normRole(actor.role);
    if (role === "OFFICER" && alert.assignedOfficerId !== actor.id)
      throw new ForbiddenError("Sự cố không được phân công cho bạn");
    if (role !== "OFFICER" && role !== "ADMIN")
      throw new ForbiddenError("Không có quyền thêm ghi chú");

    const updated = await alertRepository.update(id, {
      officerNote: data.note.trim(),
      updatedBy: actor.id,
    });
    if (!updated) throw new NotFoundError("Sự cố không tồn tại");
    await rabbitMQService.publishEvent(
      EVENTS.ALERT_UPDATED,
      updated,
      actor.correlationId,
    );
    return updated;
  }

  // citizen, officer và admin tìm các sự cố lân cận
  async checkNearbyAlerts(
    longitude: number,
    latitude: number,
    radiusMeters = 200,
  ) {
    return alertRepository.findNearby(longitude, latitude, radiusMeters);
  }

  // citizen xác nhận cũng nhìn thấy sự cố
  async confirmAlert(id: string, citizenId: string) {
    const alert = await this.requireAlert(id);
    if (alert.confirmations?.some((item) => item.citizenId === citizenId))
      return alert;

    const updated = await alertRepository.findOneAndUpdate(
      { _id: id, "confirmations.citizenId": { $ne: citizenId } },
      {
        $inc: { confirmationsCount: 1 },
        $push: { confirmations: { citizenId, confirmedAt: new Date() } },
      },
    );
    if (updated)
      await rabbitMQService.publishEvent(EVENTS.ALERT_UPDATED, updated);
    return updated || alert;
  }
}

export const alertService = new AlertService();
