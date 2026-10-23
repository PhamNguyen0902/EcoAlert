import React, { useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Clock,
  MapPin,
  Play,
  Power,
  RotateCw,
  Shield,
} from "lucide-react-native";
import {
  useCurrentShift,
  useEndShift,
  useStartShift,
} from "../../shared/hooks/useAlerts";
import { useProfile } from "../../auth/hooks/useAuth";
import { useOfficerPosition } from "../hooks/useOfficerPosition";
import { useAssignedServiceAreas } from "../hooks/useServiceAreas";
import { useCivicTheme } from "../../shared/theme/useCivicTheme";
import { officerErrorMessage } from "../utils/officerWorkflow";
import { officerDate } from "../utils/officerPresentation";

const formatShiftTime = (isoString?: string) => {
  if (!isoString || !Number.isFinite(Date.parse(isoString))) {
    return "Chưa ghi nhận";
  }
  const date = new Date(isoString);
  const time = date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });
  return `${time} · ${day}`;
};

export function OfficerShiftCard() {
  const { colors, isDark } = useCivicTheme();
  const shift = useCurrentShift();
  const start = useStartShift();
  const end = useEndShift();
  const gps = useOfficerPosition();
  const { data: profile } = useProfile();
  const areas = useAssignedServiceAreas(profile?._id);

  const lock = useRef(false);

  const isShiftActive = shift.data?.status === "ACTIVE";
  const isOperating = gps.pending || start.isPending || end.isPending;

  const assignedAreaText =
    areas.data?.pages
      .flatMap((page) => page.items)
      .slice(0, 2)
      .map((item) => item.name)
      .join(" · ") || "";

  const handleStartShift = async () => {
    if (lock.current || isOperating || shift.isLoading) return;
    lock.current = true;
    try {
      const fresh = await gps.refresh();
      if (!fresh) {
        Alert.alert(
          "Không thể xác định vị trí GPS",
          "Vui lòng bật định vị GPS trên thiết bị và cấp quyền truy cập để bắt đầu ca trực.",
        );
        return;
      }
      await start.mutateAsync({
        latitude: fresh.latitude,
        longitude: fresh.longitude,
        accuracyMeters: fresh.accuracyMeters,
      });
    } catch (error) {
      Alert.alert(
        "Chưa bắt đầu được ca trực",
        officerErrorMessage(error, "Vui lòng kiểm tra kết nối GPS và thử lại."),
      );
    } finally {
      lock.current = false;
    }
  };

  const handleEndShift = async () => {
    if (lock.current || isOperating || shift.isLoading) return;
    lock.current = true;
    try {
      const fresh = await gps.refresh();
      if (!fresh) {
        Alert.alert(
          "Không thể xác định vị trí GPS",
          "Vui lòng bật định vị GPS trên thiết bị để ghi nhận vị trí kết thúc ca.",
        );
        return;
      }
      await end.mutateAsync({
        latitude: fresh.latitude,
        longitude: fresh.longitude,
        accuracyMeters: fresh.accuracyMeters,
      });
    } catch (error) {
      Alert.alert(
        "Chưa kết thúc được ca trực",
        officerErrorMessage(error, "Vui lòng thử lại."),
      );
    } finally {
      lock.current = false;
    }
  };

  const confirmEndShift = () => {
    Alert.alert(
      "Kết thúc ca trực?",
      "Tọa độ GPS hiện tại sẽ được ghi nhận khi kết thúc ca trực. Bạn có chắc chắn muốn kết thúc?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Kết thúc ca",
          style: "destructive",
          onPress: () => void handleEndShift(),
        },
      ],
    );
  };

  // Trạng thái lỗi tải dữ liệu ca trực
  if (shift.isError) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark
              ? "rgba(30, 41, 59, 0.7)"
              : "rgba(255, 255, 255, 0.9)",
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.labelWithIcon}>
            <Shield size={16} color={colors.warning} />
            <Text style={[styles.statusTitle, { color: colors.warning }]}>
              THÔNG TIN CA TRỰC
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tải lại thông tin ca trực"
            style={[styles.retryBtn, { borderColor: colors.border }]}
            onPress={() => void shift.refetch()}
          >
            <RotateCw size={13} color={colors.primary} />
            <Text style={[styles.retryText, { color: colors.primary }]}>
              Thử lại
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.bodyText, { color: colors.textMuted }]}>
          Không thể đồng bộ thông tin ca trực. Vui lòng bấm thử lại.
        </Text>
      </View>
    );
  }

  // TRẠNG THÁI 1: ĐANG TRONG CA TRỰC (ACTIVE SHIFT)
  if (isShiftActive) {
    return (
      <View
        style={[
          styles.container,
          styles.activeContainer,
          {
            backgroundColor: isDark
              ? "rgba(6, 78, 59, 0.22)"
              : "rgba(236, 253, 245, 0.85)",
            borderColor: isDark
              ? "rgba(16, 185, 129, 0.35)"
              : "rgba(16, 185, 129, 0.25)",
          },
        ]}
      >
        <View style={styles.headerRow}>
          {/* nhãn chỉ báo trạng thái phát sáng */}
          <View style={styles.activePill}>
            <View style={styles.pulseContainer}>
              <View style={styles.pulseRing} />
              <View style={styles.pulseCore} />
            </View>
            <Text style={styles.activeBadgeText}>ĐANG TRONG CA TRỰC</Text>
          </View>

          {/* Nút Kết thúc ca */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kết thúc ca trực"
            disabled={isOperating}
            onPress={confirmEndShift}
            style={({ pressed }) => [
              styles.endShiftButton,
              {
                opacity: pressed || isOperating ? 0.7 : 1,
                borderColor: isDark
                  ? "rgba(239, 68, 68, 0.35)"
                  : "rgba(239, 68, 68, 0.25)",
                backgroundColor: isDark
                  ? "rgba(239, 68, 68, 0.12)"
                  : "rgba(254, 242, 242, 0.9)",
              },
            ]}
          >
            {isOperating && end.isPending ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <>
                <Power size={13} color="#EF4444" />
                <Text style={styles.endShiftText}>Kết thúc ca</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Thông tin ca trực: thời gian bắt đầu và khu vực phụ trách */}
        <View style={styles.infoGrid}>
          <View style={styles.infoRow}>
            <Clock
              size={13}
              color={isDark ? "rgba(255,255,255,0.6)" : "rgba(15, 23, 42, 0.6)"}
            />
            <Text
              style={[
                styles.infoText,
                {
                  color: isDark
                    ? "rgba(255,255,255,0.85)"
                    : "rgba(15, 23, 42, 0.85)",
                },
              ]}
            >
              Bắt đầu lúc:{" "}
              <Text style={{ fontWeight: "700" }}>
                {formatShiftTime(shift.data?.startedAt)}
              </Text>
            </Text>
          </View>

          {assignedAreaText ? (
            <View style={styles.infoRow}>
              <MapPin
                size={13}
                color={
                  isDark
                    ? "rgba(255,255,255,0.6)"
                    : "rgba(15, 23, 42, 0.6)"
                }
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.infoText,
                  {
                    color: isDark
                      ? "rgba(255,255,255,0.85)"
                      : "rgba(15, 23, 42, 0.85)",
                  },
                ]}
              >
                Khu vực:{" "}
                <Text style={{ fontWeight: "700" }}>{assignedAreaText}</Text>
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  // TRẠNG THÁI 2: CHƯA VÀO CA TRỰC (INACTIVE SHIFT)
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? "rgba(15, 23, 42, 0.75)"
            : "rgba(255, 255, 255, 0.95)",
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.08)"
            : "rgba(0, 0, 0, 0.08)",
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.labelWithIcon}>
          <Shield
            size={15}
            color={isDark ? colors.textMuted : colors.textSecondary}
          />
          <Text
            style={[
              styles.statusTitle,
              { color: isDark ? colors.textMuted : colors.textSecondary },
            ]}
          >
            TRẠNG THÁI CA TRỰC
          </Text>
        </View>
        <View
          style={[
            styles.inactiveBadge,
            {
              backgroundColor: isDark
                ? "rgba(148, 163, 184, 0.12)"
                : "rgba(148, 163, 184, 0.15)",
            },
          ]}
        >
          <Text
            style={[
              styles.inactiveBadgeText,
              { color: isDark ? "#94A3B8" : "#64748B" },
            ]}
          >
            CHƯA VÀO CA
          </Text>
        </View>
      </View>

      <Text
        style={[
          styles.promptText,
          { color: isDark ? colors.textSecondary : colors.text },
        ]}
      >
        Bạn chưa bắt đầu ca trực. Hãy bật ca trực để nhận nhiệm vụ hiện trường.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bắt đầu ca trực ngay"
        disabled={isOperating || shift.isLoading}
        onPress={() => void handleStartShift()}
        style={({ pressed }) => [
          styles.startCtaButton,
          {
            opacity: pressed || isOperating ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          },
        ]}
      >
        {isOperating && (gps.pending || start.isPending) ? (
          <View style={styles.ctaContentRow}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.startCtaText}>Đang nhận vị trí GPS...</Text>
          </View>
        ) : (
          <View style={styles.ctaContentRow}>
            <Play size={15} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.startCtaText}>BẮT ĐẦU CA TRỰC NGAY</Text>
          </View>
        )}
      </Pressable>

      {gps.error && (
        <Text style={[styles.gpsErrorText, { color: colors.warning }]}>
          Lưu ý: Không thể lấy tọa độ GPS chính xác. Vui lòng bật định vị trước
          khi bắt đầu.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activeContainer: {
    borderLeftWidth: 3,
    borderLeftColor: "#10B981",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  labelWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 20,
    gap: 6,
  },
  pulseContainer: {
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(16, 185, 129, 0.3)",
  },
  pulseCore: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  activeBadgeText: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  inactiveBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  inactiveBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  endShiftButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 5,
  },
  endShiftText: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "700",
  },
  infoGrid: {
    gap: 6,
    paddingTop: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 16,
  },
  promptText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  startCtaButton: {
    backgroundColor: "#10B981",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  ctaContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  startCtaText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  retryText: {
    fontSize: 11,
    fontWeight: "600",
  },
  bodyText: {
    fontSize: 12,
    lineHeight: 17,
  },
  gpsErrorText: {
    fontSize: 11,
    lineHeight: 15,
  },
});
