export type UserRole = 'ADMIN' | 'OFFICER' | 'CITIZEN';
export type WorkflowActorRole = UserRole | 'SYSTEM';
export type AlertStatus = 'pending' | 'ai_analyzing' | 'verified' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'rejected';
export type AlertCategory = 'illegal_dumping' | 'water_pollution' | 'air_pollution' | 'illegal_burning' | 'flooding' | 'fallen_tree' | 'illegal_construction_waste' | 'noise_pollution' | 'soil_contamination' | 'wildlife_threat' | 'other' | 'UNCLASSIFIED';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type AiAnalysisMode = 'text' | 'vision' | 'text_fallback' | 'FULL_MULTIMODAL' | 'SEMANTIC_ONLY' | 'VISION_ONLY' | 'FAILED';
export type AiWasteType = 'PLASTIC_WASTE' | 'ORGANIC_WASTE' | 'CONSTRUCTION_WASTE' | 'HAZARDOUS_WASTE' | 'METAL_WASTE' | 'GLASS_WASTE' | 'PAPER_WASTE' | 'E_WASTE' | 'MIXED_WASTE' | 'OTHER';

export interface AiVisionAnalysis {
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'UNAVAILABLE';
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
  version: 'vision-fusion-v1' | 'vision-fusion-v2';
  mode: 'FULL_MULTIMODAL' | 'SEMANTIC_ONLY' | 'VISION_ONLY' | 'FAILED';
  wasteType?: AiWasteType;
  severityScore: number | null;
  explanations: string[];
  semanticConfidence: number | null;
  visionConfidence: number | null;
  fusionConfidence: number | null;
  visionSupport?: 'STRONG' | 'PARTIAL' | 'NONE' | 'NOT_APPLICABLE';
  processingTimeMs: number;
}

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
  overallSummaryLocalized?: { vi: string; en: string };
  shortReasonLocalized?: { vi: string; en: string };
  visionEvidenceUsed: string[];
  semanticModel: string;
  pipelineVersion: 'multimodal-v2';
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
  aiConfidenceSource?: 'FUSION' | 'CATEGORY' | 'SEMANTIC' | 'NONE';
  aiSuggestedPriority?: Severity | null;
  aiSummary?: string | null;
  aiReasoningSummary?: string | null;
  aiAnalysisMode?: AiAnalysisMode;
  aiAnalysisProvider?: 'openrouter' | 'vision-service';
  aiAnalysisModel?: string;
  aiAnalysisId?: string;
  aiAnalyzedAt?: string;
  aiPipelineVersion?: 'multimodal-v1' | 'multimodal-v2';
  aiVision?: AiVisionAnalysis;
  aiFusion?: AiFusionAnalysis;
  aiOverallAnalysis?: AiOverallAnalysis;
  aiSemanticProcessingTimeMs?: number;
  aiTotalProcessingTimeMs?: number;
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
  severity: string | null;
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
  incidents: Array<{ alertId: string; title?: string; address?: string; category: string; severity: string | null; status: string; createdAt?: string; distanceMeters: number }>;
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
  metadata?: {
    analysisMode?: AiAnalysisMode;
    displayConfidence?: number | null;
    displayConfidenceSource?: 'FUSION' | 'CATEGORY' | 'SEMANTIC' | 'NONE';
    detectorConfidence?: number | null;
    [key: string]: unknown;
  };
  correlationId?: string;
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

export interface AssistantSource {
  id: string;
  title: string;
  href?: string;
  type: 'knowledge' | 'dynamic';
}

export interface AssistantMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
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

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  description: string;
  icon: string;
  aqi?: number;
  aqiLabel?: string;
  rainProbability?: number;
  uvIndex?: number;
  sunrise: string;
  sunset: string;
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
  current: WeatherData & {
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
