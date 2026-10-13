import { useTheme } from "../context/ThemeContext";
import { getCivicColors } from "./civicDesign";

export const useCivicTheme = () => {
  const theme = useTheme();
  return { ...theme, colors: getCivicColors(theme.colors, theme.isDark) };
};
