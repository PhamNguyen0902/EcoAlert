import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Check, CheckCircle2, Eye, MapPin, Navigation, RotateCcw, Send, TriangleAlert } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CitizenStackParamList, ReportFlowParamList } from "../../../navigation/types";
import { useTheme } from "../../../context/ThemeContext";
import { useCheckNearbyAlerts, useConfirmAlert, useCreateAlert } from "../../../hooks/useAlerts";
import { useOfflineSync } from "../../../hooks/useOfflineSync";
import { alertService } from "../../../api/alertService";
import { offlineQueue } from "../../../utils/offlineQueue";
import { getCategoryLabel, getSeverityLabel, getWorkflowStatusLabel } from "../../../utils/aiAnalysis";
import { useFieldReport } from "../FieldReportContext";
import { MAX_FIELD_GPS_ACCURACY_METERS } from "../types";
import { ReportHeader } from "../components/ReportHeader";
import { ReportProgress } from "../components/ReportProgress";

type Props = NativeStackScreenProps<ReportFlowParamList, "ReportConfirm">;
const isBackendUrl = (value?: string): value is string => Boolean(value && /^https?:\/\//i.test(value));

export const ReportConfirmScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { draft, setDraft } = useFieldReport();
  const { isOffline } = useOfflineSync();
  const createAlert = useCreateAlert();
  const confirmAlert = useConfirmAlert();
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(true);
  const location = draft.location;
  const capture = draft.capture;
  const nearby = useCheckNearbyAlerts(location?.latitude, location?.longitude, 200);

  const groupedDetections = useMemo(() => {
    const groups = new Map<string, { count: number; confidenceTotal: number; confidenceCount: number }>();
    draft.imageValidation.detectedObjects.forEach((item) => {
      const current = groups.get(item.label) ?? { count: 0, confidenceTotal: 0, confidenceCount: 0 };
      groups.set(item.label, { count: current.count + 1, confidenceTotal: current.confidenceTotal + (item.confidence ?? 0), confidenceCount: current.confidenceCount + (item.confidence === undefined ? 0 : 1) });
    });
    return [...groups.entries()].map(([label, value]) => ({ label, count: value.count, confidence: value.confidenceCount ? value.confidenceTotal / value.confidenceCount : undefined }));
  }, [draft.imageValidation.detectedObjects]);

  const validDescription = draft.description.trim().length >= 10 && draft.description.length <= 500;
  const canSubmit = Boolean(location && location.accuracyMeters <= MAX_FIELD_GPS_ACCURACY_METERS && capture?.originalLocalUri && draft.imageValidation.state === "VALID" && validDescription && draft.title.trim().length >= 5 && acknowledged && !submitting);

  const retake = () => { setDraft((current) => ({ ...current, capture: undefined, imageValidation: { state: "IDLE", detectedObjects: [] } })); navigation.navigate("ReportCamera"); };
  const viewNearby = (id: string) => navigation.getParent<NativeStackNavigationProp<CitizenStackParamList>>()?.navigate("AlertDetail", { id });
  const confirmExisting = async (id: string) => { try { await confirmAlert.mutateAsync(id); viewNearby(id); } catch { setSubmitError("Không thể xác nhận báo cáo gần đó. Vui lòng thử lại."); } };

  const submit = async () => {
    if (!canSubmit || !location || !capture || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    const captureMetadata = { method: "LIVE_CAMERA" as const, capturedAt: capture.capturedAt, gpsAccuracyMeters: location.accuracyMeters, locationSource: "DEVICE_GPS" as const };
    try {
      if (isOffline) {
        await offlineQueue.saveOfflineDraft({ title: draft.title.trim(), description: draft.description.trim(), address: location.address, location: { type: "Point", coordinates: [location.longitude, location.latitude] }, localMediaUris: [capture.originalLocalUri], originalLocalUri: capture.originalLocalUri, displayLocalUri: capture.displayLocalUri, captureMetadata, imageValidation: draft.imageValidation.backendValidation, category: draft.imageValidation.suggestedCategory ?? undefined, isAnonymous: false });
        navigation.navigate("ReportSuccess", { queued: true });
        return;
      }

      let originalUrl = capture.originalUploadedUrl;
      if (!isBackendUrl(originalUrl)) originalUrl = await alertService.uploadMedia(capture.originalLocalUri, `field_original_${Date.now()}.jpg`, "image/jpeg");
      if (!isBackendUrl(originalUrl)) throw new Error("ORIGINAL_UPLOAD_FAILED");
      let displayUrl = capture.displayUploadedUrl;
      if (capture.displayLocalUri && !isBackendUrl(displayUrl)) {
        try { displayUrl = await alertService.uploadMedia(capture.displayLocalUri, `field_display_${Date.now()}.jpg`, "image/jpeg"); } catch { displayUrl = undefined; }
      }
      const created = await createAlert.mutateAsync({ title: draft.title.trim(), description: draft.description.trim(), address: location.address, location: { type: "Point", coordinates: [location.longitude, location.latitude] }, mediaUrls: [originalUrl], fieldEvidence: [{ originalUrl, ...(isBackendUrl(displayUrl) ? { displayUrl } : {}), capturedAt: capture.capturedAt, gpsAccuracyMeters: location.accuracyMeters }], captureMetadata, imageValidation: draft.imageValidation.backendValidation, category: draft.imageValidation.suggestedCategory ?? undefined, isAnonymous: false });
      setDraft((current) => ({ ...current, capture: current.capture ? { ...current.capture, originalUploadedUrl: originalUrl, ...(isBackendUrl(displayUrl) ? { displayUploadedUrl: displayUrl } : {}) } : current.capture, createdAlert: created }));
      navigation.navigate("ReportSuccess", { alertId: created._id });
    } catch {
      setSubmitError("Không thể gửi báo cáo. Dữ liệu của bạn vẫn được giữ lại để thử lại.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (!location || !capture || draft.imageValidation.state !== "VALID") return <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}><TriangleAlert size={36} color={colors.accent} /><Text style={[styles.centerTitle, { color: colors.text }]}>Hồ sơ báo cáo chưa hoàn tất</Text><TouchableOpacity onPress={() => navigation.navigate("ReportLocation")} style={[styles.primaryButton, { backgroundColor: colors.primary }]} accessibilityRole="button"><Text style={styles.primaryText}>LÀM LẠI TỪ VỊ TRÍ GPS</Text></TouchableOpacity></View>;

  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}><View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}><ReportHeader onBack={navigation.goBack} /><ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"><ReportProgress step={4} /><View><Text style={[styles.title, { color: colors.text }]}>Xác nhận báo cáo</Text><Text style={[styles.subtitle, { color: colors.textMuted }]}>Hồ sơ được chuẩn hóa tự động từ dữ liệu hình ảnh, vị trí và thông tin hiện trường.</Text></View>
    <View style={[styles.technicalBar, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.technicalText, { color: colors.primary }]}>GPS DEVICE FIX ACTIVE</Text><Text style={[styles.technicalText, { color: colors.textMuted }]}>±{Math.round(location.accuracyMeters)}m ACCURACY</Text></View>
    <Image source={{ uri: capture.displayLocalUri || capture.originalLocalUri }} style={styles.image} resizeMode="cover" />
    <View style={styles.chips}><View style={[styles.chip, { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.3)" }]}><Text style={[styles.chipText, { color: colors.primary }]}>{draft.imageValidation.suggestedCategory ? getCategoryLabel(draft.imageValidation.suggestedCategory, "vi").toUpperCase() : "CHƯA XÁC ĐỊNH"}</Text></View><View style={[styles.chip, { backgroundColor: "rgba(245,158,11,0.10)", borderColor: "rgba(245,158,11,0.28)" }]}><Text style={[styles.chipText, { color: colors.accent }]}>MỨC ĐỘ: {draft.imageValidation.severity ? getSeverityLabel(draft.imageValidation.severity, "vi").toUpperCase() : "ĐANG ĐÁNH GIÁ"}</Text></View></View>
    {groupedDetections.length ? <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.technicalLabel, { color: colors.textMuted }]}>ĐỐI TƯỢNG ĐÃ PHÁT HIỆN</Text><View style={styles.detectionChips}>{groupedDetections.map((item) => <View key={item.label} style={[styles.detectionChip, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.detectionText, { color: colors.text }]}>{item.count > 1 ? `${item.count} × ` : ""}{item.label}</Text>{item.confidence !== undefined ? <Text style={[styles.detectionConfidence, { color: colors.primary }]}>{Math.round(item.confidence * 100)}%</Text> : null}</View>)}</View></View> : null}
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.technicalLabel, { color: colors.textMuted }]}>TỌA ĐỘ & ĐỊA ĐIỂM HÀNH CHÍNH</Text><View style={styles.locationRow}><MapPin size={18} color={colors.secondary} /><Text style={[styles.address, { color: colors.text }]}>{location.address}</Text></View><View style={styles.locationMetrics}><View><Text style={[styles.metricLabel, { color: colors.textMuted }]}>TỌA ĐỘ</Text><Text style={[styles.metricValue, { color: colors.text }]}>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</Text></View><View><Text style={[styles.metricLabel, { color: colors.textMuted }]}>ĐỘ CHÍNH XÁC</Text><Text style={[styles.metricValue, { color: colors.primary }]}>±{Math.round(location.accuracyMeters)}m</Text></View></View></View>
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.inputHeader}><Text style={[styles.technicalLabel, { color: colors.textMuted }]}>MÔ TẢ HIỆN TRƯỜNG</Text><Text style={[styles.counter, { color: draft.description.length > 500 ? colors.destructive : colors.textMuted }]}>{draft.description.length} / 500</Text></View><TextInput value={draft.description} onChangeText={(description) => setDraft((current) => ({ ...current, description }))} maxLength={500} multiline textAlignVertical="top" placeholder="Mô tả tình trạng rác tại hiện trường..." placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: validDescription ? colors.border : colors.destructive, backgroundColor: colors.surface }]} accessibilityLabel="Mô tả hiện trường" />{!validDescription ? <Text style={[styles.inputError, { color: colors.destructive }]}>Mô tả cần từ 10 đến 500 ký tự.</Text> : null}</View>
    {nearby.data?.length ? <View style={[styles.nearbyCard, { borderColor: "rgba(245,158,11,0.3)", backgroundColor: "rgba(245,158,11,0.08)" }]}><TriangleAlert size={18} color={colors.accent} /><View style={styles.nearbyCopy}><Text style={[styles.nearbyTitle, { color: colors.accent }]}>Đã có báo cáo đang xử lý gần vị trí này</Text><Text style={[styles.nearbyName, { color: colors.text }]} numberOfLines={1}>{nearby.data[0].title}</Text><Text style={[styles.nearbyMeta, { color: colors.textMuted }]}>{getWorkflowStatusLabel(nearby.data[0].status, "vi")}</Text><View style={styles.nearbyActions}><TouchableOpacity onPress={() => viewNearby(nearby.data![0]._id)} style={styles.nearbyButton} accessibilityRole="button"><Eye size={14} color={colors.secondary} /><Text style={[styles.nearbyButtonText, { color: colors.secondary }]}>XEM BÁO CÁO</Text></TouchableOpacity><TouchableOpacity onPress={() => void confirmExisting(nearby.data![0]._id)} disabled={confirmAlert.isPending} style={styles.nearbyButton} accessibilityRole="button"><CheckCircle2 size={14} color={colors.primary} /><Text style={[styles.nearbyButtonText, { color: colors.primary }]}>SỰ CỐ VẪN CÒN</Text></TouchableOpacity></View></View></View> : null}
    <TouchableOpacity onPress={() => setAcknowledged((value) => !value)} style={[styles.ack, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityRole="checkbox" accessibilityState={{ checked: acknowledged }}><View style={[styles.checkbox, { backgroundColor: acknowledged ? colors.primary : "transparent", borderColor: acknowledged ? colors.primary : colors.textMuted }]}>{acknowledged ? <Check size={14} color="#07101F" strokeWidth={3} /> : null}</View><Text style={[styles.ackText, { color: colors.textMuted }]}>Báo cáo sẽ được gửi đến hệ thống EcoAlert để tiếp nhận và xử lý.</Text></TouchableOpacity>
    {isOffline ? <View style={[styles.offlineNote, { borderColor: "rgba(245,158,11,0.3)" }]}><TriangleAlert size={16} color={colors.accent} /><Text style={[styles.offlineText, { color: colors.textMuted }]}>Mạng đã ngắt sau khi kiểm tra ảnh. Báo cáo sẽ được lưu cục bộ và đồng bộ khi kết nối lại.</Text></View> : null}{submitError ? <Text style={[styles.submitError, { color: colors.destructive }]}>{submitError}</Text> : null}
    <TouchableOpacity onPress={() => void submit()} disabled={!canSubmit} style={[styles.submitButton, { backgroundColor: colors.primary, opacity: canSubmit ? 1 : 0.45 }]} accessibilityRole="button">{submitting ? <ActivityIndicator color="#07101F" /> : <><Send size={18} color="#07101F" /><Text style={styles.primaryText}>{isOffline ? "LƯU BÁO CÁO NGOẠI TUYẾN" : "GỬI BÁO CÁO"}</Text></>}</TouchableOpacity><TouchableOpacity onPress={retake} disabled={submitting} style={[styles.retakeButton, { borderColor: colors.border }]} accessibilityRole="button"><RotateCcw size={16} color={colors.text} /><Text style={[styles.retakeText, { color: colors.text }]}>Chụp lại hiện trường</Text></TouchableOpacity>
  </ScrollView></View></KeyboardAvoidingView>;
};

const styles = StyleSheet.create({ container: { flex: 1 }, content: { padding: 16, gap: 17 }, centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }, centerTitle: { marginTop: 12, fontSize: 18, fontWeight: "900", textAlign: "center" }, title: { fontSize: 22, lineHeight: 28, fontWeight: "900", letterSpacing: -0.45 }, subtitle: { marginTop: 7, fontSize: 13, lineHeight: 19 }, technicalBar: { minHeight: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, technicalText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.7 }, image: { width: "100%", height: 240, borderRadius: 15, backgroundColor: "#081522" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 }, chipText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.45 }, card: { borderWidth: 1, borderRadius: 15, padding: 14 }, technicalLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1 }, detectionChips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 11 }, detectionChip: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7, flexDirection: "row", gap: 5 }, detectionText: { fontSize: 10, fontWeight: "800" }, detectionConfidence: { fontSize: 10, fontWeight: "900" }, locationRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 11 }, address: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "800" }, locationMetrics: { marginTop: 13, flexDirection: "row", justifyContent: "space-between", gap: 12 }, metricLabel: { fontSize: 8, fontWeight: "800", letterSpacing: 0.7 }, metricValue: { marginTop: 3, fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] }, inputHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, counter: { fontSize: 9, fontWeight: "700" }, input: { minHeight: 112, marginTop: 10, borderWidth: 1, borderRadius: 11, padding: 11, fontSize: 13, lineHeight: 19 }, inputError: { marginTop: 5, fontSize: 10, fontWeight: "700" }, nearbyCard: { borderWidth: 1, borderRadius: 14, padding: 13, flexDirection: "row", gap: 9 }, nearbyCopy: { flex: 1 }, nearbyTitle: { fontSize: 12, fontWeight: "900" }, nearbyName: { marginTop: 5, fontSize: 12, fontWeight: "800" }, nearbyMeta: { marginTop: 2, fontSize: 10 }, nearbyActions: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 7 }, nearbyButton: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 5 }, nearbyButtonText: { fontSize: 9, fontWeight: "900" }, ack: { borderWidth: 1, borderRadius: 13, padding: 12, flexDirection: "row", alignItems: "center", gap: 9 }, checkbox: { width: 22, height: 22, borderWidth: 1, borderRadius: 7, alignItems: "center", justifyContent: "center" }, ackText: { flex: 1, fontSize: 11, lineHeight: 16 }, offlineNote: { borderWidth: 1, borderRadius: 12, padding: 11, flexDirection: "row", gap: 8 }, offlineText: { flex: 1, fontSize: 10, lineHeight: 15 }, submitError: { fontSize: 11, lineHeight: 16, textAlign: "center" }, submitButton: { minHeight: 52, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, primaryButton: { minHeight: 50, minWidth: 220, marginTop: 18, borderRadius: 12, alignItems: "center", justifyContent: "center" }, primaryText: { color: "#07101F", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 }, retakeButton: { minHeight: 48, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, retakeText: { fontSize: 11, fontWeight: "800" } });
