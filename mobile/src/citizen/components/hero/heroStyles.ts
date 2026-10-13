import { StyleSheet } from "react-native";
import { civicSpace, civicType } from "../../../shared/theme/civicDesign";

export const heroPalette = (dark: boolean) => ({
  background: dark ? "#07101F" : "#F0FAF6",
  gradient: dark
    ? (["#101D31", "#0B1628", "#07101F"] as const)
    : (["#F8FFFC", "#ECFAF4", "#E6F4F8"] as const),
  mask: dark
    ? ([
        "rgba(11,22,40,0.92)",
        "rgba(11,22,40,0.52)",
        "rgba(11,22,40,0)",
      ] as const)
    : ([
        "rgba(248,255,252,0.94)",
        "rgba(248,255,252,0.48)",
        "rgba(248,255,252,0)",
      ] as const),
  text: dark ? "#F8FAFC" : "#122B35",
  secondary: dark ? "#CBD5E1" : "#365761",
  muted: dark ? "#94A3B8" : "#526E76",
  green: dark ? "#4ADE80" : "#15803D",
  cyan: dark ? "#38BDF8" : "#036B91",
  border: dark ? "rgba(56,189,248,0.19)" : "rgba(21,128,61,0.17)",
  badge: dark ? "rgba(34,197,94,0.13)" : "#D9F5E4",
  report: ["#4ADE80", "#22C55E"] as const,
  tracking: dark
    ? (["#172D40", "#101D31"] as const)
    : (["#E0F2FE", "#D6EBF3"] as const),
});
export type HeroPalette = ReturnType<typeof heroPalette>;

export const heroStyles = StyleSheet.create({
  shell: {
    borderRadius: 26,
    shadowColor: "#051420",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
  },
  card: { borderRadius: 26, borderWidth: 1, overflow: "hidden" },
  content: { padding: civicSpace.lg, paddingVertical: 14, gap: 7 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  brand: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  brandCaption: {
    ...civicType.meta,
    flex: 1,
    textAlign: "right",
    fontSize: 10,
  },
  main: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 136 },
  copy: { flex: 1, minWidth: 0, gap: 4, paddingVertical: 3 },
  greeting: { fontSize: 12, lineHeight: 17, fontWeight: "500" },
  name: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeDot: { width: 4, height: 4, borderRadius: 2 },
  badgeText: {
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.8,
    fontWeight: "800",
  },
  slogan: { fontSize: 12, lineHeight: 18, fontWeight: "500", marginTop: 1 },
});
