import {
  civicSpace as space,
  civicRadius as radius,
  civicType,
} from "../../../shared/theme/civicDesign";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
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
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ReportFlowParamList } from "../../../app/navigation/types";
import { analyzePhoto, photoAnalysisIdentity, logCitizenAi } from "../photoAnalysis";
import { canReviewReport, aiStageLabels } from "../reviewPolicy";
import { alertService } from "../../../shared/api/alertService";
import { useOfflineSync } from "../hooks/useOfflineSync";
import { useReportTheme } from "../useReportTheme";
import { ReportBottomActions } from "../components/ReportBottomActions";
import { useFieldReport } from "../FieldReportContext";
import { normalizePhotoDraft, removePhoto, updatePhoto } from "../photoDraft";
import { ReportHeader } from "../components/ReportHeader";
import { ReportProgress } from "../components/ReportProgress";
import { WasteDetectionImage } from "../../../shared/components/vision/WasteDetectionImage";
import { FieldAiResultCard } from "../components/stitch/FieldAiResultCard";
import {
  FieldEvidenceMetaOverlay,
  FieldNotice,
  FieldScanLine,
} from "../components/stitch/FieldUI";
import { fieldStyles } from "../components/stitch/fieldDesign";

type Props = NativeStackScreenProps<
  ReportFlowParamList,
  "ReportImageValidation"
>;
// màn hình bước bốn phân tích ảnh bằng ai và kiểm định tính hợp lệ của sự cố
export const ReportImageValidationScreen: React.FC<Props> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { colors } = useReportTheme();
  const { draft, setDraft: writeDraft } = useFieldReport();
  const { isOffline } = useOfflineSync();
  const [guideVisible, setGuideVisible] = useState(false);
  const runningRef = useRef(false);
  const capture = draft.capture;
  const photos = normalizePhotoDraft(draft).photos;
  const [previewPhotoId, setPreviewPhotoId] = useState<string | undefined>(capture?.id);
  const previewPhoto = photos.find(photo => photo.id === previewPhotoId) || capture;
  // Guard the draft and each immutable original, not whichever photo is primary.
  const setDraft = useCallback((update: Parameters<typeof writeDraft>[0]) => writeDraft(current =>
    current.id !== draft.id ? current : typeof update === "function" ? update(current) : update), [writeDraft, draft.id]);
  const previewAnalysis = previewPhoto?.analysisIdentity === (previewPhoto && photoAnalysisIdentity(previewPhoto))
    ? previewPhoto?.analysis : undefined;
  const imageDetections = useMemo(() => previewPhoto?.visionState === "OK"
    ? (previewPhoto.detections || []).map(item => ({ ...item, materialClass: item.label, confidence: item.confidence ?? NaN }))
    : [], [previewPhoto?.visionState, previewPhoto?.detections]);
  const analyze = useCallback(async (onlyPhotoId?: string, retrySemantic = false) => {
    if (!isFocused || !capture || runningRef.current) return;
    if (isOffline) {
      setDraft(current => ({ ...current, imageValidation: { ...current.imageValidation,
        state: "UNAVAILABLE",
        semanticState: "UNAVAILABLE", semanticError: "Cần kết nối mạng để phân loại AI.",
        reason: "Cần kết nối mạng để kiểm tra ảnh trước khi gửi." } }));
      return;
    }
    runningRef.current = true;
    setDraft(current => ({ ...current, imageValidation: { ...current.imageValidation, state: "PROCESSING" } }));
    try {
      await Promise.all(photos.filter(photo => !onlyPhotoId || photo.id === onlyPhotoId).map(photo =>
        analyzePhoto(photo, draft.id, { title: draft.title, description: draft.description }, alertService, patch =>
          setDraft(current => {
            const live = current.photos.find(item => item.id === photo.id);
            if (!live || photoAnalysisIdentity(live) !== photoAnalysisIdentity(photo)) return current;
            return updatePhoto(current, photo.id!, patch);
          }), { retrySemantic })));
    } finally {
      setDraft(current => {
        const primary = normalizePhotoDraft(current).capture;
        const analysis = primary?.analysis || { state: "IDLE" as const, detectedObjects: [] };
        return { ...current, imageValidation: { ...analysis, userSelectedCategory: current.imageValidation.userSelectedCategory },
          title: current.title || (analysis.semanticState === "COMPLETE" ? "Sự cố môi trường tại hiện trường" : ""),
          description: current.description || analysis.summary || "" };
      });
      runningRef.current = false;
    }
  }, [isFocused, capture, photos, draft.id, draft.title, draft.description, isOffline, setDraft]);

  // Includes old persisted PROCESSING sessions; no request from a previous mount
  // is still owned by this screen. Complete per-image stages are reused.
  useEffect(() => {
    const pending = photos.some(photo => photo.analysisIdentity !== photoAnalysisIdentity(photo) || !photo.analysis
      || photo.visionState === "PROCESSING" || photo.semanticStage === "PROCESSING");
    if (isFocused && !runningRef.current && (draft.imageValidation.state === "IDLE"
      || draft.imageValidation.state === "PROCESSING" || pending && !isOffline)) void analyze();
  }, [analyze, draft.imageValidation.state, photos, isOffline, isFocused]);
  useEffect(() => { logCitizenAi("RESULT_RENDERED", previewPhoto?.id); }, [previewPhoto?.id, previewAnalysis]);

  const state = draft.imageValidation.state;
  const canContinue = canReviewReport(draft, isOffline) && state !== "PROCESSING";
  const previewState = previewPhoto?.visionState === "PROCESSING" || previewPhoto?.semanticStage === "PROCESSING"
    ? "PROCESSING" : previewAnalysis?.state || state;
  // xóa ảnh chụp và quay lại bước camera nếu ảnh không đạt yêu cầu
  const retake = () => {
    setDraft((current) => previewPhoto?.id ? removePhoto(current, previewPhoto.id) : current);
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
      <ReportHeader title="AI phân tích hình ảnh" onBack={navigation.goBack} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ReportProgress step={2} status="AI / YOLO · PHÂN TÍCH HIỆN TRƯỜNG" />
        <FieldNotice>
          EcoAlert AI đang hỗ trợ nhận diện rác thải trong ảnh hiện trường để đề
          xuất phân loại.
        </FieldNotice>
        <View style={styles.previewFrame}>
          <WasteDetectionImage
            imageUri={previewPhoto?.originalLocalUri || capture.originalLocalUri}
            detections={imageDetections}
            aspectRatio={3 / 4}
            frameStyle={{
              width: "100%",
              maxWidth: 480,
              borderWidth: 1,
              borderColor: "rgba(56,189,248,0.22)",
            }}
            showHints={false}
            frameOverlay={
              <>
                <FieldEvidenceMetaOverlay
                  location={previewPhoto?.location || draft.location}
                  capture={previewPhoto || capture}
                />
                {state === "PROCESSING" ? <FieldScanLine /> : null}
              </>
            }
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
            {previewPhoto?.visionState === "OK" ? "✓ ĐÃ PHÁT HIỆN VẬT THỂ" :
              previewPhoto?.visionState === "NO_DETECTION" ? "Chưa nhận diện được vật thể" :
              previewPhoto?.visionState === "FAILED" ? "PHÂN TÍCH LỖI" :
              previewPhoto?.visionState === "PROCESSING" ? "ĐANG PHÂN TÍCH" : "ẢNH HIỆN TRƯỜNG"}
          </Text>
        </View>
        <View style={styles.photoStatuses}>
          {photos.map((photo, index) => (
            <TouchableOpacity key={photo.id} onPress={() => { setPreviewPhotoId(photo.id); logCitizenAi("IMAGE_SELECTED", photo.id); }} accessibilityRole="button"
              accessibilityLabel={`Xem kết quả phân tích ảnh ${index + 1}`} style={[styles.photoStatusRow, photo.id === previewPhoto?.id && styles.photoStatusSelected]}>
              <Text style={styles.photoStatusText}>Ảnh {index + 1}{photo.id === capture.id ? " · chính" : ""}: {photo.visionState === "OK" ? `${photo.detections?.length || 0} vùng phát hiện` : photo.visionState === "NO_DETECTION" ? "Không phát hiện" : photo.visionState === "FAILED" ? "Phân tích lỗi" : photo.visionState === "PROCESSING" ? "Đang phân tích…" : "Chờ phân tích"}</Text>
              <Text style={styles.photoStatusText}>{photo.uploadState === "UPLOADING" ? "Đang tải…" : photo.uploadState === "FAILED" ? "Tải lỗi" : photo.uploadState === "UPLOADED" ? "Đã tải" : ""} · {aiStageLabels({ ...(photo.analysis || { state: "IDLE", detectedObjects: [] }), semanticStage: photo.semanticStage, visionState: photo.visionState }).semantic}</Text>
              {photo.visionState === "FAILED" || photo.uploadState === "FAILED" || photo.semanticStage === "FAILED" ? <TouchableOpacity accessibilityRole="button" onPress={() => {
                void analyze(photo.id);
              }}><Text style={styles.retryPhotoText}>THỬ LẠI</Text></TouchableOpacity> : null}
            </TouchableOpacity>
          ))}
        </View>
        {previewPhoto?.uploadError || previewPhoto?.visionError ? (
          <Text style={[styles.invalidBody, { color: colors.accent }]} accessibilityLiveRegion="polite">
            {previewPhoto.uploadError || previewPhoto.visionError}
          </Text>
        ) : null}
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
        {previewState !== "PROCESSING" && previewAnalysis ? (
          <FieldAiResultCard analysis={previewAnalysis} />
        ) : null}
        {previewState !== "PROCESSING" && !!previewAnalysis?.semanticState && previewAnalysis.semanticState !== "COMPLETE" ? (
          <View style={[styles.analysisCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.invalidTitle, { color: colors.accent }]}>{previewAnalysis.semanticState === "UNAVAILABLE" ? "Tạm thời không thể phân tích ảnh" : "Chưa xác định được danh mục phù hợp"}</Text>
            <Text style={[styles.invalidBody, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">{previewAnalysis?.semanticError || previewAnalysis?.reason || previewPhoto?.uploadError || previewPhoto?.visionError}</Text>
            <TouchableOpacity onPress={() => void analyze(previewPhoto?.id, true)} disabled={isOffline || state === "PROCESSING"} accessibilityRole="button" style={[styles.retryButton, { backgroundColor: colors.primary, opacity: isOffline || state === "PROCESSING" ? 0.45 : 1 }]}>
              <RefreshCw size={16} color="#07101F" /><Text style={styles.primaryText}>THỬ LẠI PHÂN LOẠI AI</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <FieldNotice>
          AI chỉ hỗ trợ gợi ý phân loại và đánh giá. Bạn có toàn quyền kiểm tra
          nội dung trước khi gửi báo cáo; kết quả cuối cùng cần cán bộ xác nhận.
        </FieldNotice>
        {canContinue ? <FieldNotice>
          Chưa gửi · Chờ phân loại. Bạn có thể bổ sung mô tả và gửi ảnh cùng GPS để cán bộ rà soát, kể cả khi AI chưa có kết luận.
        </FieldNotice> : null}
        {previewState === "INVALID" || previewState === "UNAVAILABLE" ? (
          <View
            style={[
              styles.invalidCard,
              {
                backgroundColor:
                  previewState === "INVALID"
                    ? "rgba(248,113,113,0.12)"
                    : "rgba(245,158,11,0.12)",
              },
            ]}
          >
            <TriangleAlert
              size={24}
              color={previewState === "INVALID" ? colors.destructive : colors.accent}
            />
            <Text style={[styles.invalidTitle, { color: colors.text }]}>
              {previewState === "INVALID"
                ? "Chưa nhận diện được vật thể"
                : "Tạm thời không thể phân tích ảnh"}
            </Text>
            <Text style={[styles.invalidBody, { color: colors.textSecondary }]}>
              {previewState === "INVALID"
                ? "Ảnh chưa có vùng rác được nhận diện."
                : previewAnalysis?.reason || draft.imageValidation.reason}
            </Text>
            {previewState === "INVALID" ? (
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
                onPress={() => void analyze(previewPhoto?.id)}
                disabled={isOffline || state === "PROCESSING"}
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
      {canContinue ? (
        <ReportBottomActions>
          <TouchableOpacity
            // xác nhận kết quả kiểm tra ảnh hợp lệ và chuyển sang bước xác nhận thông tin báo cáo
            onPress={() => navigation.navigate("ReportConfirm")}
            style={[styles.continueButton, { backgroundColor: colors.cta }]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{isOffline && state !== "VALID" ? "TIẾP TỤC NGOẠI TUYẾN" : "TIẾP TỤC XÁC NHẬN"}</Text>
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
  scroll: { flex: 1, minHeight: 0 },
  content: fieldStyles.content,
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.section,
  },
  centerTitle: { marginTop: space.lg, fontSize: 22, fontWeight: "800" },
  previewFrame: { borderRadius: radius.card, overflow: "hidden" },
  photoStatuses: { gap: 6 },
  photoStatusRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, backgroundColor: "#101D31", borderRadius: 8, padding: 9 },
  photoStatusSelected: { borderWidth: 1, borderColor: "#22C55E" },
  photoStatusText: { color: "#CBD5E1", fontSize: 11 },
  retryPhotoText: { color: "#38BDF8", fontSize: 11, fontWeight: "700" },
  previewBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    marginTop: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderRadius: 8,
    overflow: "hidden",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  analysisCard: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
  },
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
    gap: space.md,
  },
  processingText: { fontSize: 13, fontWeight: "500" },
  processingHint: { fontSize: 11, lineHeight: 16 },
  continueButton: {
    minHeight: 52,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  primaryButton: {
    minHeight: 52,
    minWidth: 210,
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
  invalidCard: {
    borderRadius: radius.card,
    padding: space.xl,
    alignItems: "center",
    gap: space.md,
  },
  invalidTitle: { fontSize: 18, fontWeight: "800" },
  invalidBody: { fontSize: 13, lineHeight: 20, textAlign: "center" },
  invalidActions: { alignSelf: "stretch", flexDirection: "row", gap: space.sm },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: civicType.button,
  retryButton: {
    minHeight: 52,
    minWidth: 160,
    borderRadius: 12,
    marginTop: space.md,
    paddingHorizontal: space.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(7,16,31,0.76)",
    padding: space.xl,
    justifyContent: "center",
  },
  modalCard: { borderWidth: 1, borderRadius: radius.card, padding: space.xl },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.md,
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
    gap: space.md,
  },
  guideText: { flex: 1, fontSize: 13, lineHeight: 20 },
});
