import React from "react";
import { ScrollView, Pressable, Text } from "react-native";
import { useCivicTheme } from "../../theme/useCivicTheme";
import type { Alert } from "../../types";
import {
  filterOfficerTasks,
  type OfficerTaskFilter,
} from "../../utils/officerWorkflow";
export function OfficerTaskFilters({
  tasks,
  value,
  onChange,
}: {
  tasks: Alert[];
  value: OfficerTaskFilter;
  onChange: (value: OfficerTaskFilter) => void;
}) {
  const { colors } = useCivicTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6 }}
    >
      {(
        [
          ["ALL", "Tất cả"],
          ["NEW", "Chờ xử lý"],
          ["ACTIVE", "Đang làm"],
          ["COMPLETED", "Đã xử lý"],
        ] as const
      ).map(([key, label]) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityState={{ selected: value === key }}
          onPress={() => onChange(key)}
          style={{
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: 12,
            borderRadius: 22,
            backgroundColor: value === key ? colors.primary : colors.elevated,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: value === key ? "#07101F" : colors.textSecondary,
            }}
          >
            {label} · {filterOfficerTasks(tasks, key).length}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
