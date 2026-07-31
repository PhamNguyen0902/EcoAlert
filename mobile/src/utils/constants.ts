import { Platform } from "react-native";

// Ưu tiên lấy URL từ file .env, nếu không có mới dùng giá trị mặc định
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === "android"
  ? "http://10.0.2.2:3000/api"
  : "http://localhost:3000/api");

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  accent: string;
  destructive: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  glassBg: string;
  glassBorder: string;
  isDark: boolean;
}

export const LIGHT_THEME: ThemeColors = {
  primary: "#16A34A",
  primaryDark: "#15803D",
  primaryLight: "#DCFCE7",
  secondary: "#3B82F6",
  accent: "#F59E0B",
  destructive: "#EF4444",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  text: "#0F172A",
  textMuted: "#64748B",
  border: "#E2E8F0",
  glassBg: "rgba(255, 255, 255, 0.85)",
  glassBorder: "rgba(226, 232, 240, 0.8)",
  isDark: false,
};

export const DARK_THEME: ThemeColors = {
  primary: "#22C55E",
  primaryDark: "#16A34A",
  primaryLight: "#064E3B",
  secondary: "#60A5FA",
  accent: "#FBBF24",
  destructive: "#F87171",
  background: "#0F172A",
  surface: "#1E293B",
  card: "#1E293B",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  border: "#334155",
  glassBg: "rgba(30, 41, 59, 0.85)",
  glassBorder: "rgba(51, 65, 85, 0.8)",
  isDark: true,
};

export const COLORS = LIGHT_THEME;

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PENDING: { bg: "#FFEDD5", text: "#C2410C", border: "#FED7AA" },
  pending: { bg: "#FFEDD5", text: "#C2410C", border: "#FED7AA" },
  AI_ANALYZING: { bg: "#E0E7FF", text: "#4338CA", border: "#C7D2FE" },
  ai_analyzing: { bg: "#E0E7FF", text: "#4338CA", border: "#C7D2FE" },
  VERIFIED: { bg: "#DBEAFE", text: "#1D4ED8", border: "#BFDBFE" },
  verified: { bg: "#DBEAFE", text: "#1D4ED8", border: "#BFDBFE" },
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

export const DARK_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PENDING: { bg: "rgba(234, 88, 12, 0.25)", text: "#FDBA74", border: "rgba(234, 88, 12, 0.4)" },
  pending: { bg: "rgba(234, 88, 12, 0.25)", text: "#FDBA74", border: "rgba(234, 88, 12, 0.4)" },
  AI_ANALYZING: { bg: "rgba(99, 102, 241, 0.25)", text: "#A5B4FC", border: "rgba(99, 102, 241, 0.4)" },
  ai_analyzing: { bg: "rgba(99, 102, 241, 0.25)", text: "#A5B4FC", border: "rgba(99, 102, 241, 0.4)" },
  VERIFIED: { bg: "rgba(59, 130, 246, 0.25)", text: "#93C5FD", border: "rgba(59, 130, 246, 0.4)" },
  verified: { bg: "rgba(59, 130, 246, 0.25)", text: "#93C5FD", border: "rgba(59, 130, 246, 0.4)" },
  ASSIGNED: { bg: "rgba(245, 158, 11, 0.25)", text: "#FDE047", border: "rgba(245, 158, 11, 0.4)" },
  assigned: { bg: "rgba(245, 158, 11, 0.25)", text: "#FDE047", border: "rgba(245, 158, 11, 0.4)" },
  IN_PROGRESS: { bg: "rgba(2, 132, 199, 0.25)", text: "#7DD3FC", border: "rgba(2, 132, 199, 0.4)" },
  in_progress: { bg: "rgba(2, 132, 199, 0.25)", text: "#7DD3FC", border: "rgba(2, 132, 199, 0.4)" },
  RESOLVED: { bg: "rgba(22, 163, 74, 0.25)", text: "#86EFAC", border: "rgba(22, 163, 74, 0.4)" },
  resolved: { bg: "rgba(22, 163, 74, 0.25)", text: "#86EFAC", border: "rgba(22, 163, 74, 0.4)" },
  CLOSED: { bg: "rgba(148, 163, 184, 0.2)", text: "#CBD5E1", border: "rgba(148, 163, 184, 0.4)" },
  closed: { bg: "rgba(148, 163, 184, 0.2)", text: "#CBD5E1", border: "rgba(148, 163, 184, 0.4)" },
  REJECTED: { bg: "rgba(220, 38, 38, 0.25)", text: "#FCA5A5", border: "rgba(220, 38, 38, 0.4)" },
  rejected: { bg: "rgba(220, 38, 38, 0.25)", text: "#FCA5A5", border: "rgba(220, 38, 38, 0.4)" },
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

