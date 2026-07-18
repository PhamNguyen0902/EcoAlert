import { alertRepository } from '../repositories/alert.repository';
import { CreateAlertDto, UpdateAlertStatusDto } from '../dtos/alert.dto';
import { NotFoundError, AlertStatus, EVENTS } from '@ecoalert/shared';
import { rabbitMQService } from './rabbitmq.service';

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
    const alert = await alertRepository.update(id, { 
      status: data.status,
      updatedBy 
    });
    if (!alert) throw new NotFoundError('Alert not found');
    
    // Publish update event for notifications
    await rabbitMQService.publishEvent(EVENTS.ALERT_UPDATED, alert);
    
    return alert;
  }
  
  // This would be called internally or via a webhook from AI service
  async internalUpdateAiResult(id: string, category: string, confidence: number, priority: string) {
    const alert = await alertRepository.update(id, {
      category: category as any,
      aiConfidence: confidence,
      aiSuggestedPriority: priority as any,
      status: AlertStatus.AI_ANALYZING // or keep it pending until verified
    });
    return alert;
  }
}

export const alertService = new AlertService();
