export type UserRole = "ADMIN" | "OFFICER" | "CITIZEN";
export type WorkflowActorRole = UserRole | "SYSTEM";

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
export type AiAnalysisMode = "text" | "vision" | "text_fallback" | "FULL_MULTIMODAL" | "SEMANTIC_ONLY" | "VISION_ONLY" | "FAILED";
export type AiWasteType = "PLASTIC_WASTE" | "ORGANIC_WASTE" | "CONSTRUCTION_WASTE" | "HAZARDOUS_WASTE" | "METAL_WASTE" | "GLASS_WASTE" | "PAPER_WASTE" | "E_WASTE" | "MIXED_WASTE" | "OTHER";

export interface AiVisionAnalysis {
  status: "COMPLETED" | "FAILED" | "SKIPPED" | "UNAVAILABLE";
  detectorModel: string;
  segmenterModel?: string;
  detections: Array<{ label: string; confidence: number; wasteType?: AiWasteType }>;
  objectCounts: Array<{ label: string; count: number }>;
  totalDetectedObjects: number;
  visibleWasteCoverage: number | null;
  detectorConfidence: number | null;
  segmentationConfidence: number | null;
  annotatedImageUrl?: string;
  processingTimeMs: number;
  detectionTimeMs: number;
  segmentationTimeMs: number;
  annotationTimeMs: number;
  warnings: string[];
}

export interface AiFusionAnalysis {
  version: "vision-fusion-v1" | "vision-fusion-v2";
  mode: "FULL_MULTIMODAL" | "SEMANTIC_ONLY" | "VISION_ONLY" | "FAILED";
  wasteType?: AiWasteType;
  severityScore: number | null;
  explanations: string[];
  semanticConfidence: number | null;
  visionConfidence: number | null;
  fusionConfidence: number | null;
  visionSupport?: "STRONG" | "PARTIAL" | "NONE" | "NOT_APPLICABLE";
  processingTimeMs: number;
}

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
  visionEvidenceUsed: string[];
  semanticModel: string;
  pipelineVersion: "multimodal-v2";
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
  aiConfidenceSource?: "FUSION" | "CATEGORY" | "SEMANTIC" | "NONE";
  aiSuggestedPriority?: Severity | null;
  aiSummary?: string | null;
  aiReasoningSummary?: string | null;
  aiAnalysisMode?: AiAnalysisMode | null;
  aiAnalysisProvider?: "openrouter" | "vision-service" | null;
  aiAnalysisModel?: string | null;
  aiAnalysisId?: string | null;
  aiAnalyzedAt?: string | null;
  aiPipelineVersion?: "multimodal-v1" | "multimodal-v2" | null;
  aiVision?: AiVisionAnalysis | null;
  aiFusion?: AiFusionAnalysis | null;
  aiOverallAnalysis?: AiOverallAnalysis | null;
  aiSemanticProcessingTimeMs?: number | null;
  aiTotalProcessingTimeMs?: number | null;
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
  statusHistory?: StatusHistoryEntry[];
  timeline?: TimelineEntry[];
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

export interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  description: string;
  icon: string;
  sunrise: string;
  sunset: string;
  aqi: number;
  aqiLabel: string;
  lastUpdated: string;
}

export interface WeatherForecastPeriod {
  timestamp: string;
  temperature: number;
  feelsLike: number;
  temperatureMin: number;
  temperatureMax: number;
  condition: string;
  description: string;
  icon: string;
  precipitationProbability: number;
}

export interface DailyWeatherForecast {
  date: string;
  minTemperature: number;
  maxTemperature: number;
  condition: string;
  description: string;
  icon: string;
  precipitationProbability: number;
}

export interface WeatherAirQuality {
  aqi: number;
  aqiLabel: string;
  pm2_5: number | null;
  pm10: number | null;
  co: number | null;
  no2: number | null;
  o3: number | null;
}

export interface WeatherDetails {
  location: {
    name: string;
    country: string;
    latitude: number;
    longitude: number;
    timezoneOffsetSeconds: number;
  };
  current: CurrentWeather & {
    condition: string;
    pressure: number | null;
    visibilityKm: number | null;
    cloudiness: number | null;
  };
  hourly: WeatherForecastPeriod[];
  daily: DailyWeatherForecast[];
  airQuality: WeatherAirQuality | null;
  availability: {
    forecast: boolean;
    airQuality: boolean;
  };
  fetchedAt: string;
}

export interface AssistantSource {
  id: string;
  title: string;
  href?: string;
  type: "knowledge" | "dynamic";
}

export interface AssistantMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  sources: AssistantSource[];
  createdAt: string;
}

export interface AssistantConversation {
  id: string;
  title: string;
  role: UserRole;
  lastMessageAt: string;
  createdAt: string;
}

export interface AssistantReply {
  conversation: AssistantConversation;
  message: AssistantMessage;
}

export interface Notification {
  _id: string;
  recipientId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
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

/** Read model returned to administrators by the existing alert-service API. */
export interface OfficerAvailability {
  officer: Pick<User, "_id" | "fullName" | "email" | "role">;
  shiftStatus: "ON_SHIFT" | "OFF_SHIFT";
  activeTaskCount: number;
  assignedCount: number;
  inProgressCount: number;
  workloadLevel: "NORMAL" | "MODERATE" | "HIGH";
  currentShift?: OfficerShift | null;
}

export interface IncidentDensityPoint {
  lat: number;
  lng: number;
  weight: number;
  incidentId: string;
  title?: string;
  address?: string;
  category?: string;
  severity?: Severity | null;
  status?: AlertStatus | string;
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

export interface IncidentDensityResult {
  points: IncidentDensityPoint[];
  summary: IncidentDensitySummary;
}

export interface IncidentDensityDrilldown {
  center: { lat: number; lng: number };
  radiusMeters: number;
  summary: IncidentDensitySummary;
  incidents: Array<IncidentDensityPoint & { distanceMeters?: number }>;
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

