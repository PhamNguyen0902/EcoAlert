import mongoose, { Schema } from 'mongoose';
import { baseSchemaPlugin, BaseDocument } from './base.model';
import {
  AiAnalysisMode,
  AiWasteType,
  AlertStatus,
  AlertCategory,
  IAiFusionAnalysis,
  IAiVisionAnalysis,
  Severity,
} from '@ecoalert/shared';

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
  aiConfidence?: number;
  aiSuggestedPriority?: Severity;
  aiSummary?: string;
  aiReasoningSummary?: string;
  aiAnalysisMode?: AiAnalysisMode;
  aiAnalysisProvider?: 'openrouter' | 'vision-service';
  aiAnalysisModel?: string;
  aiAnalysisId?: string;
  aiAnalyzedAt?: Date;
  aiPipelineVersion?: 'multimodal-v1';
  aiVision?: IAiVisionAnalysis;
  aiFusion?: IAiFusionAnalysis;
  aiSemanticProcessingTimeMs?: number;
  aiTotalProcessingTimeMs?: number;
  aiVerified?: boolean;
  aiVerifiedBy?: string;
  aiVerifiedAt?: Date;
  aiHumanCorrection?: {
    category?: AlertCategory;
    severity?: Severity;
    wasteType?: AiWasteType;
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

const boundingBoxSchema = new Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
}, { _id: false });

const visionDetectionSchema = new Schema({
  classId: { type: Number, required: true },
  label: { type: String, required: true, trim: true },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  bbox: { type: boundingBoxSchema, required: true },
  normalizedBbox: { type: boundingBoxSchema, required: true },
  wasteType: {
    type: String,
    enum: ['PLASTIC_WASTE', 'ORGANIC_WASTE', 'CONSTRUCTION_WASTE', 'HAZARDOUS_WASTE', 'METAL_WASTE', 'GLASS_WASTE', 'PAPER_WASTE', 'E_WASTE', 'MIXED_WASTE', 'OTHER'],
  },
  maskAreaPixels: { type: Number, min: 0 },
  maskCoverage: { type: Number, min: 0, max: 1 },
}, { _id: false });

const visionAnalysisSchema = new Schema({
  status: { type: String, enum: ['COMPLETED', 'FAILED', 'SKIPPED', 'UNAVAILABLE'], required: true },
  detectorModel: { type: String, required: true, trim: true },
  segmenterModel: { type: String, trim: true },
  imageWidth: { type: Number, min: 1 },
  imageHeight: { type: Number, min: 1 },
  detections: { type: [visionDetectionSchema], default: [] },
  objectCounts: { type: [{ label: String, count: Number }], default: [] },
  totalDetectedObjects: { type: Number, required: true, min: 0 },
  visibleWasteCoverage: { type: Number, min: 0, max: 1, default: null },
  detectorConfidence: { type: Number, min: 0, max: 1, default: null },
  segmentationConfidence: { type: Number, min: 0, max: 1, default: null },
  annotatedImageUrl: { type: String, trim: true },
  processingTimeMs: { type: Number, required: true, min: 0 },
  detectionTimeMs: { type: Number, required: true, min: 0 },
  segmentationTimeMs: { type: Number, required: true, min: 0 },
  annotationTimeMs: { type: Number, required: true, min: 0 },
  warnings: { type: [String], default: [] },
}, { _id: false });

const fusionAnalysisSchema = new Schema({
  version: { type: String, enum: ['vision-fusion-v1'], required: true },
  mode: { type: String, enum: ['FULL_MULTIMODAL', 'SEMANTIC_ONLY', 'VISION_ONLY', 'FAILED'], required: true },
  wasteType: {
    type: String,
    enum: ['PLASTIC_WASTE', 'ORGANIC_WASTE', 'CONSTRUCTION_WASTE', 'HAZARDOUS_WASTE', 'METAL_WASTE', 'GLASS_WASTE', 'PAPER_WASTE', 'E_WASTE', 'MIXED_WASTE', 'OTHER'],
  },
  severityScore: { type: Number, required: true, min: 0, max: 100 },
  severityFactors: { type: [{
    factor: String,
    score: Number,
    evidenceSource: { type: String, enum: ['semantic', 'vision'] },
    explanation: String,
  }], default: [] },
  explanations: { type: [String], default: [] },
  semanticConfidence: { type: Number, min: 0, max: 1, default: null },
  visionConfidence: { type: Number, min: 0, max: 1, default: null },
  fusionConfidence: { type: Number, required: true, min: 0, max: 1 },
  processingTimeMs: { type: Number, required: true, min: 0 },
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
  aiConfidence: { type: Number },
  aiSuggestedPriority: {
    type: String,
    enum: [...Object.values(Severity), ...Object.values(Severity).map((value) => value.toUpperCase())],
    set: (value: unknown) => typeof value === 'string' ? value.toLowerCase() : value,
  },
  aiSummary: { type: String, trim: true },
  aiReasoningSummary: { type: String, trim: true },
  aiAnalysisMode: { type: String, enum: ['text', 'vision', 'text_fallback', 'FULL_MULTIMODAL', 'SEMANTIC_ONLY', 'VISION_ONLY', 'FAILED'] },
  aiAnalysisProvider: { type: String, enum: ['openrouter', 'vision-service'] },
  aiAnalysisModel: { type: String, trim: true },
  aiAnalysisId: { type: String, index: true },
  aiAnalyzedAt: { type: Date },
  aiPipelineVersion: { type: String, enum: ['multimodal-v1'] },
  aiVision: { type: visionAnalysisSchema },
  aiFusion: { type: fusionAnalysisSchema },
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
