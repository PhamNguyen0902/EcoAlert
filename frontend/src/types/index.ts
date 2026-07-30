export type UserRole = 'ADMIN' | 'OFFICER' | 'CITIZEN';
export type WorkflowActorRole = UserRole | 'SYSTEM';
export type AlertStatus = 'pending' | 'ai_analyzing' | 'verified' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'rejected';
export type AlertCategory = 'illegal_dumping' | 'water_pollution' | 'air_pollution' | 'illegal_burning' | 'flooding' | 'fallen_tree' | 'illegal_construction_waste' | 'noise_pollution' | 'soil_contamination' | 'wildlife_threat' | 'other';
export type Severity = 'low' | 'medium' | 'high' | 'critical';

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
  severity: Severity;
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
  aiConfidence?: number;
  aiSuggestedPriority?: Severity;
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
}
