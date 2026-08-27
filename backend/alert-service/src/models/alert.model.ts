import mongoose, { Schema } from 'mongoose';
import { baseSchemaPlugin, BaseDocument } from './base.model';
import {
  AiAnalysisMode,
  AiDisplayConfidenceSource,
  AlertStatus,
  AlertCategory,
  IAiOverallAnalysis,
  Severity,
} from '@ecoalert/shared';

export type WorkflowActorRole = 'CITIZEN' | 'OFFICER' | 'ADMIN' | 'SYSTEM';

export interface IResolutionEvidence {
  mediaId?: string;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
  type: 'AFTER_TREATMENT';
  capturedAt?: Date;
  location?: { type: 'Point'; coordinates: [number, number] };
  accuracyMeters?: number;
  distanceFromIncidentMeters?: number;
}

export type ImageValidationDecision = 'VALID' | 'UNCERTAIN' | 'INVALID' | 'UNAVAILABLE';
export type ClassificationStatus = 'AI_SUGGESTED' | 'USER_CONFIRMED' | 'USER_CORRECTED' | 'ADMIN_CONFIRMED' | 'ADMIN_CORRECTED' | 'UNCLASSIFIED';

export interface IAlertClassification {
  status: ClassificationStatus;
  aiSuggestedCategory?: AlertCategory | null;
  aiConfidence?: number | null;
  aiReason?: string | null;
  finalCategory?: AlertCategory | null;
  finalCategorySource?: 'AI' | 'CITIZEN' | 'ADMIN' | null;
  citizenSelectedCategory?: AlertCategory | null;
  citizenDecisionAt?: Date | null;
  confirmedBy?: string | null;
  confirmedAt?: Date | null;
}

export interface IImageValidation {
  decision: ImageValidationDecision;
  isEnvironmentalIncident?: boolean | null;
  confidence?: number | null;
  suggestedCategory?: AlertCategory | null;
  reason: string;
  model?: string | null;
  validatedAt: Date;
}

export interface IOfficerCheckIn {
  officerId: string;
  location: { type: 'Point'; coordinates: [number, number] };
  accuracyMeters: number;
  distanceFromIncidentMeters: number;
  checkedInAt: Date;
  verified: boolean;
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
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

export interface IAlert extends BaseDocument {
  title: string;
  description: string;
  status: AlertStatus;
  category: AlertCategory | 'UNCLASSIFIED';
  classification?: IAlertClassification;
  imageValidation?: IImageValidation;
  severity: Severity | null;
  mediaUrls: string[];
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  address?: string;
  citizenId: string;
  assignedOfficerId?: string;
  assignedOfficerName?: string;
  assignedOfficerEmail?: string;
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
  checkIn?: IOfficerCheckIn;
  aiConfidence?: number | null;
  aiConfidenceSource?: AiDisplayConfidenceSource;
  aiSuggestedPriority?: Severity | null;
  aiSummary?: string | null;
  aiReasoningSummary?: string | null;
  aiAnalysisMode?: AiAnalysisMode;
  aiAnalysisProvider?: 'openrouter';
  aiAnalysisModel?: string;
  aiFailureReason?: string | null;
  aiAnalysisId?: string;
  aiAnalyzedAt?: Date;
  aiPipelineVersion?: 'openrouter-multimodal-v1';
  aiOverallAnalysis?: IAiOverallAnalysis;
  aiSemanticProcessingTimeMs?: number;
  aiTotalProcessingTimeMs?: number;
  aiVerified?: boolean;
  aiVerifiedBy?: string;
  aiVerifiedAt?: Date;
  aiHumanCorrection?: {
    category?: AlertCategory;
    severity?: Severity;
    imageUrl?: string;
    modelVersion?: string;
    notes?: string;
    correctedAt?: Date;
  };
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
  capturedAt: { type: Date },
  location: { type: { type: String, enum: ['Point'] }, coordinates: { type: [Number] } },
  accuracyMeters: { type: Number, min: 0 },
  distanceFromIncidentMeters: { type: Number, min: 0 },
}, { _id: true });

const classificationSchema = new Schema<IAlertClassification>({
  status: { type: String, enum: ['AI_SUGGESTED', 'USER_CONFIRMED', 'USER_CORRECTED', 'ADMIN_CONFIRMED', 'ADMIN_CORRECTED', 'UNCLASSIFIED'], required: true },
  aiSuggestedCategory: { type: String, enum: [...Object.values(AlertCategory), null], default: null },
  aiConfidence: { type: Number, min: 0, max: 1, default: null },
  aiReason: { type: String, trim: true, default: null },
  finalCategory: { type: String, enum: [...Object.values(AlertCategory), null], default: null },
  finalCategorySource: { type: String, enum: ['AI', 'CITIZEN', 'ADMIN', null], default: null },
  citizenSelectedCategory: { type: String, enum: [...Object.values(AlertCategory), null], default: null },
  citizenDecisionAt: { type: Date, default: null },
  confirmedBy: { type: String, default: null },
  confirmedAt: { type: Date, default: null },
}, { _id: false });

const imageValidationSchema = new Schema<IImageValidation>({
  decision: { type: String, enum: ['VALID', 'UNCERTAIN', 'INVALID', 'UNAVAILABLE'], required: true },
  isEnvironmentalIncident: { type: Boolean, default: null },
  confidence: { type: Number, min: 0, max: 1, default: null },
  suggestedCategory: { type: String, enum: [...Object.values(AlertCategory), null], default: null },
  reason: { type: String, trim: true, required: true },
  model: { type: String, trim: true, default: null },
  validatedAt: { type: Date, required: true },
}, { _id: false });

const checkInSchema = new Schema<IOfficerCheckIn>({
  officerId: { type: String, required: true },
  location: { type: { type: String, enum: ['Point'], required: true }, coordinates: { type: [Number], required: true } },
  accuracyMeters: { type: Number, required: true, min: 0 },
  distanceFromIncidentMeters: { type: Number, required: true, min: 0 },
  checkedInAt: { type: Date, required: true },
  verified: { type: Boolean, required: true },
}, { _id: false });

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
  metadata: { type: Schema.Types.Mixed },
  correlationId: { type: String },
}, { _id: true });

const overallAnalysisSchema = new Schema<IAiOverallAnalysis>({
  isIncident: { type: Boolean, required: true },
  incidentConfidence: { type: Number, required: true, min: 0, max: 1 },
  categorySuggestion: { type: String, enum: [...Object.values(AlertCategory), null], default: null },
  categoryConfidence: { type: Number, required: true, min: 0, max: 1 },
  classificationStatus: { type: String, enum: ['AI_SUGGESTED', 'UNCLASSIFIED'], required: true },
  confidenceTier: { type: String, enum: ['HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'UNCLASSIFIED'], required: true },
  severity: { type: String, enum: Object.values(Severity), required: true },
  severityScore: { type: Number, min: 0, max: 100, default: null },
  severityConfidence: { type: Number, required: true, min: 0, max: 1 },
  overallSummary: { type: String, trim: true, required: true, maxlength: 800 },
  shortReason: { type: String, trim: true, required: true, maxlength: 500 },
  semanticModel: { type: String, trim: true, required: true },
  pipelineVersion: { type: String, enum: ['openrouter-multimodal-v1'], required: true },
}, { _id: false });

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
  classification: { type: classificationSchema },
  imageValidation: { type: imageValidationSchema },
  severity: {
    type: String,
    enum: [...Object.values(Severity), ...Object.values(Severity).map((value) => value.toUpperCase()), null],
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
  assignedOfficerName: { type: String },
  assignedOfficerEmail: { type: String },
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
  checkIn: { type: checkInSchema },
  aiConfidence: { type: Number, min: 0, max: 1, default: null },
  aiConfidenceSource: { type: String, enum: ['CATEGORY', 'SEMANTIC', 'NONE'], default: 'NONE' },
  aiSuggestedPriority: {
    type: String,
    enum: [...Object.values(Severity), ...Object.values(Severity).map((value) => value.toUpperCase()), null],
    set: (value: unknown) => typeof value === 'string' ? value.toLowerCase() : value,
  },
  aiSummary: { type: String, trim: true },
  aiReasoningSummary: { type: String, trim: true },
  aiAnalysisMode: { type: String, enum: ['TEXT_ONLY', 'IMAGE_AND_TEXT', 'FAILED'] },
  aiAnalysisProvider: { type: String, enum: ['openrouter'] },
  aiAnalysisModel: { type: String, trim: true },
  aiFailureReason: { type: String, trim: true, default: null },
  aiAnalysisId: { type: String, index: true },
  aiAnalyzedAt: { type: Date },
  aiPipelineVersion: { type: String, enum: ['openrouter-multimodal-v1'] },
  aiOverallAnalysis: { type: overallAnalysisSchema },
  aiSemanticProcessingTimeMs: { type: Number, min: 0 },
  aiTotalProcessingTimeMs: { type: Number, min: 0 },
  aiVerified: { type: Boolean },
  aiVerifiedBy: { type: String },
  aiVerifiedAt: { type: Date },
  aiHumanCorrection: {
    category: { type: String, enum: Object.values(AlertCategory) },
    severity: { type: String, enum: Object.values(Severity) },
    wasteType: { type: String, enum: ['PLASTIC_WASTE', 'ORGANIC_WASTE', 'CONSTRUCTION_WASTE', 'HAZARDOUS_WASTE', 'METAL_WASTE', 'GLASS_WASTE', 'PAPER_WASTE', 'E_WASTE', 'MIXED_WASTE', 'OTHER'] },
    imageUrl: { type: String, trim: true },
    modelVersion: { type: String, trim: true },
    notes: { type: String, trim: true },
    correctedAt: { type: Date },
  },
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
