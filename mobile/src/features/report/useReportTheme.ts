import { useTheme } from "../../context/ThemeContext";

/** Report-only surfaces, respecting the application's light-mode preference. */
export const useReportTheme = () => {
  const theme = useTheme();
  return {
    ...theme,
    colors: {
      ...theme.colors,
      card: theme.isDark ? "#0B1628" : theme.colors.card,
      elevated: theme.isDark ? "#101D31" : "#F1F5F9",
      soft: theme.isDark ? "#0D1A2B" : "#F8FAFC",
      textSecondary: theme.isDark ? "#CBD5E1" : "#475569",
      subtle: "#64748B",
      border: theme.isDark ? "rgba(148,163,184,0.12)" : theme.colors.border,
      divider: theme.isDark ? "rgba(148,163,184,0.08)" : "#E2E8F0",
      greenSoft: theme.isDark ? "rgba(34,197,94,0.12)" : "#DCFCE7",
      cyanSoft: theme.isDark ? "rgba(56,189,248,0.12)" : "#E0F2FE",
    },
  };
};
