import { Platform } from "react-native";

// Ưu tiên lấy URL từ file .env, nếu không có mới dùng giá trị mặc định
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === "android"
  ? "http://10.0.2.2:3000/api"
  : "http://localhost:3000/api");

export const COLORS = {
  // Brand / Theme
  primary: "#16A34A",       // Emerald 600
  primaryDark: "#15803D",   // Emerald 700
  primaryLight: "#DCFCE7",  // Emerald 100
  secondary: "#3B82F6",     // Blue 500
  accent: "#F59E0B",        // Amber 500
  destructive: "#EF4444",   // Red 500

  // Backgrounds & Surface
  background: "#F8FAFC",    // Slate 50
  surface: "#FFFFFF",
  surfaceDark: "#0F172A",   // Slate 900
  card: "#FFFFFF",
  cardDark: "#1E293B",      // Slate 800

  // Typography
  text: "#0F172A",          // Slate 900
  textMuted: "#64748B",     // Slate 500
  textLight: "#F8FAFC",     // Slate 50
  border: "#E2E8F0",        // Slate 200
  borderDark: "#334155",    // Slate 700

  // Glassmorphism
  glassBg: "rgba(255, 255, 255, 0.75)",
  glassBorder: "rgba(255, 255, 255, 0.4)",
  glassBgDark: "rgba(15, 23, 42, 0.8)",
  glassBorderDark: "rgba(255, 255, 255, 0.1)",
};

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PENDING: { bg: "#FFEDD5", text: "#C2410C", border: "#FED7AA" },
  pending: { bg: "#FFEDD5", text: "#C2410C", border: "#FED7AA" },
  AI_ANALYZING: { bg: "#E0E7FF", text: "#4338CA", border: "#C7D2FE" },
  ai_analyzing: { bg: "#E0E7FF", text: "#4338CA", border: "#C7D2FE" },
  VERIFIED: { bg: "#DBAFEFE", text: "#1D4ED8", border: "#BFDBFE" },
  verified: { bg: "#DBAFEFE", text: "#1D4ED8", border: "#BFDBFE" },
  ASSIGNED: { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" },
  assigned: { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" },
  IN_PROGRESS: { bg: "#E0F2FE", text: "#0369A1", border: "#BAE6FD" },
  in_progress: { bg: "#E0F2FE", text: "#0369A1", border: "#BAE6FD" },
  RESOLVED: { bg: "#DCFCE7", text: "#15803D", border: "#BBF7D0" },
  resolved: { bg: "#DCFCE7", text: "#15803D", border: "#BBF7D0" },
  CLOSED: { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" },
  closed: { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" },
  REJECTED: { bg: "#FEE2E2", text: "#B91C1C", border: "#FECACA" },
  rejected: { bg: "#FEE2E2", text: "#B91C1C", border: "#FECACA" },
};

export const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: "#F1F5F9", text: "#475569" },
  LOW: { bg: "#F1F5F9", text: "#475569" },
  medium: { bg: "#FEF3C7", text: "#D97706" },
  MEDIUM: { bg: "#FEF3C7", text: "#D97706" },
  high: { bg: "#FFEDD5", text: "#EA580C" },
  HIGH: { bg: "#FFEDD5", text: "#EA580C" },
  critical: { bg: "#FEE2E2", text: "#DC2626" },
  CRITICAL: { bg: "#FEE2E2", text: "#DC2626" },
};
