import { alertRepository } from '../repositories/alert.repository';
import { CreateAlertDto, UpdateAlertStatusDto } from '../dtos/alert.dto';
import { NotFoundError, BadRequestError, AlertStatus, Severity, EVENTS } from '@ecoalert/shared';
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

  async getAlerts(page: number, limit: number, citizenId?: string) {
    const skip = (page - 1) * limit;
    const filter = citizenId ? { citizenId } : {};
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
}

export const alertService = new AlertService();
