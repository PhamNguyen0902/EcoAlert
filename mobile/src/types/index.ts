export type UserRole = "ADMIN" | "OFFICER" | "CITIZEN";

export type AlertStatus =
  | "PENDING"
  | "AI_ANALYZING"
  | "VERIFIED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED"
  | "REJECTED"
  | "pending"
  | "ai_analyzing"
  | "verified"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed"
  | "rejected";

export type AlertCategory =
  | "illegal_dumping"
  | "water_pollution"
  | "air_pollution"
  | "illegal_burning"
  | "flooding"
  | "fallen_tree"
  | "illegal_construction_waste"
  | "noise_pollution"
  | "soil_contamination"
  | "wildlife_threat"
  | "other"
  | "UNCLASSIFIED"
  | "Waste"
  | "Water"
  | "Air"
  | "Other";

export type Severity = "low" | "medium" | "high" | "critical" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AiAnalysisMode = "TEXT_ONLY" | "IMAGE_AND_TEXT" | "FAILED";

export interface AiOverallAnalysis {
  isIncident: boolean;
  incidentConfidence: number;
  categorySuggestion: AlertCategory | null;
  categoryConfidence: number;
  classificationStatus: "AI_SUGGESTED" | "UNCLASSIFIED";
  confidenceTier: "HIGH_CONFIDENCE" | "REVIEW_REQUIRED" | "UNCLASSIFIED";
  severity: Severity;
  severityScore: number;
  severityConfidence: number;
  overallSummary: string;
  shortReason: string;
  semanticModel: string;
  pipelineVersion: "openrouter-multimodal-v1";
}

export interface User {
  _id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatar?: string;
  pushToken?: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GeoLocation {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export type ImageValidationDecision = "VALID" | "UNCERTAIN" | "INVALID" | "UNAVAILABLE";
export type ClassificationStatus = "AI_SUGGESTED" | "USER_CONFIRMED" | "USER_CORRECTED" | "ADMIN_CONFIRMED" | "ADMIN_CORRECTED" | "UNCLASSIFIED";
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
  finalCategorySource?: "AI" | "CITIZEN" | "ADMIN" | null;
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
  category?: AlertCategory | null;
  classification?: AlertClassification | null;
  imageValidation?: ImageValidation | null;
  severity?: Severity | null;
  mediaUrls: string[];
  location: GeoLocation;
  address: string;
  citizenId: string | User;
  assignedOfficerId?: string | User;
  assignedOfficerName?: string;
  assignedOfficerEmail?: string;
  aiConfidence?: number | null;
  aiConfidenceSource?: "CATEGORY" | "SEMANTIC" | "NONE";
  aiSuggestedPriority?: Severity | null;
  aiSummary?: string | null;
  aiReasoningSummary?: string | null;
  aiAnalysisMode?: AiAnalysisMode | null;
  aiAnalysisProvider?: "openrouter" | null;
  aiAnalysisModel?: string | null;
  aiFailureReason?: string | null;
  aiAnalysisId?: string | null;
  aiAnalyzedAt?: string | null;
  aiPipelineVersion?: "openrouter-multimodal-v1" | null;
  aiOverallAnalysis?: AiOverallAnalysis | null;
  aiSemanticProcessingTimeMs?: number | null;
  officerNote?: string;
  arrivedAt?: string;
  checkIn?: { accuracyMeters: number; distanceFromIncidentMeters: number; checkedInAt: string; verified: boolean };
  resolutionEvidence?: Array<{ _id?: string; url: string; capturedAt?: string; accuracyMeters?: number; distanceFromIncidentMeters?: number }>;
  assignedAt?: string;
  resolvedAt?: string;
  isAnonymous?: boolean;
  confirmationsCount?: number;
  confirmations?: Array<{ citizenId: string; confirmedAt: string }>;
  voiceNoteUrl?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
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
  errors?: any;
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface RegisterData {
  email: string;
  password?: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface CreateAlertData {
  title: string;
  description: string;
  location: GeoLocation;
  address?: string;
  mediaUrls?: string[];
  isAnonymous?: boolean;
  voiceNoteUrl?: string;
  category?: AlertCategory;
  imageValidation?: ImageValidation;
  classification?: { selectedCategory?: AlertCategory; decision?: "CONFIRM" | "CORRECT" };
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
  status: "ACTIVE" | "COMPLETED";
  startedAt: string;
  endedAt?: string;
  startLocation: { type: "Point"; coordinates: [number, number]; accuracyMeters: number };
  endLocation?: { type: "Point"; coordinates: [number, number]; accuracyMeters: number };
}


export interface AuditLog {
  _id: string;
  userId?: string | User;
  action: string;
  entity?: string;
  entityId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface CreateUserData {
  email: string;
  fullName: string;
  password?: string;
  phone?: string;
  role?: UserRole;
}

export interface CreateCategoryData {
  name: string;
  code: string;
  description?: string;
  icon?: string;
  defaultSeverity?: Severity;
  isActive?: boolean;
}

/**
 * Admin-only operational GIS contract returned by the existing GIS service.
 * Coordinates are already normalized to latitude/longitude at this boundary;
 * persisted GeoJSON remains [longitude, latitude].
 */
export interface IncidentDensityPoint {
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

export interface IncidentDensitySummary {
  total: number;
  open: number;
  resolved: number;
  closed: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
}

export interface IncidentDensity {
  points: IncidentDensityPoint[];
  summary: IncidentDensitySummary;
}

export interface IncidentDensityDrilldown {
  center: { lat: number; lng: number };
  radiusMeters: number;
  summary: IncidentDensitySummary;
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

