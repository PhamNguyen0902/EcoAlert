import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Camera,
  CheckCircle2,
  Crosshair,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ReportFlowParamList } from "../../../navigation/types";
import { useReportTheme } from "../useReportTheme";
import { ReportScreenIntro } from "../components/ReportScreenIntro";
import { ReportBottomActions } from "../components/ReportBottomActions";
import { useLocation } from "../../../hooks/useLocation";
import { useFieldReport } from "../FieldReportContext";
import { MAX_FIELD_GPS_ACCURACY_METERS } from "../types";
import { ReportHeader } from "../components/ReportHeader";
import { ReportProgress } from "../components/ReportProgress";

type Props = NativeStackScreenProps<ReportFlowParamList, "ReportLocation">;

const accuracyTone = (accuracy: number | null) =>
  accuracy === null
    ? "missing"
    : accuracy <= 15
      ? "excellent"
      : accuracy <= 30
        ? "good"
        : accuracy <= 50
          ? "acceptable"
          : "weak";

export const ReportLocationScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useReportTheme();
  const { draft, setDraft } = useFieldReport();
  const {
    coords,
    address,
    accuracyMeters,
    capturedAt,
    source,
    loading,
    error,
    errorCode,
    addressResolved,
    fetchLocation,
  } = useLocation();
  const requestedRef = useRef(false);

  const acquireLocation = useCallback(async () => {
    const result = await fetchLocation();
    if (!result?.coords || result.accuracyMeters === null) return;
    const accuracy = result.accuracyMeters;
    setDraft((current) => ({
      ...current,
      location: {
        latitude: result.coords.coordinates[1],
        longitude: result.coords.coordinates[0],
        accuracyMeters: accuracy,
        address: result.address,
        capturedAt: result.capturedAt,
        source: "DEVICE_GPS",
      },
    }));
  }, [fetchLocation, setDraft]);

  useEffect(() => {
    if (!draft.location && !requestedRef.current) {
      requestedRef.current = true;
      void acquireLocation();
    }
  }, [acquireLocation, draft.location]);

  const shownLocation =
    coords && accuracyMeters !== null && capturedAt
      ? {
          latitude: coords.coordinates[1],
          longitude: coords.coordinates[0],
          accuracyMeters,
          address,
          capturedAt,
          source: source === "device" ? ("DEVICE_GPS" as const) : undefined,
        }
      : draft.location;
  const ready = Boolean(
    shownLocation?.source === "DEVICE_GPS" &&
    shownLocation.accuracyMeters <= MAX_FIELD_GPS_ACCURACY_METERS,
  );
  const tone = accuracyTone(shownLocation?.accuracyMeters ?? null);
  const toneColor =
    tone === "weak"
      ? colors.destructive
      : tone === "acceptable"
        ? colors.accent
        : tone === "missing"
          ? colors.textMuted
          : tone === "good"
            ? colors.secondary
            : colors.primary;
  const accuracyLabel = useMemo(
    () =>
      tone === "excellent"
        ? "Rất tốt"
        : tone === "good"
          ? "Tốt"
          : tone === "acceptable"
            ? "Chấp nhận được"
            : tone === "weak"
              ? "Kém"
              : "Chưa có",
    [tone],
  );

  const addressParts =
    shownLocation?.address
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean) ?? [];
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <ReportHeader onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ReportProgress step={1} />
        <ReportScreenIntro
          eyebrow="XÁC MINH HIỆN TRƯỜNG"
          title="Xác minh vị trí"
          description="EcoAlert sử dụng vị trí thiết bị tại thời điểm chụp để tăng độ tin cậy của báo cáo."
        />
        <View
          style={[
            styles.locationCard,
            {
              backgroundColor: colors.card,
              borderColor: shownLocation
                ? ready
                  ? "rgba(34,197,94,0.22)"
                  : "rgba(245,158,11,0.30)"
                : colors.border,
            },
          ]}
        >
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: loading
                    ? colors.cyanSoft
                    : ready
                      ? colors.greenSoft
                      : "rgba(245,158,11,0.12)",
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.secondary} />
              ) : ready ? (
                <CheckCircle2 size={14} color={colors.primary} />
              ) : (
                <Crosshair size={14} color={colors.accent} />
              )}
              <Text
                style={[
                  styles.statusText,
                  {
                    color: loading
                      ? colors.secondary
                      : ready
                        ? colors.primary
                        : colors.accent,
                  },
                ]}
              >
                {loading
                  ? "ĐANG LẤY VỊ TRÍ"
                  : ready
                    ? "VỊ TRÍ ĐỦ CHÍNH XÁC"
                    : shownLocation
                      ? "TÍN HIỆU YẾU"
                      : "CHƯA CÓ VỊ TRÍ"}
              </Text>
            </View>
            <Text style={[styles.deviceLabel, { color: colors.subtle }]}>
              DEVICE GPS
            </Text>
          </View>
          <View style={styles.addressBlock}>
            <Text style={[styles.label, { color: colors.textMuted }]}>
              VỊ TRÍ HIỆN TẠI
            </Text>
            <Text style={[styles.address, { color: colors.text }]}>
              {shownLocation
                ? addressParts[0] || "Đã ghi nhận vị trí GPS"
                : loading
                  ? "Đang xác định vị trí…"
                  : "Chờ vị trí thiết bị"}
            </Text>
            <Text
              style={[styles.addressDetail, { color: colors.textSecondary }]}
            >
              {shownLocation
                ? addressParts.slice(1).join(", ") ||
                  "Tọa độ được ghi nhận từ thiết bị."
                : "Bật GPS và cho phép EcoAlert truy cập vị trí."}
            </Text>
          </View>
          <View style={[styles.metrics, { backgroundColor: colors.elevated }]}>
            <View style={styles.metric}>
              <Text style={[styles.label, { color: colors.textMuted }]}>
                TỌA ĐỘ GPS
              </Text>
              <Text style={[styles.coordinate, { color: colors.text }]}>
                {shownLocation?.latitude.toFixed(6) ?? "—"}
              </Text>
              <Text style={[styles.coordinate, { color: colors.text }]}>
                {shownLocation?.longitude.toFixed(6) ?? "—"}
              </Text>
            </View>
            <View
              style={[
                styles.metric,
                styles.metricRight,
                { borderLeftColor: colors.divider },
              ]}
            >
              <Text style={[styles.label, { color: colors.textMuted }]}>
                ĐỘ CHÍNH XÁC
              </Text>
              <Text style={[styles.accuracy, { color: toneColor }]}>
                {shownLocation
                  ? `±${Math.round(shownLocation.accuracyMeters)} m`
                  : "—"}
              </Text>
              <Text style={[styles.rating, { color: toneColor }]}>
                {accuracyLabel}
              </Text>
            </View>
          </View>
          <View style={styles.trustNote}>
            <ShieldCheck size={16} color={colors.primary} />
            <Text style={[styles.trustText, { color: colors.textMuted }]}>
              {addressResolved
                ? "Địa chỉ được xác định tự động từ GPS thiết bị."
                : "Tọa độ được lấy trực tiếp từ thiết bị. Địa chỉ sẽ hiển thị khi dịch vụ khả dụng."}
            </Text>
          </View>
        </View>
        {error ? (
          <View
            style={[
              styles.errorCard,
              { backgroundColor: "rgba(248,113,113,0.12)" },
            ]}
          >
            <TriangleAlert size={20} color={colors.destructive} />
            <View style={styles.errorCopy}>
              <Text style={[styles.errorTitle, { color: colors.text }]}>
                {errorCode === "PERMISSION_DENIED"
                  ? "Cần quyền vị trí"
                  : "Chưa thể lấy GPS"}
              </Text>
              <Text style={[styles.errorBody, { color: colors.textSecondary }]}>
                {errorCode === "PERMISSION_DENIED"
                  ? "Cho phép truy cập vị trí để tạo báo cáo tại hiện trường."
                  : "Hãy kiểm tra GPS và thử lại."}
              </Text>
              {errorCode === "PERMISSION_DENIED" ? (
                <TouchableOpacity
                  onPress={() => void Linking.openSettings()}
                  style={styles.textButton}
                  accessibilityRole="button"
                >
                  <Text
                    style={[styles.textButtonText, { color: colors.secondary }]}
                  >
                    MỞ CÀI ĐẶT
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}
        {!ready && shownLocation ? (
          <Text style={[styles.warningText, { color: colors.accent }]}>
            Vị trí hiện chưa đủ chính xác. Hãy di chuyển đến nơi thoáng hơn hoặc
            bật độ chính xác cao rồi lấy lại GPS.
          </Text>
        ) : null}
      </ScrollView>
      <ReportBottomActions>
        <TouchableOpacity
          onPress={() => navigation.navigate("ReportCamera")}
          disabled={!ready || loading}
          style={[
            styles.primaryButton,
            {
              backgroundColor: colors.primary,
              opacity: ready && !loading ? 1 : 0.45,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Tiếp tục chụp ảnh"
        >
          <Camera size={18} color="#07101F" />
          <Text style={styles.primaryText}>TIẾP TỤC CHỤP ẢNH</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => void acquireLocation()}
          disabled={loading}
          style={styles.textButton}
          accessibilityRole="button"
        >
          <RefreshCw size={15} color={colors.textMuted} />
          <Text style={[styles.textButtonText, { color: colors.textMuted }]}>
            {loading ? "Đang lấy vị trí…" : "LẤY LẠI GPS"}
          </Text>
        </TouchableOpacity>
      </ReportBottomActions>
    </View>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 24, gap: 24 },
  locationCard: { borderWidth: 1, borderRadius: 18, padding: 20, gap: 24 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  statusText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  deviceLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.6 },
  addressBlock: { gap: 8 },
  label: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  address: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  addressDetail: { fontSize: 13, lineHeight: 19 },
  metrics: { flexDirection: "row", padding: 16, borderRadius: 12 },
  metric: { flex: 1, gap: 8 },
  metricRight: { borderLeftWidth: 1, paddingLeft: 16 },
  coordinate: {
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  accuracy: { fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"] },
  rating: { fontSize: 11, fontWeight: "600" },
  trustNote: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  trustText: { flex: 1, fontSize: 11, lineHeight: 16 },
  errorCard: { borderRadius: 16, padding: 16, flexDirection: "row", gap: 12 },
  errorCopy: { flex: 1 },
  errorTitle: { fontSize: 15, fontWeight: "700" },
  errorBody: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  warningText: { fontSize: 13, lineHeight: 19 },
  primaryButton: {
    minHeight: 52,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: {
    color: "#07101F",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  textButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  textButtonText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
});
