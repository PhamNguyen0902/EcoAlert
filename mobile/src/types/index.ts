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
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
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
  severity?: Severity | null;
  mediaUrls: string[];
  location: GeoLocation;
  address: string;
  citizenId: string | User;
  assignedOfficerId?: string | User;
  aiConfidence?: number | null;
  aiSuggestedPriority?: Severity | null;
  aiSummary?: string | null;
  aiReasoningSummary?: string | null;
  aiAnalysisMode?: "text" | "vision" | "text_fallback" | null;
  aiAnalysisProvider?: "openrouter" | null;
  aiAnalysisModel?: string | null;
  aiAnalysisId?: string | null;
  aiAnalyzedAt?: string | null;
  officerNote?: string;
  arrivedAt?: string;
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
}

export interface ResolutionEvidenceInput {
  mediaId?: string;
  url: string;
}

export interface ResolutionInput {
  resolutionSummary: string;
  treatmentMethod: string;
  materialsUsed?: string;
  additionalNotes?: string;
  evidence: ResolutionEvidenceInput[];
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

