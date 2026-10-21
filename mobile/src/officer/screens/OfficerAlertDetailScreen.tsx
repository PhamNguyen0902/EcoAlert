import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import {
  Camera,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  Sparkles,
} from "lucide-react-native";
import { useAlert } from "../../shared/hooks/useAlerts";
import { useProfile } from "../../auth/hooks/useAuth";
import { EvidenceImageFrame } from "../../shared/components/media/EvidenceImageFrame";
import { Button } from "../../shared/components/ui/Button";
import { OverallAiAnalysisCard } from "../../shared/components/ai/OverallAiAnalysisCard";
import {
  OfficerBadge,
  OfficerCard,
  OfficerHeader,
  OfficerStepProgressBar,
  officerStyles as s,
} from "../components/OfficerUI";
import { OfficerTimeline } from "../components/OfficerTimeline";
import { useCivicTheme } from "../../shared/theme/useCivicTheme";
import {
  useForegroundScreen,
  useScreenClock,
} from "../../shared/hooks/useForegroundScreen";
import {
  getGeoJsonMapCoordinates,
  openGoogleMaps,
} from "../../shared/utils/maps";
import { getAlertDisplaySeverity } from "../../shared/utils/aiAnalysis";
import {
  getCategoryLabel,
  getSeverityLabel,
} from "../../shared/utils/incidentPresentation";
import { getWasteDetectionLabel } from "../../shared/utils/visionBoundingBox";
import {
  getOfficerTaskState,
  getOfficerWorkflowStep,
  isWasteOfficerTask,
  officerStatus,
} from "../utils/officerWorkflow";
import {
  officerDate,
  officerElapsedTime,
  officerReference,
  ownsOfficerTask,
} from "../utils/officerPresentation";
import type { OfficerStackParamList } from "../../app/navigation/types";

type Props = NativeStackScreenProps<
  OfficerStackParamList,
  "OfficerAlertDetail"
>;

// Màn hình chi tiết sự cố & điều phối quy trình 3 bước của Cán bộ hiện trường
export const OfficerAlertDetailScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useCivicTheme();
  const query = useAlert(route.params.id);
  const { data: profile } = useProfile();
  const foreground = useForegroundScreen();
  const nowMs = useScreenClock(30_000, foreground);

  const alert = query.data;
  const mine = ownsOfficerTask(alert, profile);

  const root = {
    backgroundColor: colors.background,
    paddingTop: insets.top,
    flex: 1,
  };

  if (!alert || query.isError || !mine)
    return (
      <View style={root}>
        <OfficerHeader title="Chi tiết sự cố" back={navigation.goBack} />
        <OfficerStepProgressBar task={alert} />
        <View style={{ padding: 24, gap: 16 }}>
          {query.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[s.body, { color: colors.textMuted }]}>
              Nhiệm vụ không khả dụng hoặc chưa được phân công cho bạn.
            </Text>
          )}
          <Button
            appearance="civic"
            title="Thử lại"
            onPress={() => void query.refetch()}
          />
        </View>
      </View>
    );

  const state = getOfficerTaskState(alert);
  const progress = getOfficerWorkflowStep(alert);
  const status = officerStatus(alert);
  const wasteTask = isWasteOfficerTask(alert);
  const readOnly = !["ASSIGNED", "IN_PROGRESS"].includes(status) || !wasteTask;
  const coordinates = getGeoJsonMapCoordinates(alert.location?.coordinates);

  const before = alert.fieldEvidence?.length
    ? alert.fieldEvidence.map((e) => ({
        uri: e.displayUrl || e.originalUrl,
        fallback: e.originalUrl,
        at: e.capturedAt,
      }))
    : (alert.mediaUrls || []).map((uri) => ({
        uri,
        fallback: uri,
        at: undefined,
      }));

  const checkedInAt = alert.checkIn?.checkedInAt || alert.arrivedAt;
  const elapsedSinceCheckIn = officerElapsedTime(checkedInAt, nowMs);

  // Nút hành động chính duy nhất (Single Primary CTA) theo đúng bước hiện tại
  const primaryActionLabel =
    progress.currentStep === 1
      ? "Check-in hiện trường"
      : "Tiếp tục: Chụp ảnh kết quả (Check-out)";

  const handlePrimaryAction = () => {
    if (progress.currentStep === 1) {
      navigation.navigate("OfficerGpsCheckIn", { id: alert._id });
    } else if (progress.currentStep === 2) {
      navigation.navigate("OfficerResolution", { id: alert._id });
    }
  };

  const handleQuickNavigate = () => {
    if (coordinates) {
      void openGoogleMaps(
        coordinates.latitude,
        coordinates.longitude,
        "navigate",
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={root}
    >
      <OfficerHeader title="Chi tiết sự cố" back={navigation.goBack} />
      <OfficerStepProgressBar task={alert} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          s.content,
          { paddingBottom: readOnly ? insets.bottom + 24 : 32 },
        ]}
      >
        {/* Trạng thái Bước 2: Đang xử lý tại hiện trường (Focused Workspace) */}
        {progress.currentStep === 2 && !progress.allCompleted && (
          <OfficerCard accent>
            <View style={s.row}>
              <Clock3 size={20} color={colors.primary} />
              <View style={s.grow}>
                <Text style={[s.heading, { color: colors.primary }]}>
                  Đang xử lý tại hiện trường
                </Text>
                <Text style={[s.meta, { color: colors.textSecondary }]}>
                  Đã điểm danh lúc: {officerDate(checkedInAt)}
                  {elapsedSinceCheckIn
                    ? ` · Thời gian xử lý: ${elapsedSinceCheckIn}`
                    : ""}
                </Text>
              </View>
            </View>
            {alert.checkIn?.verified && (
              <View style={[s.row, { flexWrap: "wrap" }]}>
                <OfficerBadge
                  label={`Khoảng cách điểm danh: ${Math.round(alert.checkIn.distanceFromIncidentMeters)}m`}
                  color={colors.primary}
                />
                <OfficerBadge
                  label={`Sai số định vị: ±${Math.round(alert.checkIn.accuracyMeters)}m`}
                  color={colors.cyan}
                />
              </View>
            )}
            <Text style={[s.body, { color: colors.text }]}>
              Đối chiếu ảnh hiện trường ban đầu bên dưới, thực hiện dọn dẹp theo
              khuyến nghị rồi bấm nút hoàn thành ở cuối màn hình để chụp ảnh
              nghiệm thu.
            </Text>
          </OfficerCard>
        )}

        {/* Trạng thái Bước 3: Đã hoàn tất xử lý */}
        {progress.allCompleted && (
          <OfficerCard accent>
            <View style={s.row}>
              <CheckCircle2 size={20} color={colors.primary} />
              <View style={s.grow}>
                <Text style={[s.heading, { color: colors.primary }]}>
                  {status === "CLOSED"
                    ? "Đã nghiệm thu và đóng hồ sơ"
                    : "Đã hoàn thành xử lý hiện trường"}
                </Text>
                <Text style={[s.meta, { color: colors.textSecondary }]}>
                  Hoàn thành lúc: {officerDate(alert.resolvedAt)}
                </Text>
              </View>
            </View>
          </OfficerCard>
        )}

        {/* Ảnh hiện trường ban đầu (Before) + Thanh Footer Bar bên dưới mép ảnh (không đè lên watermark) */}
        <View style={{ gap: 8 }}>
          <Text style={[s.technical, { color: colors.textMuted }]}>
            ẢNH HIỆN TRƯỜNG BAN ĐẦU (ĐỐI CHIẾU TRƯỚC XỬ LÝ)
          </Text>
          {before[0] ? (
            <View style={{ gap: 6 }}>
              <EvidenceImageFrame
                imageUri={before[0].uri}
                fallbackUri={before[0].fallback}
                style={{ width: "100%", aspectRatio: 4 / 3 }}
              />
              {/* Thanh Footer Bar tách biệt hoàn toàn bên dưới mép ảnh để không đè lên chữ Watermark */}
              <View style={detailStyles.imageFooterBar}>
                <View style={[s.row, { gap: 6 }]}>
                  <Clock3 size={13} color={colors.cyan} />
                  <Text style={[s.meta, { color: colors.textSecondary }]}>
                    {before[0].at
                      ? `Chụp lúc: ${officerDate(before[0].at)}`
                      : `Ghi nhận: ${officerDate(alert.createdAt)}`}
                  </Text>
                </View>
                <OfficerBadge label="MINH CHỨNG BAN ĐẦU" color={colors.cyan} />
              </View>
            </View>
          ) : (
            <OfficerCard>
              <Text style={{ color: colors.textMuted }}>
                Chưa có ảnh hiện trường.
              </Text>
            </OfficerCard>
          )}
          {before.length > 1 && (
            <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
              {before.slice(1).map((image, i) => (
                <EvidenceImageFrame
                  key={`${i}-${image.uri}`}
                  imageUri={image.uri}
                  fallbackUri={image.fallback}
                  style={{ width: 90, aspectRatio: 3 / 4 }}
                  accessibilityLabel={`Ảnh trước xử lý ${i + 2}`}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Thẻ Thông tin Sự cố hợp nhất 5 dòng chuẩn chỉnh (Không lặp lại Badge) */}
        <OfficerCard>
          {/* Dòng 1: Mã sự cố + Badge trạng thái + Badge mức độ + Danh mục */}
          <View style={[s.row, { flexWrap: "wrap", gap: 6 }]}>
            <View style={detailStyles.codePill}>
              <Text style={[s.technical, { color: colors.cyan }]}>
                {officerReference(alert)}
              </Text>
            </View>
            <OfficerBadge label={state.label} color={state.color} />
            <OfficerBadge
              label={getSeverityLabel(getAlertDisplaySeverity(alert))}
              color={colors.warning}
            />
            <OfficerBadge
              label={getCategoryLabel(alert.category)}
              color={colors.cyan}
            />
          </View>

          {/* Dòng 2: Tiêu đề sự cố */}
          <Text style={[s.title, { color: colors.text }]}>{alert.title}</Text>

          {/* Dòng 3: Tọa độ GPS / Địa chỉ hiện trường kèm nút dẫn đường nhanh */}
          <View style={detailStyles.locationRow}>
            <View style={[s.row, s.grow, { alignItems: "flex-start" }]}>
              <MapPin
                size={16}
                color={colors.primary}
                style={{ marginTop: 2 }}
              />
              <View style={s.grow}>
                <Text style={[s.body, { color: colors.text, fontWeight: "600" }]}>
                  {alert.address || "Đã ghi nhận vị trí định vị"}
                </Text>
                {coordinates && (
                  <Text style={[s.meta, { color: colors.textMuted }]}>
                    GPS: {coordinates.latitude.toFixed(5)}°N,{" "}
                    {coordinates.longitude.toFixed(5)}°E
                  </Text>
                )}
              </View>
            </View>

            {coordinates && (
              <Pressable
                onPress={handleQuickNavigate}
                accessibilityRole="button"
                accessibilityLabel="Chỉ đường nhanh tới hiện trường"
                style={detailStyles.quickRouteButton}
              >
                <Navigation size={13} color={colors.cyan} />
                <Text
                  style={[
                    s.meta,
                    { color: colors.cyan, fontWeight: "700" },
                  ]}
                >
                  Chỉ đường
                </Text>
              </Pressable>
            )}
          </View>

          {/* Dòng 4: Nội dung đánh giá / mô tả chi tiết với lineHeight: 21 */}
          <Text
            style={[
              s.body,
              {
                color: colors.textSecondary,
                lineHeight: 21,
              },
            ]}
          >
            {alert.description ||
              "Người dân phản ánh điểm phát sinh rác thải tại hiện trường cần kiểm tra và thu dọn."}
          </Text>

          {/* Dòng 5 (Footer của Card): Mốc thời gian Tiếp nhận & Phân công */}
          <View style={detailStyles.cardFooter}>
            <Text style={[s.meta, { color: colors.cyan }]}>
              Tiếp nhận: {officerDate(alert.createdAt)} · Phân công:{" "}
              {officerDate(alert.assignedAt)}
            </Text>
          </View>
        </OfficerCard>

        {/* Khuyến nghị / Hướng dẫn xử lý nhanh từ AI */}
        <View style={{ gap: 8 }}>
          <View style={s.row}>
            <Sparkles size={15} color={colors.cyan} />
            <Text style={[s.technical, { color: colors.cyan }]}>
              KHUYẾN NGHỊ & HƯỚNG DẪN XỬ LÝ NHANH
            </Text>
          </View>
          <OverallAiAnalysisCard alert={alert} appearance="civic" />
          {alert.visionEvidence?.length ? (
            <OfficerCard>
              <Text style={[s.meta, { color: colors.cyan }]}>
                Thành phần rác nhận diện:{" "}
                {Array.from(
                  new Set(
                    alert.visionEvidence.flatMap((e) =>
                      (e.detections ?? []).map((d) =>
                        getWasteDetectionLabel(d.materialClass),
                      ),
                    ),
                  ),
                ).join(", ") || "Chưa có vật liệu được nhận diện."}
              </Text>
            </OfficerCard>
          ) : null}
          <Text style={[s.meta, { color: colors.textMuted }]}>
            Thông tin phân tích hỗ trợ cán bộ chuẩn bị dụng cụ và phương án thu
            gom phù hợp tại hiện trường.
          </Text>
        </View>

        {/* Bản đồ vị trí điểm sự cố */}
        <OfficerCard>
          <Text style={[s.technical, { color: colors.cyan }]}>
            VỊ TRÍ ĐIỂM SỰ CỐ
          </Text>
          <Text style={[s.body, { color: colors.text }]}>
            {alert.address || "Đã ghi nhận vị trí định vị"}
          </Text>
          {coordinates ? (
            <MapView
              provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
              userInterfaceStyle={isDark ? "dark" : "light"}
              style={{ height: 170, borderRadius: 12 }}
              initialRegion={{
                ...coordinates,
                latitudeDelta: 0.008,
                longitudeDelta: 0.008,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker
                coordinate={coordinates}
                title={alert.title}
                pinColor="#F87171"
              />
            </MapView>
          ) : (
            <Text style={{ color: colors.textMuted }}>
              Tọa độ không khả dụng.
            </Text>
          )}
        </OfficerCard>

        {alert.officerNote ? (
          <OfficerCard>
            <Text style={[s.heading, { color: colors.text }]}>
              Ghi chú hiện trường
            </Text>
            <Text style={[s.body, { color: colors.textSecondary }]}>
              {alert.officerNote}
            </Text>
          </OfficerCard>
        ) : null}

        {/* Kết quả sau xử lý (nếu đã hoàn thành) */}
        {alert.resolutionEvidence?.length ? (
          <OfficerCard>
            <Text style={[s.heading, { color: colors.primary }]}>
              KẾT QUẢ SAU XỬ LÝ
            </Text>
            {alert.resolutionEvidence.map((e, i) => (
              <View key={e._id || `${i}-${e.url}`} style={{ gap: 6 }}>
                <EvidenceImageFrame
                  imageUri={e.url}
                  accessibilityLabel={`Ảnh sau xử lý ${i + 1}`}
                />
                {e.capturedAt && (
                  <Text style={[s.meta, { color: colors.textMuted }]}>
                    Chụp: {officerDate(e.capturedAt)}
                  </Text>
                )}
                {typeof e.distanceFromIncidentMeters === "number" && (
                  <Text style={[s.meta, { color: colors.cyan }]}>
                    Cách điểm rác {Math.round(e.distanceFromIncidentMeters)}m
                    {typeof e.accuracyMeters === "number"
                      ? ` · Định vị ±${Math.round(e.accuracyMeters)}m`
                      : ""}
                  </Text>
                )}
              </View>
            ))}
            <Text style={[s.body, { color: colors.text }]}>
              {alert.resolutionSummary}
            </Text>
            <Text style={[s.body, { color: colors.textSecondary }]}>
              {alert.treatmentMethod}
            </Text>
            {alert.materialsUsed && (
              <Text style={[s.body, { color: colors.textSecondary }]}>
                {alert.materialsUsed}
              </Text>
            )}
            {alert.resolutionNotes && (
              <Text style={[s.body, { color: colors.textMuted }]}>
                {alert.resolutionNotes}
              </Text>
            )}
          </OfficerCard>
        ) : null}

        <OfficerTimeline task={alert} />

        {readOnly && (
          <Text style={[s.body, { color: colors.primary }]}>
            {!wasteTask
              ? "Báo cáo này không thuộc luồng xử lý rác thải."
              : status === "CLOSED"
                ? "Quản trị viên đã xác nhận nghiệm thu và đóng báo cáo."
                : "Đã gửi kết quả xử lý · Đang chờ Quản trị viên nghiệm thu."}
          </Text>
        )}
      </ScrollView>

      {/* Duy nhất 1 Nút Hành Động Chính (Single Primary CTA) dưới đáy, chiều cao 54px, bo góc 14px, kèm icon */}
      {!readOnly && state.action !== "NONE" && (
        <View
          style={[
            detailStyles.bottomActionBar,
            {
              paddingBottom: Math.max(12, insets.bottom),
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <Button
            appearance="civic"
            title={primaryActionLabel}
            onPress={handlePrimaryAction}
            icon={
              progress.currentStep === 1 ? (
                <MapPin
                  size={18}
                  color="#07101F"
                  style={{ marginRight: 8 }}
                />
              ) : (
                <Camera
                  size={18}
                  color="#07101F"
                  style={{ marginRight: 8 }}
                />
              )
            }
            style={detailStyles.primaryCtaButton}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const detailStyles = StyleSheet.create({
  imageFooterBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  codePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.28)",
    backgroundColor: "rgba(56, 189, 248, 0.1)",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  quickRouteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
  },
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 10,
  },
  bottomActionBar: {
    paddingHorizontal: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  primaryCtaButton: {
    height: 54,
    minHeight: 54,
    borderRadius: 14,
  },
});
