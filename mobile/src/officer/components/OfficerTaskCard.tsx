import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { MapPin, ImageOff } from "lucide-react-native";
import type { Alert } from "../../shared/types";
import { useCivicTheme } from "../../shared/theme/useCivicTheme";
import { getOfficerTaskState } from "../utils/officerWorkflow";
import {
  getCategoryLabel,
  getSeverityLabel,
} from "../../shared/utils/incidentPresentation";
import {
  officerDate,
  officerImage,
  officerReference,
} from "../utils/officerPresentation";
import { OfficerBadge, officerStyles as s } from "./OfficerUI";
import { useOfficerShiftGuard } from "../hooks/useOfficerShiftGuard";

// thẻ hiển thị tóm tắt một nhiệm vụ gồm ảnh, trạng thái, địa chỉ và mã hồ sơ
export function OfficerTaskCard({
  task,
  onPress,
  compact = false,
}: {
  task: Alert;
  onPress: () => void;
  compact?: boolean;
}) {
  const { colors } = useCivicTheme();
  const { isOnShift, assertOnShiftWithAlert } = useOfficerShiftGuard();

  // lấy màu sắc và nhãn trạng thái tiến độ của nhiệm vụ
  const state = getOfficerTaskState(task);
  const image = officerImage(task);

  const isFieldAction =
    state.action === "RESOLVE" || state.action === "CHECK_IN";

  const handleCtaPress = () => {
    if (isFieldAction && !isOnShift) {
      assertOnShiftWithAlert(onPress);
    } else {
      onPress();
    }
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${task.title}. ${state.label}. Xem chi tiết nhiệm vụ`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.elevated,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      <View style={s.row}>
        <OfficerBadge label={state.label} color={state.color} />
        <Text
          style={[
            s.technical,
            s.grow,
            { color: colors.textMuted, textAlign: "right" },
          ]}
        >
          {officerReference(task)}
        </Text>
      </View>
      <View style={[s.row, { alignItems: "flex-start" }]}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={[styles.image, compact && styles.smallImage]}
          />
        ) : (
          <View
            style={[
              styles.image,
              compact && styles.smallImage,
              {
                backgroundColor: colors.soft,
                alignItems: "center",
                justifyContent: "center",
              },
            ]}
          >
            <ImageOff size={22} color={colors.textMuted} />
          </View>
        )}
        <View style={[s.grow, { gap: 5 }]}>
          <Text style={[s.technical, { color: colors.cyan }]}>
            {getCategoryLabel(task.category)}
          </Text>
          <Text numberOfLines={2} style={[s.heading, { color: colors.text }]}>
            {task.title}
          </Text>
          <View style={[s.row, { alignItems: "flex-start", gap: 4 }]}>
            <MapPin size={12} color={colors.primary} />
            <Text
              numberOfLines={2}
              style={[s.meta, s.grow, { color: colors.textSecondary }]}
            >
              {task.address || "Đã ghi nhận vị trí GPS"}
            </Text>
          </View>
        </View>
      </View>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        <Text style={[s.meta, s.grow, { color: colors.textMuted }]}>
          {officerDate(task.assignedAt || task.createdAt)}
        </Text>
        <Text style={[s.meta, { color: colors.warning }]}>
          {getSeverityLabel(task.severity)}
        </Text>
      </View>
      {!compact && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isFieldAction ? "Tiếp tục xử lý sự cố" : "Xem chi tiết nhiệm vụ"
          }
          onPress={handleCtaPress}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: colors.greenSoft,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[s.technical, { color: colors.primary }]}>
            {isFieldAction ? "TIẾP TỤC XỬ LÝ ›" : "XEM CHI TIẾT NHIỆM VỤ ›"}
          </Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  image: { width: 92, height: 102, borderRadius: 10 },
  smallImage: { width: 64, height: 72 },
  cta: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
});
