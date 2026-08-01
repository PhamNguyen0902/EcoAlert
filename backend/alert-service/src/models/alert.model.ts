import mongoose, { Schema } from 'mongoose';
import { baseSchemaPlugin, BaseDocument } from './base.model';
import { AiAnalysisMode, AlertStatus, AlertCategory, Severity } from '@ecoalert/shared';

export type WorkflowActorRole = 'CITIZEN' | 'OFFICER' | 'ADMIN' | 'SYSTEM';

export interface IResolutionEvidence {
  mediaId?: string;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
  type: 'AFTER_TREATMENT';
}

export interface IStatusHistoryEntry {
  fromStatus?: AlertStatus;
  toStatus: AlertStatus;
  changedBy: string;
  changedByRole: WorkflowActorRole;
  changedAt: Date;
  note?: string;
  correlationId?: string;
}

export interface ITimelineEntry {
  eventType: string;
  label: string;
  timestamp: Date;
  actorId: string;
  actorRole: WorkflowActorRole;
  note?: string;
  status?: AlertStatus;
  evidenceUrls?: string[];
  correlationId?: string;
}

export interface IAlert extends BaseDocument {
  title: string;
  description: string;
  status: AlertStatus;
  category: AlertCategory | 'UNCLASSIFIED';
  severity: Severity;
  mediaUrls: string[];
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  address?: string;
  citizenId: string;
  assignedOfficerId?: string;
  assignedAt?: Date;
  assignedBy?: string;
  startedAt?: Date;
  startedBy?: string;
  arrivedAt?: Date;
  arrivedBy?: string;
  arrivalLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  aiConfidence?: number;
  aiSuggestedPriority?: Severity;
  aiSummary?: string;
  aiReasoningSummary?: string;
  aiAnalysisMode?: AiAnalysisMode;
  aiAnalysisProvider?: 'openrouter';
  aiAnalysisModel?: string;
  aiAnalysisId?: string;
  aiAnalyzedAt?: Date;
  officerNote?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionSummary?: string;
  treatmentMethod?: string;
  materialsUsed?: string;
  resolutionNotes?: string;
  resolutionEvidence: IResolutionEvidence[];
  closedAt?: Date;
  closedBy?: string;
  adminReviewNote?: string;
  isAnonymous?: boolean;
  confirmationsCount?: number;
  confirmations?: Array<{ citizenId: string; confirmedAt: Date }>;
  voiceNoteUrl?: string;
  statusHistory: IStatusHistoryEntry[];
  timeline: ITimelineEntry[];
  softDelete(userId: string): Promise<this>;
}

const confirmationSchema = new Schema({
  citizenId: { type: String, required: true },
  confirmedAt: { type: Date, default: Date.now }
}, { _id: false });

const resolutionEvidenceSchema = new Schema<IResolutionEvidence>({
  mediaId: { type: String },
  url: { type: String, required: true },
  uploadedBy: { type: String, required: true },
  uploadedAt: { type: Date, required: true },
  type: { type: String, enum: ['AFTER_TREATMENT'], required: true },
}, { _id: true });

const statusHistorySchema = new Schema<IStatusHistoryEntry>({
  fromStatus: { type: String, enum: Object.values(AlertStatus) },
  toStatus: { type: String, enum: Object.values(AlertStatus), required: true },
  changedBy: { type: String, required: true },
  changedByRole: { type: String, enum: ['CITIZEN', 'OFFICER', 'ADMIN', 'SYSTEM'], required: true },
  changedAt: { type: Date, required: true },
  note: { type: String, trim: true },
  correlationId: { type: String },
}, { _id: true });

const timelineEntrySchema = new Schema<ITimelineEntry>({
  eventType: { type: String, required: true },
  label: { type: String, required: true },
  timestamp: { type: Date, required: true },
  actorId: { type: String, required: true },
  actorRole: { type: String, enum: ['CITIZEN', 'OFFICER', 'ADMIN', 'SYSTEM'], required: true },
  note: { type: String, trim: true },
  status: { type: String, enum: Object.values(AlertStatus) },
  evidenceUrls: [{ type: String }],
  correlationId: { type: String },
}, { _id: true });

const alertSchema = new Schema<IAlert>({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: [...Object.values(AlertStatus), ...Object.values(AlertStatus).map((value) => value.toUpperCase())],
    default: AlertStatus.PENDING,
    set: (value: unknown) => typeof value === 'string' ? value.toLowerCase() : value,
  },
  category: { type: String, default: 'UNCLASSIFIED' },
  severity: {
    type: String,
    enum: [...Object.values(Severity), ...Object.values(Severity).map((value) => value.toUpperCase())],
    default: Severity.LOW,
    set: (value: unknown) => typeof value === 'string' ? value.toLowerCase() : value,
  },
  mediaUrls: [{ type: String }],
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true },
  },
  address: { type: String },
  citizenId: { type: String, required: true, index: true },
  assignedOfficerId: { type: String, index: true },
  assignedAt: { type: Date },
  assignedBy: { type: String },
  startedAt: { type: Date },
  startedBy: { type: String },
  arrivedAt: { type: Date },
  arrivedBy: { type: String },
  arrivalLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number },
  },
  aiConfidence: { type: Number },
  aiSuggestedPriority: {
    type: String,
    enum: [...Object.values(Severity), ...Object.values(Severity).map((value) => value.toUpperCase())],
    set: (value: unknown) => typeof value === 'string' ? value.toLowerCase() : value,
  },
  aiSummary: { type: String, trim: true },
  aiReasoningSummary: { type: String, trim: true },
  aiAnalysisMode: { type: String, enum: ['text', 'vision', 'text_fallback'] },
  aiAnalysisProvider: { type: String, enum: ['openrouter'] },
  aiAnalysisModel: { type: String, trim: true },
  aiAnalysisId: { type: String, index: true },
  aiAnalyzedAt: { type: Date },
  officerNote: { type: String, trim: true },
  resolvedAt: { type: Date },
  resolvedBy: { type: String },
  resolutionSummary: { type: String, trim: true },
  treatmentMethod: { type: String, trim: true },
  materialsUsed: { type: String, trim: true },
  resolutionNotes: { type: String, trim: true },
  resolutionEvidence: { type: [resolutionEvidenceSchema], default: [] },
  closedAt: { type: Date },
  closedBy: { type: String },
  adminReviewNote: { type: String, trim: true },
  isAnonymous: { type: Boolean, default: false },
  confirmationsCount: { type: Number, default: 1 },
  confirmations: { type: [confirmationSchema], default: [] },
  voiceNoteUrl: { type: String },
  statusHistory: { type: [statusHistorySchema], default: [] },
  timeline: { type: [timelineEntrySchema], default: [] },
}, { timestamps: true });

alertSchema.plugin(baseSchemaPlugin);
alertSchema.index({ location: '2dsphere' });
alertSchema.index({ status: 1 });
alertSchema.index({ assignedOfficerId: 1, status: 1, createdAt: -1 });

export const Alert = mongoose.model<IAlert>('Alert', alertSchema);
