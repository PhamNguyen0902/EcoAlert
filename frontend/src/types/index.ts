export type UserRole =
  | "ADMIN"
  | "OFFICER"
  | "CITIZEN"; export type AlertStatus = 'pending' | 'ai_analyzing' | 'verified' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'rejected';
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
  aiConfidence?: number;
  aiSuggestedPriority?: Severity;
  officerNote?: string;
  resolvedAt?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
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
  errors?: any;
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
