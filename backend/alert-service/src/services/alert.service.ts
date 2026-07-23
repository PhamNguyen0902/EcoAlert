import { alertRepository } from '../repositories/alert.repository';
import { CreateAlertDto, UpdateAlertStatusDto, UpdateAlertDto, AddOfficerNoteDto } from '../dtos/alert.dto';
import { NotFoundError, BadRequestError, ForbiddenError, AlertStatus, Severity, EVENTS } from '@ecoalert/shared';
import { rabbitMQService } from './rabbitmq.service';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  [AlertStatus.PENDING]: [AlertStatus.AI_ANALYZING, AlertStatus.VERIFIED, AlertStatus.REJECTED],
  [AlertStatus.AI_ANALYZING]: [AlertStatus.VERIFIED, AlertStatus.REJECTED],
  [AlertStatus.VERIFIED]: [AlertStatus.ASSIGNED, AlertStatus.REJECTED],
  [AlertStatus.ASSIGNED]: [AlertStatus.IN_PROGRESS, AlertStatus.VERIFIED],
  [AlertStatus.IN_PROGRESS]: [AlertStatus.RESOLVED, AlertStatus.ASSIGNED],
  [AlertStatus.RESOLVED]: [AlertStatus.CLOSED, AlertStatus.IN_PROGRESS],
  [AlertStatus.CLOSED]: [],
  [AlertStatus.REJECTED]: []
};

export class AlertService {
  async createAlert(citizenId: string, data: CreateAlertDto) {
    const alert = await alertRepository.create({
      ...data,
      citizenId,
      status: AlertStatus.PENDING,
      createdBy: citizenId
    });

    // Publish event for AI and GIS services
    await rabbitMQService.publishEvent(EVENTS.ALERT_CREATED, alert);

    return alert;
  }

  async getAlerts(
    page: number,
    limit: number,
    citizenId?: string,
    filters: { status?: string; category?: string; severity?: string } = {}
  ) {
    const skip = (page - 1) * limit;
    const filter: Record<string, any> = {};

    if (citizenId) filter.citizenId = citizenId;

    // Case-insensitive matching to handle both "pending" and "PENDING"
    if (filters.status) {
      filter.status = { $regex: new RegExp(`^${filters.status}$`, 'i') };
    }
    if (filters.category) {
      filter.category = { $regex: new RegExp(`^${filters.category}$`, 'i') };
    }
    if (filters.severity) {
      filter.severity = { $regex: new RegExp(`^${filters.severity}$`, 'i') };
    }

    return alertRepository.findPaginated(filter, skip, limit);
  }

  async getAlertById(id: string) {
    const alert = await alertRepository.findById(id);
    if (!alert) throw new NotFoundError('Alert not found');
    return alert;
  }

  async updateStatus(id: string, updatedBy: string, data: UpdateAlertStatusDto) {
    const alert = await alertRepository.findById(id);
    if (!alert) throw new NotFoundError('Alert not found');

    const currentStatus = alert.status;
    const newStatus = data.status;

    if (currentStatus === newStatus) {
      return alert; // No change
    }

    const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(newStatus)) {
      throw new BadRequestError(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }

    const updatedAlert = await alertRepository.update(id, { 
      status: newStatus,
      updatedBy 
    });

    if (!updatedAlert) throw new NotFoundError('Alert not found during update');
    
    // Publish update event for notifications
    await rabbitMQService.publishEvent(EVENTS.ALERT_UPDATED, updatedAlert);
    
    return updatedAlert;
  }
  
  // This would be called internally or via a webhook from AI service
  async internalUpdateAiResult(id: string, category: string, confidence: number, priority: string) {
    const alert = await alertRepository.findById(id);
    if (!alert) return null;
    
    // Auto transition to VERIFIED if confidence > 0.85, else AI_ANALYZING
    const newStatus = confidence > 0.85 ? AlertStatus.VERIFIED : AlertStatus.AI_ANALYZING;

    const updatedAlert = await alertRepository.update(id, {
      category: category as any,
      aiConfidence: confidence,
      aiSuggestedPriority: priority ? (priority.toLowerCase() as any) : Severity.LOW,
      status: newStatus
    });

    if (updatedAlert) {
      await rabbitMQService.publishEvent(EVENTS.ALERT_UPDATED, updatedAlert);
    }
    
    return updatedAlert;
  }

  async deleteAlert(id: string, deletedBy: string) {
    const success = await alertRepository.softDelete(id, deletedBy);
    if (!success) throw new NotFoundError('Alert not found');
    return true;
  }

  async updateAlert(id: string, userId: string, userRole: string, data: UpdateAlertDto) {
    const alert = await alertRepository.findById(id);
    if (!alert) throw new NotFoundError('Alert not found');

    const statusLower = (alert.status || '').toLowerCase();
    const userRoleUpper = (userRole || '').toUpperCase();

    if (userRoleUpper === 'CITIZEN' || alert.citizenId?.toString() === userId) {
      if (alert.citizenId?.toString() !== userId) {
        throw new BadRequestError('You can only update your own alerts');
      }
      if (!['pending', 'ai_analyzing'].includes(statusLower)) {
        throw new BadRequestError('Cannot edit alert once it is verified or processed');
      }
    }

    const updatedAlert = await alertRepository.update(id, {
      ...data,
      updatedBy: userId
    });

    if (!updatedAlert) throw new NotFoundError('Alert not found during update');

    try {
      await rabbitMQService.publishEvent(EVENTS.ALERT_UPDATED, updatedAlert);
    } catch (err) {
      // Ignore RabbitMQ publish error during HTTP response
    }

    return updatedAlert;
  }

  async addOfficerNote(id: string, officerId: string, userRole: string, data: AddOfficerNoteDto) {
    const alert = await alertRepository.findById(id);
    if (!alert) throw new NotFoundError('Alert not found');

    const roleUpper = (userRole || '').toUpperCase();
    if (!['OFFICER', 'ADMIN'].includes(roleUpper)) {
      throw new ForbiddenError('Only officers and admins can add notes');
    }

    const updatedAlert = await alertRepository.update(id, {
      officerNote: data.note,
      updatedBy: officerId
    });

    if (!updatedAlert) throw new NotFoundError('Alert not found during update');

    try {
      await rabbitMQService.publishEvent(EVENTS.ALERT_UPDATED, updatedAlert);
    } catch (err) {
      // Ignore RabbitMQ publish error
    }

    return updatedAlert;
  }
}

export const alertService = new AlertService();
