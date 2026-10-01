import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CheckCircle2, ChevronRight, ImageIcon, RefreshCw, ScanLine, TriangleAlert, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ReportFlowParamList } from "../../../navigation/types";
import type { AlertCategory, ImageValidation, PreSubmitSemanticResult } from "../../../types";
import { alertService } from "../../../api/alertService";
import { useOfflineSync } from "../../../hooks/useOfflineSync";
import { useTheme } from "../../../context/ThemeContext";
import { useFieldReport } from "../FieldReportContext";
import { ReportHeader } from "../components/ReportHeader";
import { ReportProgress } from "../components/ReportProgress";

type Props = NativeStackScreenProps<ReportFlowParamList, "ReportImageValidation">;

const isBackendUrl = (value?: string): value is string => Boolean(value && /^https?:\/\//i.test(value));
const categoryFromSemantic = (value: AlertCategory | null): AlertCategory | null => value ?? null;

export const ReportImageValidationScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { draft, setDraft } = useFieldReport();
  const { isOffline } = useOfflineSync();
  const [guideVisible, setGuideVisible] = useState(false);
  const runningRef = useRef(false);
  const capture = draft.capture;

  const analyze = useCallback(async () => {
    if (!capture || runningRef.current) return;
    if (isOffline) {
      setDraft((current) => ({ ...current, imageValidation: { state: "UNAVAILABLE", detectedObjects: [], reason: "Cần kết nối mạng để kiểm tra ảnh trước khi gửi." } }));
      return;
    }
    runningRef.current = true;
    setDraft((current) => ({ ...current, imageValidation: { ...current.imageValidation, state: "PROCESSING", reason: null } }));
    try {
      let originalUploadedUrl = capture.originalUploadedUrl;
      if (!isBackendUrl(originalUploadedUrl)) {
        originalUploadedUrl = await alertService.uploadMedia(capture.originalLocalUri, `field_original_${Date.now()}.jpg`, "image/jpeg");
        if (!isBackendUrl(originalUploadedUrl)) throw new Error("UPLOAD_FAILED");
        const uploadedUrl = originalUploadedUrl;
        setDraft((current) => current.capture ? { ...current, capture: { ...current.capture, originalUploadedUrl: uploadedUrl } } : current);
      }

      const vision = await alertService.analyzeUploadedImage(originalUploadedUrl);
      if (vision.status === "error") throw new Error("VISION_UNAVAILABLE");
      const detections = vision.detections.map((item) => ({ label: item.materialClass, confidence: item.confidence, bbox: item.bbox }));
      if (vision.status === "no_detection" || detections.length === 0) {
        const backendValidation: ImageValidation = { decision: "INVALID", isEnvironmentalIncident: false, confidence: null, suggestedCategory: null, reason: "Không phát hiện đủ bằng chứng về rác thải trong ảnh.", model: "YOLO11n", validatedAt: new Date().toISOString() };
        setDraft((current) => ({ ...current, imageValidation: { state: "INVALID", isWasteRelated: false, detectedObjects: detections, reason: backendValidation.reason, backendValidation } }));
        return;
      }

      let semantic: PreSubmitSemanticResult | null = null;
      try { semantic = await alertService.validateImageSemantics(originalUploadedUrl, { title: draft.title, description: draft.description }); } catch { semantic = null; }
      const averageConfidence = detections.reduce((sum, item) => sum + (item.confidence ?? 0), 0) / detections.length;
      const suggestedCategory = semantic ? categoryFromSemantic(semantic.category) : null;
      const backendValidation: ImageValidation = {
        decision: vision.requiresManualReview ? "UNCERTAIN" : "VALID",
        isEnvironmentalIncident: semantic?.isIncident ?? true,
        confidence: semantic?.incidentConfidence ?? averageConfidence,
        suggestedCategory,
        reason: semantic?.shortReason || "Đã phát hiện đối tượng rác thải trong ảnh.",
        model: semantic?.model || "YOLO11n",
        validatedAt: new Date().toISOString(),
      };
      setDraft((current) => ({
        ...current,
        title: current.title || (suggestedCategory === "illegal_construction_waste" ? "Phế thải xây dựng tại hiện trường" : "Điểm rác cần được xử lý"),
        description: current.description || semantic?.overallSummary || semantic?.summary || "Phát hiện rác thải tại vị trí đã ghi nhận.",
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
      const reason = error instanceof Error && error.message === "UPLOAD_FAILED" ? "Không thể tải ảnh lên để kiểm tra." : "Dịch vụ kiểm tra ảnh tạm thời không khả dụng.";
      setDraft((current) => ({ ...current, imageValidation: { state: "UNAVAILABLE", detectedObjects: [], reason } }));
    } finally {
      runningRef.current = false;
    }
  }, [capture, draft.description, draft.title, isOffline, setDraft]);

  useEffect(() => { if (draft.imageValidation.state === "IDLE") void analyze(); }, [analyze, draft.imageValidation.state]);

  const state = draft.imageValidation.state;
  const retake = () => { setDraft((current) => ({ ...current, capture: undefined, imageValidation: { state: "IDLE", detectedObjects: [] } })); navigation.navigate("ReportCamera"); };

  if (!capture) return <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}><TriangleAlert size={36} color={colors.accent} /><Text style={[styles.centerTitle, { color: colors.text }]}>Không tìm thấy ảnh cần kiểm tra</Text><TouchableOpacity onPress={() => navigation.navigate("ReportCamera")} style={[styles.primaryButton, { backgroundColor: colors.primary }]} accessibilityRole="button"><Text style={styles.primaryText}>MỞ CAMERA</Text></TouchableOpacity></View>;

  return <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
    <ReportHeader onBack={navigation.goBack} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]} showsVerticalScrollIndicator={false}>
      <ReportProgress step={3} />
      <View><Text style={[styles.title, { color: colors.text }]}>Kiểm tra ảnh hiện trường</Text><Text style={[styles.subtitle, { color: colors.textMuted }]}>Hệ thống đang phân tích ảnh để kiểm tra nội dung và tính phù hợp của báo cáo.</Text></View>
      <Image source={{ uri: capture.displayLocalUri || capture.originalLocalUri }} style={styles.preview} resizeMode="cover" />
      {state === "PROCESSING" ? <View style={[styles.analysisCard, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.technicalLabel, { color: colors.textMuted }]}>TIẾN TRÌNH PHÂN TÍCH ẢNH</Text><ProcessingRow label="Đang tải ảnh gốc an toàn" colors={colors} /><ProcessingRow label="Đang nhận diện rác thải" colors={colors} /><ProcessingRow label="Đang phân tích bối cảnh" colors={colors} /></View> : null}
      {state === "VALID" ? <><View style={[styles.resultCard, { backgroundColor: "rgba(34,197,94,0.09)", borderColor: "rgba(34,197,94,0.32)" }]}><CheckCircle2 size={22} color={colors.primary} /><View style={styles.resultCopy}><Text style={[styles.resultTitle, { color: colors.primary }]}>Ảnh hợp lệ</Text><Text style={[styles.resultBody, { color: colors.textMuted }]}>Đã phát hiện nội dung phù hợp với phạm vi báo cáo rác thải.</Text></View></View><View style={[styles.detectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.technicalLabel, { color: colors.textMuted }]}>ĐỐI TƯỢNG ĐÃ PHÁT HIỆN</Text>{draft.imageValidation.detectedObjects.map((item, index) => <View key={`${item.label}-${index}`} style={[styles.detectionRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}><View style={styles.detectionName}><ScanLine size={15} color={colors.secondary} /><Text style={[styles.detectionLabel, { color: colors.text }]}>{item.label}</Text></View>{item.confidence !== undefined ? <Text style={[styles.confidence, { color: colors.primary }]}>{Math.round(item.confidence * 100)}%</Text> : null}</View>)}</View>{draft.imageValidation.summary ? <View style={[styles.contextCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.technicalLabel, { color: colors.secondary }]}>PHÂN TÍCH BỐI CẢNH</Text><Text style={[styles.contextText, { color: colors.text }]}>{draft.imageValidation.summary}</Text></View> : null}<TouchableOpacity onPress={() => navigation.navigate("ReportConfirm")} style={[styles.continueButton, { backgroundColor: colors.primary }]} accessibilityRole="button"><Text style={styles.primaryText}>TIẾP TỤC ĐẾN BÁO CÁO</Text><ChevronRight size={18} color="#07101F" /></TouchableOpacity></> : null}
      {state === "INVALID" ? <View style={[styles.invalidCard, { backgroundColor: "rgba(248,113,113,0.08)", borderColor: "rgba(248,113,113,0.3)" }]}><TriangleAlert size={23} color={colors.destructive} /><Text style={[styles.invalidTitle, { color: colors.destructive }]}>Ảnh chưa phù hợp</Text><Text style={[styles.invalidBody, { color: colors.textMuted }]}>EcoAlert không phát hiện đủ bằng chứng về rác thải trong ảnh này.</Text><View style={styles.invalidActions}><TouchableOpacity onPress={retake} style={[styles.secondaryButton, { borderColor: colors.border }]} accessibilityRole="button"><Text style={[styles.secondaryText, { color: colors.text }]}>CHỤP LẠI</Text></TouchableOpacity><TouchableOpacity onPress={() => setGuideVisible(true)} style={[styles.secondaryButton, { borderColor: colors.border }]} accessibilityRole="button"><Text style={[styles.secondaryText, { color: colors.secondary }]}>HƯỚNG DẪN</Text></TouchableOpacity></View></View> : null}
      {state === "UNAVAILABLE" ? <View style={[styles.invalidCard, { backgroundColor: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.3)" }]}><TriangleAlert size={23} color={colors.accent} /><Text style={[styles.invalidTitle, { color: colors.accent }]}>Chưa thể kiểm tra ảnh</Text><Text style={[styles.invalidBody, { color: colors.textMuted }]}>{draft.imageValidation.reason}</Text><TouchableOpacity onPress={() => void analyze()} disabled={isOffline} style={[styles.retryButton, { backgroundColor: colors.primary, opacity: isOffline ? 0.45 : 1 }]} accessibilityRole="button"><RefreshCw size={16} color="#07101F" /><Text style={styles.primaryText}>THỬ LẠI</Text></TouchableOpacity></View> : null}
    </ScrollView>
    <Modal visible={guideVisible} transparent animationType="fade" onRequestClose={() => setGuideVisible(false)}><View style={styles.modalBackdrop}><View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.text }]}>Hướng dẫn chụp ảnh</Text><TouchableOpacity onPress={() => setGuideVisible(false)} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Đóng hướng dẫn"><X size={20} color={colors.text} /></TouchableOpacity></View><Guide text="Chụp rõ toàn bộ điểm rác và bối cảnh xung quanh." colors={colors} /><Guide text="Giữ camera ổn định, tránh ảnh tối hoặc rung mờ." colors={colors} /><Guide text="Không che ống kính và không chụp quá xa." colors={colors} /><TouchableOpacity onPress={() => { setGuideVisible(false); retake(); }} style={[styles.retryButton, { backgroundColor: colors.primary }]} accessibilityRole="button"><Text style={styles.primaryText}>CHỤP LẠI ẢNH</Text></TouchableOpacity></View></View></Modal>
  </View>;
};

const ProcessingRow = ({ label, colors }: { label: string; colors: { text: string; textMuted: string; primary: string; border: string } }) => <View style={[styles.processingRow, { borderTopColor: colors.border }]}><ActivityIndicator size="small" color={colors.primary} /><Text style={[styles.processingText, { color: colors.text }]}>{label}</Text></View>;
const Guide = ({ text, colors }: { text: string; colors: { text: string; primary: string } }) => <View style={styles.guideRow}><CheckCircle2 size={16} color={colors.primary} /><Text style={[styles.guideText, { color: colors.text }]}>{text}</Text></View>;
const styles = StyleSheet.create({ container: { flex: 1 }, content: { padding: 16, gap: 18 }, centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }, centerTitle: { marginTop: 12, fontSize: 18, fontWeight: "900" }, title: { fontSize: 22, lineHeight: 28, fontWeight: "900", letterSpacing: -0.45 }, subtitle: { marginTop: 7, fontSize: 13, lineHeight: 19 }, preview: { width: "100%", height: 210, borderRadius: 15, backgroundColor: "#081522" }, analysisCard: { borderWidth: 1, borderRadius: 15, padding: 14 }, technicalLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1 }, processingRow: { minHeight: 46, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }, processingText: { fontSize: 12, fontWeight: "700" }, resultCard: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", gap: 10 }, resultCopy: { flex: 1 }, resultTitle: { fontSize: 15, fontWeight: "900" }, resultBody: { marginTop: 3, fontSize: 11, lineHeight: 16 }, detectionCard: { borderWidth: 1, borderRadius: 15, padding: 14 }, detectionRow: { minHeight: 43, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9 }, detectionName: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }, detectionLabel: { flex: 1, fontSize: 12, fontWeight: "800" }, confidence: { fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] }, contextCard: { borderWidth: 1, borderRadius: 14, padding: 13 }, contextText: { marginTop: 7, fontSize: 12, lineHeight: 18 }, continueButton: { minHeight: 52, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, primaryButton: { minHeight: 50, minWidth: 210, marginTop: 18, borderRadius: 12, alignItems: "center", justifyContent: "center" }, primaryText: { color: "#07101F", fontSize: 11, fontWeight: "900", letterSpacing: 0.4 }, invalidCard: { borderWidth: 1, borderRadius: 15, padding: 16, alignItems: "center" }, invalidTitle: { marginTop: 8, fontSize: 16, fontWeight: "900" }, invalidBody: { marginTop: 5, fontSize: 12, lineHeight: 18, textAlign: "center" }, invalidActions: { alignSelf: "stretch", flexDirection: "row", gap: 8, marginTop: 14 }, secondaryButton: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center" }, secondaryText: { fontSize: 10, fontWeight: "900" }, retryButton: { minHeight: 46, minWidth: 160, borderRadius: 11, marginTop: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", padding: 20, justifyContent: "center" }, modalCard: { borderWidth: 1, borderRadius: 16, padding: 16 }, modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }, modalTitle: { fontSize: 16, fontWeight: "900" }, closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, guideRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 9 }, guideText: { flex: 1, fontSize: 12, lineHeight: 17 } });
