import {
  civicSpace as space,
  civicRadius as radius,
} from "../../../theme/civicDesign";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Check,
  CheckCircle2,
  Eye,
  RotateCcw,
  Send,
  TriangleAlert,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import type {
  CitizenStackParamList,
  ReportFlowParamList,
} from "../../../navigation/types";
import { useReportTheme } from "../useReportTheme";
import { ReportScreenIntro } from "../components/ReportScreenIntro";
import { ReportBottomActions } from "../components/ReportBottomActions";
import {
  useCheckNearbyAlerts,
  useConfirmAlert,
  useCreateAlert,
} from "../../../hooks/useAlerts";
import { useOfflineSync } from "../../../hooks/useOfflineSync";
import { alertService } from "../../../api/alertService";
import { offlineQueue } from "../../../utils/offlineQueue";
import {
  getCategoryLabel,
  getSeverityLabel,
  getWorkflowStatusLabel,
} from "../../../utils/aiAnalysis";
import { useFieldReport } from "../FieldReportContext";
import { MAX_FIELD_GPS_ACCURACY_METERS } from "../types";
import { ReportHeader } from "../components/ReportHeader";
import { ReportProgress } from "../components/ReportProgress";
import { ZoomableImageViewer } from "../../../shared/components/media/ZoomableImageViewer";
import { FieldReportSummary } from "../components/stitch/FieldReportSummary";
import { FieldAiResultCard } from "../components/stitch/FieldAiResultCard";
import { fieldStyles } from "../components/stitch/fieldDesign";
import { reportCategoryCodes, reportClassification } from "../semanticResult";

type Props = NativeStackScreenProps<ReportFlowParamList, "ReportConfirm">;
const isBackendUrl = (value?: string): value is string =>
  Boolean(value && /^https?:\/\//i.test(value));
// màn hình bước năm xác nhận thông tin, kiểm tra trùng lặp và gửi báo cáo
export const ReportConfirmScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useReportTheme();
  const { draft, setDraft } = useFieldReport();
  const { isOffline } = useOfflineSync();
  const createAlert = useCreateAlert();
  const confirmAlert = useConfirmAlert();
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(true);
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const location = draft.location;
  const capture = draft.capture;
  // kiểm tra các sự cố môi trường đã tồn tại xung quanh vị trí hiện tại trong bán kính hai trăm mét
  const nearby = useCheckNearbyAlerts(
    location?.latitude,
    location?.longitude,
    200,
  );

  const validDescription =
    draft.description.trim().length >= 10 && draft.description.length <= 500;
  // kiểm tra toàn bộ điều kiện hợp lệ gồm gps, ảnh, kiểm định ai, độ dài mô tả và xác nhận trước khi cho phép gửi
  const canSubmit = Boolean(
    location &&
      location.accuracyMeters <= MAX_FIELD_GPS_ACCURACY_METERS &&
      capture?.originalLocalUri &&
      draft.imageValidation.state === "VALID" &&
      validDescription &&
      draft.title.trim().length >= 5 &&
      acknowledged &&
      !submitting,
  );
  // chụp lại ảnh nếu muốn thay đổi bằng chứng hiện trường
  const retake = () => {
    setDraft((current) => ({
      ...current,
      capture: undefined,
      imageValidation: { state: "IDLE", detectedObjects: [] },
    }));
    navigation.navigate("ReportCamera");
  };
  // mở xem chi tiết sự cố lân cận đã tồn tại để tránh gửi trùng
  const viewNearby = (id: string) =>
    navigation
      .getParent<NativeStackNavigationProp<CitizenStackParamList>>()
      ?.navigate("AlertDetail", { id });
  // xác nhận sự cố lân cận đã có sẵn thay vì tạo báo cáo mới
  const confirmExisting = async (id: string) => {
    try {
      await confirmAlert.mutateAsync(id);
      viewNearby(id);
    } catch {
      setSubmitError("Không thể xác nhận báo cáo gần đó. Vui lòng thử lại.");
    }
  };
  // gửi báo cáo lên máy chủ nếu có mạng hoặc lưu vào hàng đợi ngoại tuyến nếu mất mạng
  const submit = async () => {
    if (!canSubmit || !location || !capture || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    // đóng gói siêu dữ liệu bằng chứng hiện trường gồm phương thức chụp trực tiếp, mốc thời gian và sai số gps
    const captureMetadata = {
      method: "LIVE_CAMERA" as const,
      capturedAt: capture.capturedAt,
      gpsAccuracyMeters: location.accuracyMeters,
      locationSource: "DEVICE_GPS" as const,
    };
    try {
      if (isOffline) {
        await offlineQueue.saveOfflineDraft({
          title: draft.title.trim(),
          description: draft.description.trim(),
          address: location.address,
          location: {
            type: "Point",
            coordinates: [location.longitude, location.latitude],
          },
          localMediaUris: [capture.originalLocalUri],
          originalLocalUri: capture.originalLocalUri,
          displayLocalUri: capture.displayLocalUri,
          captureMetadata,
          imageValidation: draft.imageValidation.backendValidation,
          ...reportClassification(draft.imageValidation),
          isAnonymous: false,
        });
        navigation.navigate("ReportSuccess", { queued: true });
        return;
      }

      let originalUrl = capture.originalUploadedUrl;
      if (!isBackendUrl(originalUrl))
        originalUrl = await alertService.uploadMedia(
          capture.originalLocalUri,
          `field_original_${Date.now()}.jpg`,
          "image/jpeg",
        );
      if (!isBackendUrl(originalUrl)) throw new Error("ORIGINAL_UPLOAD_FAILED");
      // tải ảnh hiển thị có watermark lên máy chủ để phục vụ công tác giám sát trực quan
      let displayUrl = capture.displayUploadedUrl;
      if (capture.displayLocalUri && !isBackendUrl(displayUrl)) {
        try {
          displayUrl = await alertService.uploadMedia(
            capture.displayLocalUri,
            `field_display_${Date.now()}.jpg`,
            "image/jpeg",
          );
        } catch {
          displayUrl = undefined;
        }
      }
      const created = await createAlert.mutateAsync({
        title: draft.title.trim(),
        description: draft.description.trim(),
        address: location.address,
        location: {
          type: "Point",
          coordinates: [location.longitude, location.latitude],
        },
        mediaUrls: [originalUrl],
        fieldEvidence: [
          {
            originalUrl,
            ...(isBackendUrl(displayUrl) ? { displayUrl } : {}),
            capturedAt: capture.capturedAt,
            gpsAccuracyMeters: location.accuracyMeters,
          },
        ],
        captureMetadata,
        imageValidation: draft.imageValidation.backendValidation,
        ...reportClassification(draft.imageValidation),
        isAnonymous: false,
      });
      setDraft((current) => ({
        ...current,
        capture: current.capture
          ? {
              ...current.capture,
              originalUploadedUrl: originalUrl,
              ...(isBackendUrl(displayUrl)
                ? { displayUploadedUrl: displayUrl }
                : {}),
            }
          : current.capture,
        createdAlert: created,
      }));
      navigation.navigate("ReportSuccess", { alertId: created._id });
    } catch {
      setSubmitError(
        "Không thể gửi báo cáo. Dữ liệu của bạn vẫn được giữ lại để thử lại.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (!location || !capture || draft.imageValidation.state !== "VALID")
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <TriangleAlert size={36} color={colors.accent} />
        <Text style={[styles.centerTitle, { color: colors.text }]}>
          Hồ sơ báo cáo chưa hoàn tất
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("ReportLocation")}
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>LÀM LẠI TỪ VỊ TRÍ GPS</Text>
        </TouchableOpacity>
      </View>
    );

  const severityColor =
    draft.imageValidation.severity?.toLowerCase() === "low"
      ? colors.primary
      : draft.imageValidation.severity?.toLowerCase() === "critical"
        ? colors.destructive
        : draft.imageValidation.severity?.toLowerCase() === "high"
          ? colors.accent
          : colors.secondary;
  // chưa phân loại là kết quả hợp lệ từ máy chủ, không phải danh mục hoàn tất hay giá trị mặc định
  const categoryReady = Boolean(
    draft.imageValidation.suggestedCategory &&
      draft.imageValidation.suggestedCategory !== "UNCLASSIFIED",
  );
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <ReportHeader title="Xác nhận báo cáo" onBack={navigation.goBack} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ReportProgress step={4} />
          <ReportScreenIntro
            eyebrow="HỒ SƠ HIỆN TRƯỜNG"
            title="Xác nhận báo cáo"
            description="Kiểm tra kỹ thông tin minh chứng trước khi gửi đến đơn vị xử lý."
          />
          <FieldReportSummary
            capture={capture}
            location={location}
            onPress={setViewerUri}
          />
          <FieldAiResultCard analysis={draft.imageValidation} compact />
          {draft.imageValidation.semanticState !== "COMPLETE" ? (
            <TouchableOpacity onPress={() => navigation.navigate("ReportImageValidation")} accessibilityRole="button" style={[styles.retakeButton, { borderColor: colors.border }]}>
              <Text style={{ color: colors.primary }}>Thử lại phân loại AI (giữ nguyên ảnh)</Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.descriptionSection}>
            <Text style={[styles.technicalLabel, { color: colors.primary }]}>
              HIỆU CHỈNH THÔNG TIN PHẢN ÁNH
            </Text>
            <Text style={[styles.technicalLabel, { color: colors.textMuted }]}>
              TIÊU ĐỀ SỰ CỐ
            </Text>
            <TextInput
              value={draft.title}
              onChangeText={(title) =>
                setDraft((current) => ({ ...current, title }))
              }
              accessibilityLabel="Tiêu đề sự cố"
              placeholder="Nhập tiêu đề báo cáo..."
              placeholderTextColor={colors.textMuted}
              style={[
                styles.titleInput,
                {
                  color: colors.text,
                  backgroundColor: colors.elevated,
                  borderColor:
                    draft.title.trim().length >= 5
                      ? colors.border
                      : colors.destructive,
                },
              ]}
            />
            {draft.title.trim().length < 5 ? (
              <Text style={[styles.inputError, { color: colors.destructive }]}>
                Tiêu đề cần ít nhất 5 ký tự.
              </Text>
            ) : null}
            <Text style={[styles.technicalLabel, { color: colors.textMuted }]}>
              PHÂN LOẠI DO AI GỢI Ý
            </Text>
            <View style={styles.classificationChips}>
              <Text style={styles.categoryChip}>
                {categoryReady && draft.imageValidation.suggestedCategory
                  ? getCategoryLabel(
                      draft.imageValidation.suggestedCategory,
                      "vi",
                    )
                  : "Chờ cán bộ xác nhận"}
              </Text>
              <Text style={[styles.categoryChip, { color: severityColor }]}>
                {draft.imageValidation.severity
                  ? getSeverityLabel(draft.imageValidation.severity, "vi")
                  : "Chưa có đánh giá mức độ"}
              </Text>
            </View>
            <Text style={[styles.technicalLabel, { color: colors.textMuted }]}>DANH MỤC DO BẠN XÁC NHẬN (TÙY CHỌN)</Text>
            <View style={styles.classificationChips}>
              {reportCategoryCodes.map(code => (
                <TouchableOpacity key={code} accessibilityRole="radio" accessibilityState={{ checked: draft.imageValidation.userSelectedCategory === code }}
                  onPress={() => setDraft(current => ({ ...current, imageValidation: { ...current.imageValidation, userSelectedCategory: current.imageValidation.userSelectedCategory === code ? undefined : code } }))}>
                  <Text style={[styles.categoryChip, { color: draft.imageValidation.userSelectedCategory === code ? colors.primary : colors.textSecondary }]}>{draft.imageValidation.userSelectedCategory === code ? "✓ " : ""}{getCategoryLabel(code, "vi")}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.descriptionSection}>
            <Text style={[styles.technicalLabel, { color: colors.textMuted }]}>
              MÔ TẢ HIỆN TRƯỜNG
            </Text>
            <View
              style={[
                styles.inputBox,
                {
                  backgroundColor: colors.elevated,
                  borderColor: !validDescription
                    ? colors.destructive
                    : descriptionFocused
                      ? colors.secondary
                      : colors.border,
                },
              ]}
            >
              <TextInput
                value={draft.description}
                onChangeText={(description) =>
                  setDraft((current) => ({ ...current, description }))
                }
                onFocus={() => setDescriptionFocused(true)}
                onBlur={() => setDescriptionFocused(false)}
                maxLength={500}
                multiline
                textAlignVertical="top"
                placeholder="Mô tả ngắn gọn tình trạng rác tại hiện trường..."
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.textSecondary }]}
                accessibilityLabel="Mô tả hiện trường"
              />
              <Text style={[styles.counter, { color: colors.textMuted }]}>
                {draft.description.length} / 500
              </Text>
            </View>
            {!validDescription ? (
              <Text style={[styles.inputError, { color: colors.destructive }]}>
                Mô tả cần từ 10 đến 500 ký tự.
              </Text>
            ) : null}
          </View>
          {nearby.data?.length ? (
            <View
              style={[
                styles.nearbyCard,
                {
                  borderColor: "rgba(245,158,11,0.3)",
                  backgroundColor: "rgba(245,158,11,0.08)",
                },
              ]}
            >
              <TriangleAlert size={18} color={colors.accent} />
              <View style={styles.nearbyCopy}>
                <Text style={[styles.nearbyTitle, { color: colors.accent }]}>
                  Có báo cáo tương tự ở gần vị trí này
                </Text>
                <Text
                  style={[styles.nearbyName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {nearby.data[0].title}
                </Text>
                <Text style={[styles.nearbyMeta, { color: colors.textMuted }]}>
                  {getWorkflowStatusLabel(nearby.data[0].status, "vi")}
                </Text>
                <View style={styles.nearbyActions}>
                  <TouchableOpacity
                    onPress={() => viewNearby(nearby.data![0]._id)}
                    style={styles.nearbyButton}
                    accessibilityRole="button"
                  >
                    <Eye size={14} color={colors.secondary} />
                    <Text
                      style={[
                        styles.nearbyButtonText,
                        { color: colors.secondary },
                      ]}
                    >
                      XEM BÁO CÁO
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => void confirmExisting(nearby.data![0]._id)}
                    disabled={confirmAlert.isPending}
                    style={styles.nearbyButton}
                    accessibilityRole="button"
                  >
                    <CheckCircle2 size={14} color={colors.primary} />
                    <Text
                      style={[
                        styles.nearbyButtonText,
                        { color: colors.primary },
                      ]}
                    >
                      SỰ CỐ VẪN CÒN
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}
          <TouchableOpacity
            onPress={() => setAcknowledged((value) => !value)}
            style={styles.ack}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acknowledged }}
          >
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: acknowledged
                    ? colors.primary
                    : "transparent",
                  borderColor: acknowledged ? colors.primary : colors.textMuted,
                },
              ]}
            >
              {acknowledged ? (
                <Check size={14} color="#07101F" strokeWidth={3} />
              ) : null}
            </View>
            <Text style={[styles.ackText, { color: colors.textMuted }]}>
              Tôi xác nhận ảnh và vị trí được ghi nhận tại hiện trường.
            </Text>
          </TouchableOpacity>
          {isOffline ? (
            <View style={styles.offlineNote}>
              <TriangleAlert size={16} color={colors.accent} />
              <Text style={[styles.offlineText, { color: colors.textMuted }]}>
                Mạng đã ngắt sau khi kiểm tra ảnh. Báo cáo sẽ được lưu và đồng
                bộ khi kết nối lại.
              </Text>
            </View>
          ) : null}
          {submitError ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[styles.submitError, { color: colors.destructive }]}
            >
              {submitError}
            </Text>
          ) : null}
        </ScrollView>
        <ReportBottomActions>
          <TouchableOpacity
            onPress={() => void submit()}
            disabled={!canSubmit}
            accessibilityState={{ disabled: !canSubmit, busy: submitting }}
            style={[
              styles.submitButton,
              {
                backgroundColor: colors.cta,
                opacity: canSubmit ? 1 : 0.45,
              },
            ]}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color="#07101F" />
            ) : (
              <Send size={18} color="#07101F" />
            )}
            <Text style={styles.primaryText}>
              {submitting
                ? "ĐANG GỬI BÁO CÁO..."
                : isOffline
                  ? "LƯU BÁO CÁO NGOẠI TUYẾN"
                  : "GỬI BÁO CÁO NGAY"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={retake}
            disabled={submitting}
            style={styles.retakeButton}
            accessibilityRole="button"
          >
            <RotateCcw size={15} color={colors.textMuted} />
            <Text style={[styles.retakeText, { color: colors.textMuted }]}>
              Chụp lại hiện trường
            </Text>
          </TouchableOpacity>
        </ReportBottomActions>
        <ZoomableImageViewer
          visible={viewerUri !== null}
          imageUri={viewerUri ?? ""}
          onClose={() => setViewerUri(null)}
          altLabel="Ảnh hiện trường"
        />
      </View>
    </KeyboardAvoidingView>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1, minHeight: 0 },
  content: fieldStyles.content,
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.section,
  },
  centerTitle: {
    marginTop: space.lg,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  technicalLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  descriptionSection: { gap: space.md },
  titleInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    lineHeight: 20,
  },
  classificationChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: {
    backgroundColor: "rgba(34,197,94,0.1)",
    color: "#4ADE80",
    borderRadius: 8,
    padding: 8,
    fontSize: 11,
    lineHeight: 16,
    overflow: "hidden",
    fontWeight: "700",
    flexShrink: 1,
  },
  inputBox: { borderWidth: 1, borderRadius: 12, padding: space.md },
  input: { minHeight: 110, fontSize: 13, lineHeight: 20, padding: 0 },
  counter: {
    alignSelf: "flex-end",
    marginTop: space.sm,
    fontSize: 11,
    fontWeight: "600",
  },
  inputError: { fontSize: 11, lineHeight: 16 },
  nearbyCard: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
    flexDirection: "row",
    gap: space.md,
  },
  nearbyCopy: { flex: 1 },
  nearbyTitle: { fontSize: 13, lineHeight: 20, fontWeight: "700" },
  nearbyName: { marginTop: space.sm, fontSize: 13, fontWeight: "700" },
  nearbyMeta: { marginTop: space.xs, fontSize: 11 },
  nearbyActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
    marginTop: space.sm,
  },
  nearbyButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  nearbyButtonText: { fontSize: 10, fontWeight: "700" },
  ack: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  ackText: { flex: 1, fontSize: 11, lineHeight: 16 },
  offlineNote: {
    borderRadius: 12,
    padding: space.md,
    backgroundColor: "rgba(245,158,11,0.12)",
    flexDirection: "row",
    gap: space.sm,
  },
  offlineText: { flex: 1, fontSize: 13, lineHeight: 20 },
  submitError: { fontSize: 13, lineHeight: 20, textAlign: "center" },
  submitButton: {
    minHeight: 52,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  primaryButton: {
    minHeight: 52,
    minWidth: 220,
    marginTop: space.section,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#07101F",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0,
  },
  retakeButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  retakeText: { fontSize: 13, fontWeight: "600" },
});
