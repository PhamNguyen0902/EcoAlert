import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { civicType } from "../../../shared/theme/civicDesign";
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
  intro: { gap: 6 },
  eyebrow: civicType.eyebrow,
  title: { ...civicType.title, fontSize: 23, lineHeight: 29 },
  description: civicType.body,
});
