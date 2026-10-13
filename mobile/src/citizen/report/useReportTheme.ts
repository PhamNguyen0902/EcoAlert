import { useCivicTheme } from "../../shared/theme/useCivicTheme";
import { fieldColors } from "./components/stitch/fieldDesign";

export function useReportTheme() {
  const theme = useCivicTheme();
  // Field capture has its own dark sensor aesthetic, without changing app preferences.
  return {
    ...theme,
    colors: {
      ...theme.colors,
      ...fieldColors,
      card: fieldColors.elevated,
      textSecondary: fieldColors.secondary,
      textMuted: fieldColors.muted,
      secondary: fieldColors.cyan,
      accent: fieldColors.amber,
      destructive: fieldColors.red,
      greenSoft: "rgba(34,197,94,0.12)",
      cyanSoft: "rgba(56,189,248,0.12)",
      divider: "rgba(148,163,184,0.10)",
    },
  };
}
