import mongoose, { Schema } from 'mongoose';
import { baseSchemaPlugin, BaseDocument } from './base.model';
import { AlertStatus, AlertCategory, Severity } from '@ecoalert/shared';

export interface IAlert extends BaseDocument {
  title: string;
  description: string;
  status: AlertStatus;
  category: AlertCategory | 'UNCLASSIFIED';
  severity: Severity;
  mediaUrls: string[];
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  address?: string;
  citizenId: string;
  assignedOfficerId?: string;
  aiConfidence?: number;
  aiSuggestedPriority?: Severity;
  officerNote?: string;   // Ghi chú xử lý của Officer
  resolvedAt?: Date;      // Thời điểm xử lý xong
  softDelete(userId: string): Promise<this>;
}

const alertSchema = new Schema<IAlert>({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  status: { type: String, enum: Object.values(AlertStatus), default: AlertStatus.PENDING },
  category: { type: String, default: 'UNCLASSIFIED' },
  severity: { 
    type: String, 
    enum: [...Object.values(Severity), 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], 
    default: Severity.LOW,
    set: (v: string) => v ? (v.toLowerCase() as any) : v
  },
  mediaUrls: [{ type: String }],
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true },
  },
  address: { type: String },
  citizenId: { type: String, required: true, index: true },
  assignedOfficerId: { type: String, index: true },
  aiConfidence: { type: Number },
  aiSuggestedPriority: { 
    type: String, 
    enum: [...Object.values(Severity), 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    set: (v: string) => v ? (v.toLowerCase() as any) : v
  },
  officerNote: { type: String, trim: true },
  resolvedAt: { type: Date }
}, { timestamps: true });

alertSchema.plugin(baseSchemaPlugin);
// Note: Location indexing is mainly done in the GIS Service. But adding a 2dsphere here doesn't hurt.
alertSchema.index({ location: '2dsphere' });
alertSchema.index({ status: 1 });

export const Alert = mongoose.model<IAlert>('Alert', alertSchema);
