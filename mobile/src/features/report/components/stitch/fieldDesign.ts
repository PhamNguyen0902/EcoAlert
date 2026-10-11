import { StyleSheet } from "react-native";

/** ReportFlow-only tokens; the Citizen/Officer/Admin themes are not modified. */
export const fieldColors = {
  background: "#07101F", surface: "#0B1628", elevated: "#101D31",
  primary: "#22C55E", cta: "#4ADE80", cyan: "#38BDF8", amber: "#F59E0B",
  red: "#F87171", text: "#F8FAFC", secondary: "#CBD5E1", muted: "#94A3B8",
  border: "rgba(56,189,248,0.14)",
} as const;

export const fieldStyles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 24, gap: 16 },
  card: { backgroundColor: fieldColors.elevated, borderWidth: 1, borderColor: fieldColors.border, borderRadius: 16, padding: 14, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyebrow: { fontSize: 10, lineHeight: 15, fontWeight: "800", letterSpacing: 0.7 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: "800", color: fieldColors.text },
  body: { fontSize: 13, lineHeight: 20, color: fieldColors.secondary },
  meta: { fontSize: 11, lineHeight: 16, color: fieldColors.muted },
  button: { minHeight: 54, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: fieldColors.cta },
  buttonText: { fontSize: 14, lineHeight: 20, fontWeight: "800", color: fieldColors.background, textAlign: "center", flexShrink: 1 },
});
