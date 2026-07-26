import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { AlertCircle, CheckCircle } from "lucide-react-native";
import { COLORS } from "../../utils/constants";

interface InlineBannerProps {
  message?: string | null;
  type?: "error" | "success" | "info";
}

export const InlineBanner: React.FC<InlineBannerProps> = ({ message, type = "error" }) => {
  if (!message) return null;

  const isError = type === "error";
  const bg = isError ? "#FEE2E2" : "#DCFCE7";
  const textClr = isError ? COLORS.destructive : "#16A34A";
  const IconComp = isError ? AlertCircle : CheckCircle;

  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <IconComp size={16} color={textClr} style={{ marginRight: 8 }} />
      <Text style={[styles.text, { color: textClr }]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
});
