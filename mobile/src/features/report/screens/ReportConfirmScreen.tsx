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
  MapPin,
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
import { WasteDetectionChips } from "../components/WasteDetectionChips";
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
import { ReportEvidenceImage } from "../components/ReportEvidenceImage";
import { ZoomableImageViewer } from "../../../components/media/ZoomableImageViewer";

type Props = NativeStackScreenProps<ReportFlowParamList, "ReportConfirm">;
const isBackendUrl = (value?: string): value is string =>
  Boolean(value && /^https?:\/\//i.test(value));

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
  const nearby = useCheckNearbyAlerts(
    location?.latitude,
    location?.longitude,
    200,
  );

  const validDescription =
    draft.description.trim().length >= 10 && draft.description.length <= 500;
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

  const retake = () => {
    setDraft((current) => ({
      ...current,
      capture: undefined,
      imageValidation: { state: "IDLE", detectedObjects: [] },
    }));
    navigation.navigate("ReportCamera");
  };
  const viewNearby = (id: string) =>
    navigation
      .getParent<NativeStackNavigationProp<CitizenStackParamList>>()
      ?.navigate("AlertDetail", { id });
  const confirmExisting = async (id: string) => {
    try {
      await confirmAlert.mutateAsync(id);
      viewNearby(id);
    } catch {
      setSubmitError("Không thể xác nhận báo cáo gần đó. Vui lòng thử lại.");
    }
  };

  const submit = async () => {
    if (!canSubmit || !location || !capture || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
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
          category: draft.imageValidation.suggestedCategory ?? undefined,
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
        category: draft.imageValidation.suggestedCategory ?? undefined,
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

  const addressParts = location.address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const severityColor =
    draft.imageValidation.severity?.toLowerCase() === "low"
      ? colors.primary
      : draft.imageValidation.severity?.toLowerCase() === "critical"
        ? colors.destructive
        : draft.imageValidation.severity?.toLowerCase() === "high"
          ? colors.accent
          : colors.secondary;
  // UNCLASSIFIED is a real API outcome, not a completed category or a made-up default.
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
        <ReportHeader onBack={navigation.goBack} />
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
            description="Kiểm tra thông tin và bổ sung mô tả trước khi gửi."
          />
          <View style={styles.heroImage}>
            <ReportEvidenceImage
              imageUri={capture.displayLocalUri || capture.originalLocalUri}
              fallbackUri={capture.originalLocalUri}
              onPress={setViewerUri}
            />
            <View style={styles.imageBadge}>
              <CheckCircle2 size={12} color="#22C55E" />
              <Text style={styles.imageBadgeText}>ẢNH PHÙ HỢP</Text>
            </View>
          </View>
          <Text style={[styles.viewerHint, { color: colors.textMuted }]}>
            Chạm để phóng to ảnh
          </Text>
          <View style={styles.analysisMetadata}>
            <View style={styles.analysisField}>
              <Text
                style={[styles.technicalLabel, { color: colors.textMuted }]}
              >
                PHÂN LOẠI
              </Text>
              <View style={styles.analysisValueRow}>
                {!categoryReady ? (
                  <View
                    style={[
                      styles.pendingDot,
                      { backgroundColor: colors.secondary },
                    ]}
                  />
                ) : null}
                <Text
                  style={[
                    styles.analysisValue,
                    {
                      color: categoryReady ? colors.text : colors.secondary,
                    },
                  ]}
                >
                  {categoryReady && draft.imageValidation.suggestedCategory
                    ? getCategoryLabel(
                        draft.imageValidation.suggestedCategory,
                        "vi",
                      )
                    : draft.imageValidation.suggestedCategory === "UNCLASSIFIED"
                      ? "Chờ cán bộ xác nhận"
                      : "Đang hoàn tất"}
                </Text>
              </View>
            </View>
            <View style={styles.analysisField}>
              <Text
                style={[styles.technicalLabel, { color: colors.textMuted }]}
              >
                MỨC ĐỘ
              </Text>
              <View style={styles.analysisValueRow}>
                {!draft.imageValidation.severity ? (
                  <View
                    style={[
                      styles.pendingDot,
                      { backgroundColor: colors.secondary },
                    ]}
                  />
                ) : null}
                <Text style={[styles.analysisValue, { color: severityColor }]}>
                  {draft.imageValidation.severity
                    ? getSeverityLabel(draft.imageValidation.severity, "vi")
                    : "Đang đánh giá"}
                </Text>
              </View>
            </View>
          </View>
          {!categoryReady || !draft.imageValidation.severity ? (
            <Text style={[styles.pendingNote, { color: colors.textMuted }]}>
              Chưa có đủ kết quả phân tích bối cảnh. AI sẽ tiếp tục phân tích
              sau khi gửi báo cáo; cán bộ sẽ xác nhận kết quả.
            </Text>
          ) : null}
          {draft.imageValidation.detectedObjects.length ? (
            <View style={styles.detectionSection}>
              <Text
                style={[styles.technicalLabel, { color: colors.textMuted }]}
              >
                PHÁT HIỆN TỪ ẢNH
              </Text>
              <WasteDetectionChips
                detections={draft.imageValidation.detectedObjects}
                showCount
              />
            </View>
          ) : null}
          <View
            style={[styles.locationCard, { backgroundColor: colors.elevated }]}
          >
            <View
              style={[styles.pinIcon, { backgroundColor: colors.greenSoft }]}
            >
              <MapPin size={20} color={colors.primary} />
            </View>
            <View style={styles.locationCopy}>
              <Text
                style={[styles.technicalLabel, { color: colors.textMuted }]}
              >
                ĐỊA ĐIỂM
              </Text>
              <Text style={[styles.address, { color: colors.text }]}>
                {addressParts[0]}
              </Text>
              <Text
                style={[styles.addressDetail, { color: colors.textSecondary }]}
              >
                {addressParts.slice(1).join(", ")}
              </Text>
              <View style={styles.locationMeta}>
                <Text style={[styles.coordinate, { color: colors.textMuted }]}>
                  {location.latitude.toFixed(6)},{" "}
                  {location.longitude.toFixed(6)}
                </Text>
                <Text style={[styles.accuracy, { color: colors.primary }]}>
                  ±{Math.round(location.accuracyMeters)}m
                </Text>
              </View>
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
                      ? colors.primary
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
                placeholder="Mô tả tình trạng rác tại hiện trường…"
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
                  Đã có báo cáo đang xử lý gần vị trí này
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
              Báo cáo sẽ được gửi đến EcoAlert để tiếp nhận và xử lý.
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
            <Text style={[styles.submitError, { color: colors.destructive }]}>
              {submitError}
            </Text>
          ) : null}
        </ScrollView>
        <ReportBottomActions>
          <TouchableOpacity
            onPress={() => void submit()}
            disabled={!canSubmit}
            style={[
              styles.submitButton,
              {
                backgroundColor: colors.primary,
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
                ? "ĐANG GỬI…"
                : isOffline
                  ? "LƯU BÁO CÁO NGOẠI TUYẾN"
                  : "GỬI BÁO CÁO"}
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
  content: { padding: 16, paddingBottom: 24, gap: 20 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  heroImage: { borderRadius: 16, overflow: "hidden" },
  viewerHint: {
    marginTop: -10,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },
  imageBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(7,16,31,0.76)",
  },
  imageBadgeText: {
    color: "#22C55E",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  analysisMetadata: { flexDirection: "row", gap: 16 },
  analysisField: { flex: 1, minWidth: 0, gap: 6 },
  analysisValueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  analysisValue: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  pendingDot: { width: 6, height: 6, borderRadius: 3 },
  pendingNote: { marginTop: -8, fontSize: 11, lineHeight: 17 },
  technicalLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  detectionSection: { gap: 12 },
  locationCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    gap: 12,
  },
  pinIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  locationCopy: { flex: 1, gap: 8 },
  address: { fontSize: 15, lineHeight: 21, fontWeight: "700" },
  addressDetail: { fontSize: 13, lineHeight: 19 },
  locationMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  coordinate: {
    fontSize: 10,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  accuracy: { fontSize: 11, fontWeight: "700" },
  descriptionSection: { gap: 12 },
  inputBox: { borderWidth: 1, borderRadius: 12, padding: 12 },
  input: { minHeight: 110, fontSize: 13, lineHeight: 19, padding: 0 },
  counter: {
    alignSelf: "flex-end",
    marginTop: 8,
    fontSize: 11,
    fontWeight: "600",
  },
  inputError: { fontSize: 11, lineHeight: 16 },
  nearbyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    gap: 12,
  },
  nearbyCopy: { flex: 1 },
  nearbyTitle: { fontSize: 13, lineHeight: 19, fontWeight: "700" },
  nearbyName: { marginTop: 8, fontSize: 13, fontWeight: "700" },
  nearbyMeta: { marginTop: 4, fontSize: 11 },
  nearbyActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  nearbyButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  nearbyButtonText: { fontSize: 10, fontWeight: "700" },
  ack: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12 },
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
    padding: 12,
    backgroundColor: "rgba(245,158,11,0.12)",
    flexDirection: "row",
    gap: 8,
  },
  offlineText: { flex: 1, fontSize: 13, lineHeight: 19 },
  submitError: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  submitButton: {
    minHeight: 54,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButton: {
    minHeight: 52,
    minWidth: 220,
    marginTop: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#07101F",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  retakeButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  retakeText: { fontSize: 13, fontWeight: "600" },
});
