import mongoose from 'mongoose';
import {
  AddOfficerNoteDto,
  AssignOfficerDto,
  CloseAlertDto,
  ConfirmArrivalDto,
  CreateAlertDto,
  ResolveAlertDto,
  UpdateAlertDto,
  UpdateAlertStatusDto,
} from '../dtos/alert.dto';
import { IAlert, ITimelineEntry, IStatusHistoryEntry, WorkflowActorRole } from '../models/alert.model';
import { alertRepository } from '../repositories/alert.repository';
import {
  AlertCategory,
  AlertStatus,
  BadRequestError,
  ConflictError,
  EVENTS,
  ForbiddenError,
  IAiAnalysisCompletedData,
  NotFoundError,
  Severity,
} from '@ecoalert/shared';
import { rabbitMQService } from './rabbitmq.service';
import { userDirectoryService } from './user-directory.service';

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
  (role || '').toUpperCase() as WorkflowActorRole;

const normalizeStatus = (status?: string): AlertStatus =>
  (status || '').toLowerCase() as AlertStatus;

const statusFilter = (status: AlertStatus) => ({
  $regex: new RegExp(`^${status}$`, 'i'),
});

export class AlertService {
  private ensureValidId(id: string) {
    if (!mongoose.isValidObjectId(id)) {
      throw new NotFoundError('Alert not found');
    }
  }

  private async requireAlert(id: string): Promise<IAlert> {
    this.ensureValidId(id);
    const alert = await alertRepository.findById(id);
    if (!alert) throw new NotFoundError('Alert not found');
    return alert;
  }

  private requireRole(actor: WorkflowActor, allowedRoles: WorkflowActorRole[]) {
    if (!allowedRoles.includes(normalizeRole(actor.role))) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
  }

  private requireAssignedOfficer(alert: IAlert, actor: WorkflowActor) {
    this.requireRole(actor, ['OFFICER']);
    if (!alert.assignedOfficerId || alert.assignedOfficerId !== actor.id) {
      throw new ForbiddenError('This incident is not assigned to you');
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
    options: Pick<ITimelineEntry, 'note' | 'status' | 'evidenceUrls'> = {},
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

  async createAlert(citizenId: string, data: CreateAlertDto) {
    const createdAt = new Date();
    const actor: WorkflowActor = { id: citizenId, role: 'CITIZEN' };

    // Prevent duplicate report creation within 10 seconds for the same citizen
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
      ...data,
      category: (data.category as AlertCategory) || 'UNCLASSIFIED',
      severity: (data.severity as Severity) || Severity.LOW,
      citizenId,
      status: AlertStatus.PENDING,
      isAnonymous: data.isAnonymous || false,
      confirmationsCount: 1,
      confirmations: [{ citizenId, confirmedAt: createdAt }],
      createdBy: citizenId,
      statusHistory: [this.historyEntry(undefined, AlertStatus.PENDING, actor, createdAt)],
      timeline: [this.timelineEntry(
        'INCIDENT_REPORTED',
        'Incident reported',
        actor,
        createdAt,
        { status: AlertStatus.PENDING },
      )],
    });

    await rabbitMQService.publishEvent(EVENTS.ALERT_CREATED, alert);
    return alert;
  }

  async getAlerts(
    page: number,
    limit: number,
    citizenId?: string,
    filters: { status?: string; category?: string; severity?: string; isDeleted?: string } = {},
  ) {
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};

    if (citizenId) filter.citizenId = citizenId;
    if (filters.isDeleted === 'true' || filters.status === 'deleted') {
      filter.includeDeleted = true;
      filter.isDeleted = true;
    } else if (filters.status) {
      const statusList = filters.status
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statusList.length > 1) {
        filter.status = { $in: statusList.map((s) => new RegExp(`^${s}$`, 'i')) };
      } else if (filters.status.toLowerCase() === 'pending') {
        filter.status = { $in: [new RegExp('^pending$', 'i'), new RegExp('^ai_analyzing$', 'i')] };
      } else {
        filter.status = { $regex: new RegExp(`^${filters.status}$`, 'i') };
      }
    }
    if (filters.category) filter.category = { $regex: new RegExp(`^${filters.category}$`, 'i') };
    if (filters.severity) filter.severity = { $regex: new RegExp(`^${filters.severity}$`, 'i') };

    return alertRepository.findPaginated(filter, skip, limit);
  }

  async getOfficerTasks(
    actor: WorkflowActor,
    page: number,
    limit: number,
    status?: string,
  ) {
    this.requireRole(actor, ['OFFICER']);
    const filter: Record<string, unknown> = { assignedOfficerId: actor.id };
    if (status) {
      const normalizedStatus = normalizeStatus(status);
      if (![AlertStatus.ASSIGNED, AlertStatus.IN_PROGRESS, AlertStatus.RESOLVED, AlertStatus.CLOSED].includes(normalizedStatus)) {
        throw new BadRequestError('Unsupported Officer task status filter');
      }
      filter.status = statusFilter(normalizedStatus);
    }
    return alertRepository.findPaginated(filter, (page - 1) * limit, limit);
  }

  async getAlertById(id: string, actor: WorkflowActor) {
    const alert = await this.requireAlert(id);
    const role = normalizeRole(actor.role);

    if (role === 'ADMIN') return alert;
    if (role === 'CITIZEN' && alert.citizenId === actor.id) return alert;
    if (role === 'OFFICER' && alert.assignedOfficerId === actor.id) return alert;

    throw new ForbiddenError('You do not have access to this incident');
  }

  async assignOfficer(id: string, actor: WorkflowActor, data: AssignOfficerDto) {
    this.requireRole(actor, ['ADMIN']);
    const alert = await this.requireAlert(id);
    const currentStatus = normalizeStatus(alert.status);
    if (![AlertStatus.PENDING, AlertStatus.VERIFIED, AlertStatus.AI_ANALYZING].includes(currentStatus)) {
      throw new ConflictError('Only a pending, AI-analyzing, or verified incident can be assigned');
    }
    if (!mongoose.isValidObjectId(data.officerId)) {
      throw new NotFoundError('Officer not found');
    }
    await userDirectoryService.requireOfficer(data.officerId, actor);

    const assignedAt = new Date();
    const updatedAlert = await alertRepository.findOneAndUpdate(
      { _id: id, status: statusFilter(currentStatus) },
      {
        $set: {
          status: AlertStatus.ASSIGNED,
          assignedOfficerId: data.officerId,
          assignedAt,
          assignedBy: actor.id,
          updatedBy: actor.id,
        },
        $push: {
          statusHistory: this.historyEntry(currentStatus, AlertStatus.ASSIGNED, actor, assignedAt),
          timeline: this.timelineEntry(
            'OFFICER_ASSIGNED',
            'Incident assigned to Officer',
            actor,
            assignedAt,
            { status: AlertStatus.ASSIGNED },
          ),
        },
      },
    );
    if (!updatedAlert) throw new ConflictError('Incident assignment changed. Refresh and try again');

    await this.publishWorkflowEvent(EVENTS.OFFICER_ASSIGNED, updatedAlert, actor);
    return updatedAlert;
  }

  async startHandling(id: string, actor: WorkflowActor) {
    const alert = await this.requireAlert(id);
    this.requireAssignedOfficer(alert, actor);
    if (normalizeStatus(alert.status) !== AlertStatus.ASSIGNED) {
      throw new ConflictError('Only an assigned incident can be started');
    }

    const startedAt = new Date();
    const updatedAlert = await alertRepository.findOneAndUpdate(
      { _id: id, assignedOfficerId: actor.id, status: statusFilter(AlertStatus.ASSIGNED) },
      {
        $set: {
          status: AlertStatus.IN_PROGRESS,
          startedAt,
          startedBy: actor.id,
          updatedBy: actor.id,
        },
        $push: {
          statusHistory: this.historyEntry(AlertStatus.ASSIGNED, AlertStatus.IN_PROGRESS, actor, startedAt),
          timeline: this.timelineEntry(
            'OFFICER_STARTED_HANDLING',
            'Officer started handling',
            actor,
            startedAt,
            { status: AlertStatus.IN_PROGRESS },
          ),
        },
      },
    );
    if (!updatedAlert) throw new ConflictError('Incident status changed. Refresh and try again');

    await this.publishWorkflowEvent(EVENTS.ALERT_STARTED, updatedAlert, actor);
    return updatedAlert;
  }

  async confirmArrival(id: string, actor: WorkflowActor, data: ConfirmArrivalDto) {
    const alert = await this.requireAlert(id);
    this.requireAssignedOfficer(alert, actor);
    if (normalizeStatus(alert.status) !== AlertStatus.IN_PROGRESS) {
      throw new ConflictError('Arrival can only be confirmed for an incident in progress');
    }
    if (alert.arrivedAt) {
      throw new ConflictError('Arrival has already been confirmed');
    }

    const arrivedAt = new Date();
    const arrivalLocation = data.latitude !== undefined && data.longitude !== undefined
      ? { latitude: data.latitude, longitude: data.longitude, accuracy: data.accuracy }
      : undefined;
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
          ...(arrivalLocation ? { arrivalLocation } : {}),
          updatedBy: actor.id,
        },
        $push: {
          timeline: this.timelineEntry(
            'ARRIVED_ON_SCENE',
            'Officer arrived at the scene',
            actor,
            arrivedAt,
            { status: AlertStatus.IN_PROGRESS },
          ),
        },
      },
    );
    if (!updatedAlert) throw new ConflictError('Arrival was already confirmed or the incident status changed');

    await this.publishWorkflowEvent(EVENTS.ALERT_ARRIVED, updatedAlert, actor);
    return updatedAlert;
  }

  async resolveIncident(id: string, actor: WorkflowActor, data: ResolveAlertDto) {
    const alert = await this.requireAlert(id);
    this.requireAssignedOfficer(alert, actor);
    if (normalizeStatus(alert.status) !== AlertStatus.IN_PROGRESS) {
      throw new ConflictError('Only an incident in progress can be resolved');
    }
    if (!alert.arrivedAt) {
      throw new ConflictError('Confirm arrival before resolving this incident');
    }

    const resolvedAt = new Date();
    const evidence = data.evidence.map((item) => ({
      ...item,
      uploadedBy: actor.id,
      uploadedAt: resolvedAt,
      type: 'AFTER_TREATMENT' as const,
    }));
    const evidenceUrls = evidence.map((item) => item.url);

    const updatedAlert = await alertRepository.findOneAndUpdate(
      {
        _id: id,
        assignedOfficerId: actor.id,
        status: statusFilter(AlertStatus.IN_PROGRESS),
        arrivedAt: { $ne: null },
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
                'RESOLUTION_EVIDENCE_UPLOADED',
                'After-treatment evidence uploaded',
                actor,
                resolvedAt,
                { status: AlertStatus.IN_PROGRESS, evidenceUrls },
              ),
              this.timelineEntry(
                'INCIDENT_RESOLVED',
                'Incident marked as Resolved',
                actor,
                resolvedAt,
                { status: AlertStatus.RESOLVED, note: data.resolutionSummary, evidenceUrls },
              ),
            ],
          },
        },
      },
    );
    if (!updatedAlert) throw new ConflictError('Incident status changed. Refresh and try again');

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
    await this.publishWorkflowEvent(EVENTS.ALERT_RESOLVED, updatedAlert, actor, { evidenceUrls });
    return updatedAlert;
  }

  async closeIncident(id: string, actor: WorkflowActor, data: CloseAlertDto) {
    this.requireRole(actor, ['ADMIN']);
    const alert = await this.requireAlert(id);
    if (normalizeStatus(alert.status) !== AlertStatus.RESOLVED) {
      throw new ConflictError('Only a resolved incident can be closed');
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
            'INCIDENT_CLOSED',
            'Incident Closed by Admin',
            actor,
            closedAt,
            { status: AlertStatus.CLOSED, note: data.reviewNote },
          ),
        },
      },
    );
    if (!updatedAlert) throw new ConflictError('Incident status changed. Refresh and try again');

    await this.publishWorkflowEvent(EVENTS.ALERT_CLOSED, updatedAlert, actor);
    return updatedAlert;
  }

  async updateStatus(id: string, actor: WorkflowActor, data: UpdateAlertStatusDto) {
    this.requireRole(actor, ['OFFICER', 'ADMIN']);
    const alert = await this.requireAlert(id);
    const currentStatus = normalizeStatus(alert.status);
    const newStatus = normalizeStatus(data.status);
    const allowedNext = LEGACY_REVIEW_TRANSITIONS[currentStatus] || [];

    if (!allowedNext.includes(newStatus)) {
      throw new ConflictError(
        'Use the assignment, start, arrival, resolution, or close action for workflow status changes',
      );
    }

    const changedAt = new Date();
    const updatedAlert = await alertRepository.findOneAndUpdate(
      { _id: id, status: statusFilter(currentStatus) },
      {
        $set: { status: newStatus, updatedBy: actor.id },
        $push: {
          statusHistory: this.historyEntry(currentStatus, newStatus, actor, changedAt),
          timeline: this.timelineEntry(
            newStatus === AlertStatus.REJECTED ? 'INCIDENT_REJECTED' : 'INCIDENT_VERIFIED',
            newStatus === AlertStatus.REJECTED ? 'Incident rejected' : 'Incident verified',
            actor,
            changedAt,
            { status: newStatus },
          ),
        },
      },
    );
    if (!updatedAlert) throw new ConflictError('Incident status changed. Refresh and try again');
    await rabbitMQService.publishEvent(EVENTS.ALERT_UPDATED, updatedAlert, actor.correlationId);
    return updatedAlert;
  }

  async internalUpdateAiResult(id: string, analysis: IAiAnalysisCompletedData) {
    if (!mongoose.isValidObjectId(id)) return null;
    const alert = await alertRepository.findById(id);
    if (!alert) return null;
    if (alert.aiAnalysisId === analysis.analysisId) return alert;

    const currentStatus = normalizeStatus(alert.status);
    // Tính năng an toàn: Đòi hỏi độ tự tin > 85% mới duyệt tự động
    const newStatus = analysis.confidence > 0.85
      ? AlertStatus.VERIFIED
      : AlertStatus.AI_ANALYZING;
    const analyzedAt = new Date();
    const actor: WorkflowActor = { id: 'ai-service', role: 'SYSTEM' };
    
    const update: Record<string, unknown> = {
      $set: {
        category: analysis.category,
        aiConfidence: analysis.confidence,
        aiSuggestedPriority: analysis.severity,
        // 👇 THÊM DÒNG NÀY ĐỂ GHI NHẬN MỨC ĐỘ NGHIÊM TRỌNG TỪ AI 👇
        severity: analysis.severity,
        aiSummary: analysis.summary,
        aiReasoningSummary: analysis.reasoningSummary,
        aiAnalysisMode: analysis.analysisMode,
        aiAnalysisProvider: analysis.provider,
        aiAnalysisModel: analysis.model,
        aiAnalysisId: analysis.analysisId,
        aiAnalyzedAt: analyzedAt,
        status: newStatus,
      },
      $push: {
        timeline: this.timelineEntry(
          'AI_ANALYSIS_COMPLETED',
          'AI analysis completed',
          actor,
          analyzedAt,
          {
            status: newStatus,
            note: `Confidence: ${Math.round(analysis.confidence * 100)}%`,
          },
        ),
        ...(currentStatus !== newStatus
          ? { statusHistory: this.historyEntry(currentStatus, newStatus, actor, analyzedAt) }
          : {}),
      },
    };
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
      if (existingAlert?.aiAnalysisId === analysis.analysisId) return existingAlert;
    }
    if (updatedAlert) await rabbitMQService.publishEvent(EVENTS.ALERT_UPDATED, updatedAlert);
    return updatedAlert;
  }

  async deleteAlert(id: string, actor: WorkflowActor) {
    const alert = await this.requireAlert(id);
    const role = normalizeRole(actor.role);
    if (role === 'OFFICER') throw new ForbiddenError('Officers cannot delete incidents');
    if (role === 'CITIZEN') {
      if (alert.citizenId !== actor.id) throw new ForbiddenError('You can only delete your own alerts');
      if (![AlertStatus.PENDING, AlertStatus.AI_ANALYZING].includes(normalizeStatus(alert.status))) {
        throw new ConflictError('This incident can no longer be deleted');
      }
    } else if (role !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to delete incidents');
    }
    const success = await alertRepository.softDelete(id, actor.id);
    if (!success) throw new NotFoundError('Alert not found');
    return true;
  }

  async restoreAlert(id: string, actor: WorkflowActor) {
    this.requireRole(actor, ['ADMIN']);
    this.ensureValidId(id);
    const alert = await alertRepository.findOne({ _id: id, includeDeleted: true } as never);
    if (!alert) throw new NotFoundError('Alert not found');
    alert.isDeleted = false;
    alert.deletedAt = null as never;
    alert.updatedBy = actor.id;
    await alert.save();
    await rabbitMQService.publishEvent(EVENTS.ALERT_UPDATED, alert, actor.correlationId);
    return alert;
  }

  async updateAlert(id: string, actor: WorkflowActor, data: UpdateAlertDto) {
    const alert = await this.requireAlert(id);
    const role = normalizeRole(actor.role);
    if (role === 'OFFICER') throw new ForbiddenError('Officers cannot edit incident details');
    if (role === 'CITIZEN') {
      if (alert.citizenId !== actor.id) throw new ForbiddenError('You can only update your own alerts');
      if (![AlertStatus.PENDING, AlertStatus.AI_ANALYZING].includes(normalizeStatus(alert.status))) {
        throw new ConflictError('Cannot edit an incident once it is verified or processed');
      }
    } else if (role !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to edit incidents');
    }

    const updatedAlert = await alertRepository.update(id, { ...data, updatedBy: actor.id });
    if (!updatedAlert) throw new NotFoundError('Alert not found during update');
    await rabbitMQService.publishEvent(EVENTS.ALERT_UPDATED, updatedAlert, actor.correlationId);
    return updatedAlert;
  }

  async addOfficerNote(id: string, actor: WorkflowActor, data: AddOfficerNoteDto) {
    const alert = await this.requireAlert(id);
    const role = normalizeRole(actor.role);
    if (role === 'OFFICER' && alert.assignedOfficerId !== actor.id) {
      throw new ForbiddenError('This incident is not assigned to you');
    }
    if (!['OFFICER', 'ADMIN'].includes(role)) {
      throw new ForbiddenError('Only officers and admins can add notes');
    }
    const updatedAlert = await alertRepository.update(id, {
      officerNote: data.note.trim(),
      updatedBy: actor.id,
    });
    if (!updatedAlert) throw new NotFoundError('Alert not found during update');
    await rabbitMQService.publishEvent(EVENTS.ALERT_UPDATED, updatedAlert, actor.correlationId);
    return updatedAlert;
  }

  async checkNearbyAlerts(longitude: number, latitude: number, radiusMeters: number = 200) {
    return alertRepository.findNearby(longitude, latitude, radiusMeters);
  }

  async confirmAlert(id: string, citizenId: string) {
    const alert = await this.requireAlert(id);
    const hasAlreadyConfirmed = alert.confirmations?.some((c) => c.citizenId === citizenId);
    if (hasAlreadyConfirmed) {
      return alert;
    }

    const updatedAlert = await alertRepository.findOneAndUpdate(
      { _id: id },
      {
        $inc: { confirmationsCount: 1 },
        $push: { confirmations: { citizenId, confirmedAt: new Date() } },
      }
    );

    if (updatedAlert) {
      await rabbitMQService.publishEvent(EVENTS.ALERT_UPDATED, updatedAlert);
    }
    return updatedAlert || alert;
  }
}

export const alertService = new AlertService();
