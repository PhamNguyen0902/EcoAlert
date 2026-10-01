import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ViewShot, { captureRef, type ViewShotRef } from "react-native-view-shot";
import { Camera, CheckCircle2, Clock3, MapPin, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ReportFlowParamList } from "../../../navigation/types";
import { useTheme } from "../../../context/ThemeContext";
import { formatWatermarkData, persistWatermarkedDisplayImage } from "../../../utils/watermark";
import { useFieldReport } from "../FieldReportContext";
import { ReportHeader } from "../components/ReportHeader";
import { ReportProgress } from "../components/ReportProgress";

type Props = NativeStackScreenProps<ReportFlowParamList, "ReportPhotoReview">;

export const ReportPhotoReviewScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { draft, setDraft } = useFieldReport();
  const capture = draft.capture;
  const location = draft.location;
  const viewShotRef = useRef<ViewShotRef>(null);
  const generatedForRef = useRef<string | null>(capture?.displayLocalUri ? capture.originalLocalUri : null);
  const [rendering, setRendering] = useState(false);
  const [watermarkError, setWatermarkError] = useState<string | null>(null);

  const watermark = useMemo(() => formatWatermarkData({ latitude: location?.latitude, longitude: location?.longitude, accuracyMeters: location?.accuracyMeters, address: location?.address, timestamp: capture ? new Date(capture.capturedAt) : undefined, brandTag: "ECOALERT FIELD CAPTURE" }, "vi"), [capture, location]);
  const aspectRatio = capture?.width && capture.height ? capture.width / capture.height : 4 / 3;
  const integrityCount = Number(Boolean(capture?.originalLocalUri)) + Number(Boolean(location?.source === "DEVICE_GPS")) + Number(Boolean(capture?.capturedAt));

  const renderDisplayImage = useCallback(async () => {
    if (!capture || !viewShotRef.current || rendering || generatedForRef.current === capture.originalLocalUri) return;
    setRendering(true);
    setWatermarkError(null);
    generatedForRef.current = capture.originalLocalUri;
    try {
      const temporaryUri = await captureRef(viewShotRef, { format: "jpg", quality: 0.95, result: "tmpfile" });
      const displayLocalUri = await persistWatermarkedDisplayImage(temporaryUri, capture.capturedAt);
      setDraft((current) => current.capture?.originalLocalUri === capture.originalLocalUri ? { ...current, capture: { ...current.capture, displayLocalUri } } : current);
    } catch {
      generatedForRef.current = null;
      setWatermarkError("Không thể tạo ảnh hiển thị có watermark. Ảnh gốc vẫn được giữ nguyên.");
    } finally {
      setRendering(false);
    }
  }, [capture, rendering, setDraft]);

  const retake = () => {
    setDraft((current) => ({ ...current, capture: undefined, imageValidation: { state: "IDLE", detectedObjects: [] } }));
    navigation.navigate("ReportCamera");
  };

  if (!capture || !location) return <View style={[styles.missingScreen, { backgroundColor: colors.background, paddingTop: insets.top }]}><TriangleAlert size={36} color={colors.accent} /><Text style={[styles.missingTitle, { color: colors.text }]}>Chưa có ảnh hiện trường</Text><Text style={[styles.missingBody, { color: colors.textMuted }]}>Hãy quay lại Camera để chụp ảnh trực tiếp.</Text><TouchableOpacity onPress={() => navigation.navigate("ReportCamera")} style={[styles.primaryButton, { backgroundColor: colors.primary }]} accessibilityRole="button"><Text style={styles.primaryButtonText}>MỞ CAMERA</Text></TouchableOpacity></View>;

  return <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
    <ReportHeader onBack={navigation.goBack} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]} showsVerticalScrollIndicator={false}>
      <ReportProgress step={2} />
      <View><Text style={[styles.title, { color: colors.text }]}>Kiểm tra ảnh hiện trường</Text><Text style={[styles.subtitle, { color: colors.textMuted }]}>Xác thực chất lượng dữ liệu trước khi chuyển sang bước kiểm tra ảnh.</Text></View>
      <View style={[styles.imageCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.95, result: "tmpfile" }} style={styles.viewShot}>
          <Image source={{ uri: capture.originalLocalUri }} style={[styles.image, { aspectRatio }]} resizeMode="cover" onLoadEnd={() => void renderDisplayImage()} />
          <View style={styles.watermark}><View style={styles.watermarkBrand}><ShieldCheck size={13} color="#22C55E" /><Text style={styles.watermarkBrandText}>{watermark.brandStr}</Text></View><Text style={styles.watermarkAddress} numberOfLines={2}>{watermark.addressStr}</Text><Text style={styles.watermarkLine}>{watermark.locationStr}</Text><Text style={styles.watermarkLine}>{watermark.dateTimeStr.replace("Captured:", "")}</Text></View>
        </ViewShot>
        {rendering ? <View style={styles.renderingBadge}><ActivityIndicator size="small" color="#22C55E" /><Text style={styles.renderingText}>Đang tạo watermark...</Text></View> : null}
      </View>
      {watermarkError ? <View style={[styles.errorCard, { borderColor: "rgba(245,158,11,0.3)" }]}><TriangleAlert size={17} color={colors.accent} /><View style={styles.errorCopy}><Text style={[styles.errorText, { color: colors.textMuted }]}>{watermarkError}</Text><TouchableOpacity onPress={() => void renderDisplayImage()} style={styles.retryWatermark} accessibilityRole="button"><RefreshCw size={13} color={colors.secondary} /><Text style={[styles.retryText, { color: colors.secondary }]}>THỬ TẠO LẠI</Text></TouchableOpacity></View></View> : null}
      <View style={[styles.integrityCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.integrityHeader}><Text style={[styles.technicalLabel, { color: colors.textMuted }]}>TÍNH TOÀN VẸN DỮ LIỆU</Text><Text style={[styles.passed, { color: integrityCount === 3 ? colors.primary : colors.accent }]}>{integrityCount}/3 ĐẠT</Text></View><IntegrityRow icon={<Camera size={17} color={colors.primary} />} title="Camera trực tiếp" body="Ảnh được chụp trong luồng báo cáo EcoAlert." colors={colors} /><IntegrityRow icon={<MapPin size={17} color={colors.primary} />} title="GPS thiết bị" body="Ảnh gắn với vị trí GPS ghi nhận ngay trước thời điểm chụp." colors={colors} /><IntegrityRow icon={<Clock3 size={17} color={colors.primary} />} title="Thời gian chụp" body="Thời gian chụp đã được lưu cùng metadata báo cáo." colors={colors} /></View>
      <View style={styles.actions}><TouchableOpacity onPress={retake} style={[styles.secondaryButton, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button"><Camera size={17} color={colors.text} /><Text style={[styles.secondaryText, { color: colors.text }]}>CHỤP LẠI</Text></TouchableOpacity><TouchableOpacity onPress={() => navigation.navigate("ReportImageValidation")} disabled={integrityCount !== 3} style={[styles.useButton, { backgroundColor: colors.primary, opacity: integrityCount === 3 ? 1 : 0.45 }]} accessibilityRole="button"><Text style={styles.primaryButtonText}>SỬ DỤNG ẢNH NÀY</Text><Text style={styles.arrow}>→</Text></TouchableOpacity></View>
    </ScrollView>
  </View>;
};

const IntegrityRow = ({ icon, title, body, colors }: { icon: React.ReactNode; title: string; body: string; colors: { text: string; textMuted: string; primary: string } }) => <View style={styles.integrityRow}><View style={styles.checkIcon}>{icon}<CheckCircle2 size={11} color={colors.primary} style={styles.checkBadge} /></View><View style={styles.integrityCopy}><Text style={[styles.integrityTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.integrityBody, { color: colors.textMuted }]}>{body}</Text></View></View>;
const styles = StyleSheet.create({ container: { flex: 1 }, content: { padding: 16, gap: 18 }, title: { fontSize: 22, lineHeight: 28, fontWeight: "900", letterSpacing: -0.45 }, subtitle: { marginTop: 7, fontSize: 13, lineHeight: 19 }, imageCard: { borderWidth: 1, borderRadius: 16, overflow: "hidden" }, viewShot: { backgroundColor: "#081522" }, image: { width: "100%", minHeight: 240 }, watermark: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 20, paddingBottom: 10, backgroundColor: "rgba(7,16,31,0.82)" }, watermarkBrand: { flexDirection: "row", alignItems: "center", gap: 5 }, watermarkBrandText: { color: "#22C55E", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 }, watermarkAddress: { color: "#F8FAFC", fontSize: 10, lineHeight: 14, fontWeight: "700", marginTop: 4 }, watermarkLine: { color: "#CBD5E1", fontSize: 9, marginTop: 2 }, renderingBadge: { position: "absolute", right: 8, top: 8, borderRadius: 9, backgroundColor: "rgba(7,16,31,0.85)", paddingHorizontal: 8, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 5 }, renderingText: { color: "#F8FAFC", fontSize: 9, fontWeight: "700" }, errorCard: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", gap: 9 }, errorCopy: { flex: 1 }, errorText: { fontSize: 11, lineHeight: 16 }, retryWatermark: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start" }, retryText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.4 }, integrityCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 13 }, integrityHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, technicalLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1 }, passed: { fontSize: 9, fontWeight: "900", letterSpacing: 0.6 }, integrityRow: { flexDirection: "row", alignItems: "center", gap: 10 }, checkIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(34,197,94,0.10)" }, checkBadge: { position: "absolute", right: -2, bottom: -2 }, integrityCopy: { flex: 1 }, integrityTitle: { fontSize: 12, fontWeight: "800" }, integrityBody: { marginTop: 2, fontSize: 10, lineHeight: 15 }, actions: { flexDirection: "row", gap: 9 }, secondaryButton: { flex: 0.8, minHeight: 50, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, secondaryText: { fontSize: 11, fontWeight: "900" }, useButton: { flex: 1.3, minHeight: 50, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, primaryButton: { minHeight: 50, minWidth: 210, marginTop: 20, borderRadius: 12, alignItems: "center", justifyContent: "center" }, primaryButtonText: { color: "#07101F", fontSize: 11, fontWeight: "900", letterSpacing: 0.4 }, arrow: { color: "#07101F", fontSize: 18, fontWeight: "900" }, missingScreen: { flex: 1, paddingHorizontal: 24, alignItems: "center", justifyContent: "center" }, missingTitle: { marginTop: 14, fontSize: 20, fontWeight: "900" }, missingBody: { marginTop: 7, fontSize: 12, textAlign: "center" } });
