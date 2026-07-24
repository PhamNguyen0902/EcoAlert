import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  user: string;
  userId?: string;
  action: string;
  resource: string;
  details?: string;
  ipAddress?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
  user: { type: String, required: true },
  userId: { type: String },
  action: { type: String, required: true, uppercase: true },
  resource: { type: String, required: true },
  details: { type: String },
  ipAddress: { type: String },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
