export type UserRole = 'ADMIN' | 'OFFICER' | 'CITIZEN';
export type WorkflowActorRole = UserRole | 'SYSTEM';
export type AlertStatus = 'pending' | 'ai_analyzing' | 'verified' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'rejected';
export type AlertCategory = 'illegal_dumping' | 'water_pollution' | 'air_pollution' | 'illegal_burning' | 'flooding' | 'fallen_tree' | 'illegal_construction_waste' | 'noise_pollution' | 'soil_contamination' | 'wildlife_threat' | 'fire' | 'other' | 'UNCLASSIFIED';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type AiAnalysisMode = 'TEXT_ONLY' | 'IMAGE_AND_TEXT' | 'FAILED';

export interface AiOverallAnalysis {
  isIncident: boolean;
  incidentConfidence: number;
  categorySuggestion: AlertCategory | null;
  categoryConfidence: number;
  classificationStatus: 'AI_SUGGESTED' | 'UNCLASSIFIED';
  confidenceTier: 'HIGH_CONFIDENCE' | 'REVIEW_REQUIRED' | 'UNCLASSIFIED';
  severity: Severity;
  severityScore: number;
  severityConfidence: number;
  overallSummary: string;
  shortReason: string;
  semanticModel: string;
  pipelineVersion: 'openrouter-multimodal-v1';
}

export interface User {
  _id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GeoLocation {
  type: 'Point';
  coordinates: [number, number];
}

export type ImageValidationDecision = 'VALID' | 'UNCERTAIN' | 'INVALID' | 'UNAVAILABLE';
export type ClassificationStatus = 'AI_SUGGESTED' | 'USER_CONFIRMED' | 'USER_CORRECTED' | 'ADMIN_CONFIRMED' | 'ADMIN_CORRECTED' | 'UNCLASSIFIED';
export interface ImageValidation {
  decision: ImageValidationDecision;
  isEnvironmentalIncident: boolean | null;
  confidence: number | null;
  suggestedCategory: AlertCategory | null;
  reason: string;
  model: string | null;
  validatedAt: string;
}
export interface AlertClassification {
  status: ClassificationStatus;
  aiSuggestedCategory?: AlertCategory | null;
  aiConfidence?: number | null;
  aiReason?: string | null;
  finalCategory?: AlertCategory | null;
  finalCategorySource?: 'AI' | 'CITIZEN' | 'ADMIN' | null;
  citizenSelectedCategory?: AlertCategory | null;
  citizenDecisionAt?: string | null;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
}

export interface Category {
  _id: string;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  defaultSeverity: Severity;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  _id: string;
  title: string;
  description: string;
  status: AlertStatus;
  category: AlertCategory;
  classification?: AlertClassification;
  imageValidation?: ImageValidation;
  severity: Severity | null;
  mediaUrls: string[];
  location: GeoLocation;
  address: string;
  citizenId: string;
  assignedOfficerId?: string;
  assignedAt?: string;
  assignedBy?: string;
  startedAt?: string;
  startedBy?: string;
  arrivedAt?: string;
  arrivedBy?: string;
  arrivalLocation?: ArrivalLocation;
  checkIn?: { accuracyMeters: number; distanceFromIncidentMeters: number; checkedInAt: string; verified: boolean };
  aiConfidence?: number | null;
  aiConfidenceSource?: 'CATEGORY' | 'SEMANTIC' | 'NONE';
  aiSuggestedPriority?: Severity | null;
  aiSummary?: string | null;
  aiReasoningSummary?: string | null;
  aiAnalysisMode?: AiAnalysisMode;
  aiAnalysisProvider?: 'openrouter';
  aiAnalysisModel?: string;
  aiFailureReason?: string | null;
  aiAnalysisId?: string;
  aiAnalyzedAt?: string;
  aiPipelineVersion?: 'openrouter-multimodal-v1';
  aiOverallAnalysis?: AiOverallAnalysis;
  aiSemanticProcessingTimeMs?: number;
  officerNote?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionSummary?: string;
  treatmentMethod?: string;
  materialsUsed?: string;
  resolutionNotes?: string;
  resolutionEvidence: ResolutionEvidence[];
  closedAt?: string;
  closedBy?: string;
  adminReviewNote?: string;
  statusHistory: StatusHistoryEntry[];
  timeline: TimelineEntry[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ArrivalLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface ResolutionEvidence {
  _id?: string;
  mediaId?: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
  type: 'AFTER_TREATMENT';
  capturedAt?: string;
  accuracyMeters?: number;
  distanceFromIncidentMeters?: number;
}

export interface ResolutionEvidenceInput {
  mediaId?: string;
  url: string;
  location?: { latitude: number; longitude: number; accuracyMeters: number };
}

export interface ResolutionInput {
  resolutionSummary: string;
  treatmentMethod: string;
  materialsUsed?: string;
  additionalNotes?: string;
  evidence: ResolutionEvidenceInput[];
}

export interface ShiftLocationInput {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

export interface OfficerShift {
  _id: string;
  officerId: string;
  status: 'ACTIVE' | 'COMPLETED';
  startedAt: string;
  endedAt?: string;
  startLocation: { type: 'Point'; coordinates: [number, number]; accuracyMeters: number };
  endLocation?: { type: 'Point'; coordinates: [number, number]; accuracyMeters: number };
}

export interface OfficerAvailability {
  officer: Pick<User, '_id' | 'fullName' | 'email' | 'role'>;
  shiftStatus: 'ON_SHIFT' | 'OFF_SHIFT';
  activeTaskCount: number;
  assignedCount: number;
  inProgressCount: number;
  workloadLevel: 'NORMAL' | 'MODERATE' | 'HIGH';
  currentShift?: OfficerShift | null;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  weight: number;
  incidentId: string;
  title?: string;
  address?: string;
  category: string;
  severity: string;
  status: string;
  createdAt?: string;
}

export interface HeatmapSummary {
  total: number;
  open: number;
  resolved: number;
  closed: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
}

export interface IncidentHeatmap {
  points: HeatmapPoint[];
  summary: HeatmapSummary;
}

export interface HeatmapDrilldown {
  center: { lat: number; lng: number };
  radiusMeters: number;
  summary: HeatmapSummary;
  incidents: Array<{
    alertId: string;
    title?: string;
    address?: string;
    category: string;
    severity: string;
    status: string;
    createdAt?: string;
    distanceMeters: number;
  }>;
}

export interface StatusHistoryEntry {
  _id?: string;
  fromStatus?: AlertStatus;
  toStatus: AlertStatus;
  changedBy: string;
  changedByRole: WorkflowActorRole;
  changedAt: string;
  note?: string;
  correlationId?: string;
}

export interface TimelineEntry {
  _id?: string;
  eventType: string;
  label: string;
  timestamp: string;
  actorId: string;
  actorRole: WorkflowActorRole;
  note?: string;
  status?: AlertStatus;
  evidenceUrls?: string[];
  correlationId?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: unknown;
}

export interface GISLocation {
  _id: string;
  alertId: string;
  category: AlertCategory;
  severity: Severity;
  status: AlertStatus;
  location: GeoLocation;
  createdAt: string;
  updatedAt: string;
}


export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface RegisterData {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface CreateAlertData {
  title: string;
  description: string;
  location: GeoLocation;
  address?: string;
  mediaUrls?: string[];
  category?: AlertCategory;
  imageValidation?: ImageValidation;
  classification?: { selectedCategory?: AlertCategory; decision?: 'CONFIRM' | 'CORRECT' };
}
