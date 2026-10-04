import { StyleSheet } from "react-native";
import type { ThemeColors } from "../utils/constants";

export const civicSpace = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  section: 24,
  page: 32,
} as const;
export const civicRadius = {
  chip: 8,
  button: 12,
  card: 16,
  major: 18,
  image: 16,
  round: 999,
} as const;

/** Citizen-scoped palette: never overrides the application's theme preference. */
export const getCivicColors = (base: ThemeColors, isDark: boolean) => ({
  ...base,
  background: isDark ? "#07101F" : base.background,
  surface: isDark ? "#0B1628" : base.surface,
  card: isDark ? "#0B1628" : base.card,
  elevated: isDark ? "#101D31" : "#F1F5F9",
  soft: isDark ? "#0D1A2B" : "#F8FAFC",
  highlight: isDark ? "#122238" : "#E2E8F0",
  primary: isDark ? "#22C55E" : base.primary,
  primaryDark: "#16A34A",
  greenSoft: isDark ? "rgba(34,197,94,0.12)" : "#DCFCE7",
  cyan: isDark ? "#38BDF8" : "#0284C7",
  cyanSoft: isDark ? "rgba(56,189,248,0.12)" : "#E0F2FE",
  warning: isDark ? "#F59E0B" : "#B45309",
  warningSoft: isDark ? "rgba(245,158,11,0.12)" : "#FEF3C7",
  danger: isDark ? "#F87171" : "#DC2626",
  dangerSoft: isDark ? "rgba(248,113,113,0.12)" : "#FEE2E2",
  text: isDark ? "#F8FAFC" : base.text,
  textSecondary: isDark ? "#CBD5E1" : "#475569",
  textMuted: isDark ? "#94A3B8" : base.textMuted,
  subtle: "#64748B",
  border: isDark ? "rgba(148,163,184,0.12)" : base.border,
  borderStrong: isDark ? "rgba(148,163,184,0.20)" : "#CBD5E1",
  divider: isDark ? "rgba(148,163,184,0.08)" : "#E2E8F0",
});

export const civicType = StyleSheet.create({
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: { fontSize: 24, fontWeight: "800", lineHeight: 30 },
  section: { fontSize: 16, fontWeight: "700", lineHeight: 22 },
  cardTitle: { fontSize: 14, fontWeight: "700", lineHeight: 20 },
  body: { fontSize: 13, fontWeight: "500", lineHeight: 20 },
  meta: { fontSize: 11, fontWeight: "500", lineHeight: 16 },
  technical: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    lineHeight: 15,
  },
  button: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    textAlign: "center",
  },
});

export const civicStyles = StyleSheet.create({
  content: {
    padding: civicSpace.lg,
    paddingBottom: civicSpace.section,
    gap: civicSpace.section,
  },
  card: {
    padding: civicSpace.lg,
    borderRadius: civicRadius.card,
    borderWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: civicRadius.button,
    paddingHorizontal: civicSpace.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: civicSpace.sm,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: civicRadius.button,
    paddingHorizontal: civicSpace.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: civicSpace.sm,
    borderWidth: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: civicRadius.button,
  },
});
