import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReportTheme } from "../useReportTheme";

export const ReportBottomActions = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useReportTheme();
  return (
    <View
      style={[
        styles.actions,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.divider,
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      {children}
    </View>
  );
};
const styles = StyleSheet.create({
  actions: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, gap: 8 },
});
