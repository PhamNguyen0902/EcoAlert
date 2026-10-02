import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useReportTheme } from "../useReportTheme";

export const ReportScreenIntro = ({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) => {
  const { colors } = useReportTheme();
  return (
    <View style={styles.intro}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textMuted }]}>
        {description}
      </Text>
    </View>
  );
};
const styles = StyleSheet.create({
  intro: { gap: 8 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  description: { fontSize: 13, lineHeight: 19, fontWeight: "400" },
});
