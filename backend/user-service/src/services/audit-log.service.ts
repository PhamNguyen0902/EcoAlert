import { AuditLog } from '../models/audit-log.model';

export class AuditLogService {
  async log(data: { user: string; userId?: string; action: string; resource: string; details?: string; ipAddress?: string }) {
    try {
      await AuditLog.create(data);
    } catch (err) {
      console.error('Failed to create audit log:', err);
    }
  }

  async getLogs(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const filter: any = {};

    if (search) {
      filter.$or = [
        { user: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
        { resource: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  }
}

export const auditLogService = new AuditLogService();
