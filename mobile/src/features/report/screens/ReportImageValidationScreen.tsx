import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  TriangleAlert,
  X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ReportFlowParamList } from "../../../navigation/types";
import type {
  AlertCategory,
  ImageValidation,
  PreSubmitSemanticResult,
} from "../../../types";
import { alertService } from "../../../api/alertService";
import { useOfflineSync } from "../../../hooks/useOfflineSync";
import { useReportTheme } from "../useReportTheme";
import { ReportScreenIntro } from "../components/ReportScreenIntro";
import { ReportBottomActions } from "../components/ReportBottomActions";
import { WasteDetectionChips } from "../components/WasteDetectionChips";
import { useFieldReport } from "../FieldReportContext";
import { ReportHeader } from "../components/ReportHeader";
import { ReportProgress } from "../components/ReportProgress";

type Props = NativeStackScreenProps<
  ReportFlowParamList,
  "ReportImageValidation"
>;

const isBackendUrl = (value?: string): value is string =>
  Boolean(value && /^https?:\/\//i.test(value));
const categoryFromSemantic = (
  value: AlertCategory | null,
): AlertCategory | null => value ?? null;

export const ReportImageValidationScreen: React.FC<Props> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useReportTheme();
  const { draft, setDraft } = useFieldReport();
  const { isOffline } = useOfflineSync();
  const [guideVisible, setGuideVisible] = useState(false);
  const runningRef = useRef(false);
  const capture = draft.capture;

  const analyze = useCallback(async () => {
    if (!capture || runningRef.current) return;
    if (isOffline) {
      setDraft((current) => ({
        ...current,
        imageValidation: {
          state: "UNAVAILABLE",
          detectedObjects: [],
          reason: "Cần kết nối mạng để kiểm tra ảnh trước khi gửi.",
        },
      }));
      return;
    }
    runningRef.current = true;
    setDraft((current) => ({
      ...current,
      imageValidation: {
        ...current.imageValidation,
        state: "PROCESSING",
        reason: null,
      },
    }));
    try {
      let originalUploadedUrl = capture.originalUploadedUrl;
      if (!isBackendUrl(originalUploadedUrl)) {
        originalUploadedUrl = await alertService.uploadMedia(
          capture.originalLocalUri,
          `field_original_${Date.now()}.jpg`,
          "image/jpeg",
        );
        if (!isBackendUrl(originalUploadedUrl))
          throw new Error("UPLOAD_FAILED");
        const uploadedUrl = originalUploadedUrl;
        setDraft((current) =>
          current.capture
            ? {
                ...current,
                capture: {
                  ...current.capture,
                  originalUploadedUrl: uploadedUrl,
                },
              }
            : current,
        );
      }

      const vision =
        await alertService.analyzeUploadedImage(originalUploadedUrl);
      if (vision.status === "error") throw new Error("VISION_UNAVAILABLE");
      const detections = vision.detections.map((item) => ({
        label: item.materialClass,
        confidence: item.confidence,
        bbox: item.bbox,
      }));
      if (vision.status === "no_detection" || detections.length === 0) {
        const backendValidation: ImageValidation = {
          decision: "INVALID",
          isEnvironmentalIncident: false,
          confidence: null,
          suggestedCategory: null,
          reason: "Không phát hiện đủ bằng chứng về rác thải trong ảnh.",
          model: "YOLO11n",
          validatedAt: new Date().toISOString(),
        };
        setDraft((current) => ({
          ...current,
          imageValidation: {
            state: "INVALID",
            isWasteRelated: false,
            detectedObjects: detections,
            reason: backendValidation.reason,
            backendValidation,
          },
        }));
        return;
      }

      let semantic: PreSubmitSemanticResult | null = null;
      try {
        semantic = await alertService.validateImageSemantics(
          originalUploadedUrl,
          { title: draft.title, description: draft.description },
        );
      } catch {
        semantic = null;
      }
      const averageConfidence =
        detections.reduce((sum, item) => sum + (item.confidence ?? 0), 0) /
        detections.length;
      const suggestedCategory = semantic
        ? categoryFromSemantic(semantic.category)
        : null;
      const backendValidation: ImageValidation = {
        decision: vision.requiresManualReview ? "UNCERTAIN" : "VALID",
        isEnvironmentalIncident: semantic?.isIncident ?? true,
        confidence: semantic?.incidentConfidence ?? averageConfidence,
        suggestedCategory,
        reason:
          semantic?.shortReason || "Đã phát hiện đối tượng rác thải trong ảnh.",
        model: semantic?.model || "YOLO11n",
        validatedAt: new Date().toISOString(),
      };
      setDraft((current) => ({
        ...current,
        title:
          current.title ||
          (suggestedCategory === "illegal_construction_waste"
            ? "Phế thải xây dựng tại hiện trường"
            : "Điểm rác cần được xử lý"),
        description:
          current.description ||
          semantic?.overallSummary ||
          semantic?.summary ||
          "Phát hiện rác thải tại vị trí đã ghi nhận.",
        imageValidation: {
          state: "VALID",
          isWasteRelated: true,
          detectedObjects: detections,
          suggestedCategory,
          severity: semantic?.severity ?? null,
          summary: semantic?.overallSummary || semantic?.summary || null,
          reason: backendValidation.reason,
          backendValidation,
        },
      }));
    } catch (error: unknown) {
      const reason =
        error instanceof Error && error.message === "UPLOAD_FAILED"
          ? "Không thể tải ảnh lên để kiểm tra."
          : "Dịch vụ kiểm tra ảnh tạm thời không khả dụng.";
      setDraft((current) => ({
        ...current,
        imageValidation: { state: "UNAVAILABLE", detectedObjects: [], reason },
      }));
    } finally {
      runningRef.current = false;
    }
  }, [capture, draft.description, draft.title, isOffline, setDraft]);

  useEffect(() => {
    if (draft.imageValidation.state === "IDLE") void analyze();
  }, [analyze, draft.imageValidation.state]);

  const state = draft.imageValidation.state;
  const retake = () => {
    setDraft((current) => ({
      ...current,
      capture: undefined,
      imageValidation: { state: "IDLE", detectedObjects: [] },
    }));
    navigation.navigate("ReportCamera");
  };

  if (!capture)
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <TriangleAlert size={36} color={colors.accent} />
        <Text style={[styles.centerTitle, { color: colors.text }]}>
          Không tìm thấy ảnh cần kiểm tra
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("ReportCamera")}
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>MỞ CAMERA</Text>
        </TouchableOpacity>
      </View>
    );

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
        <ReportProgress step={3} />
        <ReportScreenIntro
          eyebrow="KIỂM TRA NỘI DUNG"
          title="Kiểm tra ảnh hiện trường"
          description="Nhận diện nội dung rác thải trước khi gửi báo cáo."
        />
        <View style={styles.previewFrame}>
          <Image
            source={{
              uri: capture.displayLocalUri || capture.originalLocalUri,
            }}
            style={styles.preview}
            resizeMode="cover"
          />
          <Text
            style={[
              styles.previewBadge,
              {
                color: state === "VALID" ? colors.primary : "#F8FAFC",
                backgroundColor: "rgba(7,16,31,0.82)",
              },
            ]}
          >
            {state === "VALID"
              ? "PHÙ HỢP"
              : state === "PROCESSING"
                ? "ĐANG PHÂN TÍCH"
                : "ẢNH HIỆN TRƯỜNG"}
          </Text>
        </View>
        {state === "PROCESSING" ? (
          <View
            style={[
              styles.analysisCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.analysisHeading}>
              <Text
                style={[styles.technicalLabel, { color: colors.textMuted }]}
              >
                PHÂN TÍCH HÌNH ẢNH
              </Text>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
            <ProcessingRow label="Tải ảnh gốc" colors={colors} />
            <ProcessingRow label="Nhận diện rác thải" colors={colors} />
            <ProcessingRow label="Phân tích bối cảnh" colors={colors} />
            <Text style={[styles.processingHint, { color: colors.textMuted }]}>
              Hệ thống đang xử lý. Vui lòng chờ kết quả.
            </Text>
          </View>
        ) : null}
        {state === "VALID" ? (
          <>
            <View
              style={[
                styles.analysisCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.resultHeading}>
                <View
                  style={[
                    styles.resultIcon,
                    { backgroundColor: colors.greenSoft },
                  ]}
                >
                  <CheckCircle2 size={22} color={colors.primary} />
                </View>
                <View style={styles.resultCopy}>
                  <Text style={[styles.resultTitle, { color: colors.text }]}>
                    Ảnh hợp lệ
                  </Text>
                  <Text
                    style={[styles.resultBody, { color: colors.textMuted }]}
                  >
                    Phát hiện nội dung phù hợp với báo cáo rác.
                  </Text>
                </View>
              </View>
              <View style={styles.completedRow}>
                <CheckCircle2 size={16} color={colors.primary} />
                <Text
                  style={[
                    styles.completedText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Nhận diện rác thải hoàn tất
                </Text>
              </View>
              {draft.imageValidation.summary ? (
                <View style={styles.completedRow}>
                  <CheckCircle2 size={16} color={colors.primary} />
                  <Text
                    style={[
                      styles.completedText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Đã có kết quả phân tích bối cảnh
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.detectionSection}>
              <Text
                style={[styles.technicalLabel, { color: colors.textMuted }]}
              >
                ĐỐI TƯỢNG PHÁT HIỆN
              </Text>
              <WasteDetectionChips
                detections={draft.imageValidation.detectedObjects}
              />
            </View>
            {draft.imageValidation.summary ? (
              <View style={styles.contextSection}>
                <Text
                  style={[styles.technicalLabel, { color: colors.secondary }]}
                >
                  BỐI CẢNH HIỆN TRƯỜNG
                </Text>
                <Text
                  style={[styles.contextText, { color: colors.textSecondary }]}
                >
                  {draft.imageValidation.summary}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
        {state === "INVALID" || state === "UNAVAILABLE" ? (
          <View
            style={[
              styles.invalidCard,
              {
                backgroundColor:
                  state === "INVALID"
                    ? "rgba(248,113,113,0.12)"
                    : "rgba(245,158,11,0.12)",
              },
            ]}
          >
            <TriangleAlert
              size={24}
              color={state === "INVALID" ? colors.destructive : colors.accent}
            />
            <Text style={[styles.invalidTitle, { color: colors.text }]}>
              {state === "INVALID"
                ? "Ảnh chưa phù hợp"
                : "Chưa thể kiểm tra ảnh"}
            </Text>
            <Text style={[styles.invalidBody, { color: colors.textSecondary }]}>
              {state === "INVALID"
                ? "EcoAlert chưa phát hiện đủ bằng chứng về rác trong ảnh này."
                : draft.imageValidation.reason}
            </Text>
            {state === "INVALID" ? (
              <View style={styles.invalidActions}>
                <TouchableOpacity
                  onPress={retake}
                  style={[
                    styles.secondaryButton,
                    {
                      backgroundColor: colors.elevated,
                      borderColor: colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.secondaryText, { color: colors.text }]}>
                    CHỤP LẠI
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setGuideVisible(true)}
                  style={[
                    styles.secondaryButton,
                    { borderColor: colors.border },
                  ]}
                  accessibilityRole="button"
                >
                  <Text
                    style={[styles.secondaryText, { color: colors.secondary }]}
                  >
                    HƯỚNG DẪN
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => void analyze()}
                disabled={isOffline}
                style={[
                  styles.retryButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: isOffline ? 0.45 : 1,
                  },
                ]}
                accessibilityRole="button"
              >
                <RefreshCw size={16} color="#07101F" />
                <Text style={styles.primaryText}>THỬ LẠI</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </ScrollView>
      {state === "VALID" ? (
        <ReportBottomActions>
          <TouchableOpacity
            onPress={() => navigation.navigate("ReportConfirm")}
            style={[styles.continueButton, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>TIẾP TỤC ĐẾN BÁO CÁO</Text>
            <ChevronRight size={18} color="#07101F" />
          </TouchableOpacity>
        </ReportBottomActions>
      ) : null}
      <Modal
        visible={guideVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGuideVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Hướng dẫn chụp ảnh
              </Text>
              <TouchableOpacity
                onPress={() => setGuideVisible(false)}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Đóng hướng dẫn"
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Guide
              text="Chụp rõ toàn bộ điểm rác và bối cảnh xung quanh."
              colors={colors}
            />
            <Guide
              text="Giữ camera ổn định, tránh ảnh tối hoặc rung mờ."
              colors={colors}
            />
            <Guide
              text="Không che ống kính và không chụp quá xa."
              colors={colors}
            />
            <TouchableOpacity
              onPress={() => {
                setGuideVisible(false);
                retake();
              }}
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>CHỤP LẠI ẢNH</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const ProcessingRow = ({
  label,
  colors,
}: {
  label: string;
  colors: { text: string; textMuted: string; primary: string; border: string };
}) => (
  <View style={styles.processingRow}>
    <ActivityIndicator size="small" color={colors.primary} />
    <Text style={[styles.processingText, { color: colors.text }]}>{label}</Text>
  </View>
);
const Guide = ({
  text,
  colors,
}: {
  text: string;
  colors: { text: string; primary: string };
}) => (
  <View style={styles.guideRow}>
    <CheckCircle2 size={16} color={colors.primary} />
    <Text style={[styles.guideText, { color: colors.text }]}>{text}</Text>
  </View>
);
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 24, gap: 24 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerTitle: { marginTop: 16, fontSize: 22, fontWeight: "800" },
  previewFrame: { borderRadius: 16, overflow: "hidden" },
  preview: { width: "100%", height: 200, backgroundColor: "#081522" },
  previewBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: "hidden",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  analysisCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  analysisHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  technicalLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  processingRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  processingText: { fontSize: 13, fontWeight: "500" },
  processingHint: { fontSize: 11, lineHeight: 16 },
  resultHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  resultIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  resultCopy: { flex: 1 },
  resultTitle: { fontSize: 18, fontWeight: "800" },
  resultBody: { marginTop: 4, fontSize: 13, lineHeight: 19 },
  completedRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  completedText: { flex: 1, fontSize: 13, lineHeight: 19 },
  detectionSection: { gap: 12 },
  contextSection: { gap: 8 },
  contextText: { fontSize: 13, lineHeight: 19 },
  continueButton: {
    minHeight: 52,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButton: {
    minHeight: 52,
    minWidth: 210,
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
  invalidCard: { borderRadius: 16, padding: 20, alignItems: "center", gap: 12 },
  invalidTitle: { fontSize: 18, fontWeight: "800" },
  invalidBody: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  invalidActions: { alignSelf: "stretch", flexDirection: "row", gap: 8 },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 11, fontWeight: "800" },
  retryButton: {
    minHeight: 52,
    minWidth: 160,
    borderRadius: 12,
    marginTop: 12,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(7,16,31,0.76)",
    padding: 20,
    justifyContent: "center",
  },
  modalCard: { borderWidth: 1, borderRadius: 16, padding: 20 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  guideRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  guideText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
