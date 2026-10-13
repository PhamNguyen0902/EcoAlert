import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useCivicTheme } from "../../../../theme/useCivicTheme";
import { civicType } from "../../../../theme/civicDesign";
import { reportProgress } from "../../model/citizenPresentation";

export const CitizenReportProgress = ({ status }: { status: string }) => {
  const { colors } = useCivicTheme();
  if (status.toUpperCase() === "REJECTED")
    return (
      <Text style={[civicType.meta, { color: colors.danger }]}>
        Báo cáo không được tiếp nhận
      </Text>
    );
  const progress = reportProgress(status);
  return (
    <View
      accessibilityLabel={`Tiến độ theo trạng thái: ${progress}/3 giai đoạn`}
      style={styles.row}
    >
      {["Tiếp nhận", "Đang xử lý", "Hoàn thành"].map((label, index) => (
        <View key={label} style={styles.step}>
          <View
            style={[
              styles.bar,
              {
                backgroundColor:
                  index < progress ? colors.primary : colors.highlight,
              },
            ]}
          />
          <Text
            style={[
              civicType.meta,
              { color: index < progress ? colors.primary : colors.textMuted },
            ]}
          >
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
};
const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  step: { flex: 1, gap: 6 },
  bar: { height: 3, borderRadius: 2 },
});
