import { Schema } from 'mongoose';
import { alertReadConnection } from '../config/database.config';

export interface IReadOnlyAlert {
  title: string;
  category?: string;
  severity?: string;
  status?: string;
  address?: string;
  citizenId: string;
  assignedOfficerId?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  assignedAt?: Date;
  startedAt?: Date;
  arrivedAt?: Date;
  resolutionEvidence?: string[];
  isDeleted?: boolean;
}

// Deliberately model only fields that are allowed into assistant context.
const readOnlyAlertSchema = new Schema<IReadOnlyAlert>(
  {
    title: String,
    category: String,
    severity: String,
    status: String,
    address: String,
    citizenId: String,
    assignedOfficerId: String,
    createdAt: Date,
    updatedAt: Date,
    resolvedAt: Date,
    assignedAt: Date,
    startedAt: Date,
    arrivedAt: Date,
    resolutionEvidence: [String],
    isDeleted: Boolean,
  },
  { strict: true, collection: 'alerts' },
);

export const ReadOnlyAlert =
  alertReadConnection.models.ReadOnlyAlert ||
  alertReadConnection.model<IReadOnlyAlert>('ReadOnlyAlert', readOnlyAlertSchema);
