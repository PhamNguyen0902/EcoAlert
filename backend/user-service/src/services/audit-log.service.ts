import { AuditLog } from '../models/audit-log.model';

export class AuditLogService {
  async log(data: { user: string; userId?: string; action: string; resource: string; details?: string; ipAddress?: string }) {
    try {
      await AuditLog.create(data);
    } catch (err) {
      console.error('Failed to create audit log:', err);
    }
  }
}

export const auditLogService = new AuditLogService();
