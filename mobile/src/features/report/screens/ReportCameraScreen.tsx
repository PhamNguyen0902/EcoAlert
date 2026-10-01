import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CameraView, useCameraPermissions, type FlashMode } from "expo-camera";
import { useIsFocused } from "@react-navigation/native";
import { Camera, Flashlight, FlashlightOff, MapPin, ShieldAlert, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ReportFlowParamList } from "../../../navigation/types";
import { useTheme } from "../../../context/ThemeContext";
import { formatCaptureTimestamp } from "../../../utils/watermark";
import { persistOriginalFieldImage } from "../../../utils/watermark";
import { useFieldReport } from "../FieldReportContext";
import { MAX_FIELD_GPS_ACCURACY_METERS } from "../types";

type Props = NativeStackScreenProps<ReportFlowParamList, "ReportCamera">;
const MAX_LOCATION_AGE_MS = 5 * 60_000;

export const ReportCameraScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { draft, setDraft } = useFieldReport();
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<FlashMode>("off");
  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const isFocused = useIsFocused();
  const location = draft.location;
  const locationAge = location ? Date.now() - Date.parse(location.capturedAt) : Number.POSITIVE_INFINITY;
  const locationReady = Boolean(location && location.accuracyMeters <= MAX_FIELD_GPS_ACCURACY_METERS && locationAge <= MAX_LOCATION_AGE_MS);
  const currentTime = useMemo(() => formatCaptureTimestamp(new Date()), []);

  useEffect(() => {
    if (permission === null) void requestPermission();
  }, [permission, requestPermission]);

  const returnToGps = () => {
    if (locationAge > MAX_LOCATION_AGE_MS) setDraft((current) => ({ ...current, location: undefined }));
    navigation.navigate("ReportLocation");
  };

  const takePicture = async () => {
    if (!cameraRef.current || capturing || !cameraReady || !locationReady) return;
    setCapturing(true);
    setCaptureError(null);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
      if (!picture?.uri) throw new Error("Camera did not return an image");
      const capturedAt = new Date().toISOString();
      const originalLocalUri = await persistOriginalFieldImage(picture.uri, capturedAt);
      setDraft((current) => ({
        ...current,
        capture: { originalLocalUri, capturedAt, width: picture.width, height: picture.height },
        imageValidation: { state: "IDLE", detectedObjects: [] },
      }));
      navigation.navigate("ReportPhotoReview");
    } catch {
      setCaptureError("Không thể chụp ảnh. Vui lòng kiểm tra Camera và thử lại.");
    } finally {
      setCapturing(false);
    }
  };

  if (!locationReady) return <View style={[styles.permissionScreen, { backgroundColor: colors.background, paddingTop: insets.top }]}><ShieldAlert size={38} color={colors.accent} /><Text style={[styles.permissionTitle, { color: colors.text }]}>Cần làm mới vị trí GPS</Text><Text style={[styles.permissionBody, { color: colors.textMuted }]}>Vị trí phải chính xác trong ±{MAX_FIELD_GPS_ACCURACY_METERS}m và được lấy trong vòng 5 phút trước khi chụp.</Text><TouchableOpacity onPress={returnToGps} style={[styles.permissionButton, { backgroundColor: colors.primary }]} accessibilityRole="button"><Text style={styles.permissionButtonText}>QUAY LẠI LẤY GPS</Text></TouchableOpacity></View>;

  if (!permission) return <View style={[styles.permissionScreen, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  if (!permission.granted) return <View style={[styles.permissionScreen, { backgroundColor: colors.background, paddingTop: insets.top }]}><Camera size={40} color={colors.primary} /><Text style={[styles.permissionTitle, { color: colors.text }]}>Cần quyền Camera</Text><Text style={[styles.permissionBody, { color: colors.textMuted }]}>EcoAlert cần quyền Camera để chụp ảnh hiện trường. Ảnh thư viện không được sử dụng trong luồng này.</Text><TouchableOpacity onPress={() => void requestPermission()} style={[styles.permissionButton, { backgroundColor: colors.primary }]} accessibilityRole="button"><Text style={styles.permissionButtonText}>THỬ LẠI</Text></TouchableOpacity>{permission.canAskAgain === false ? <TouchableOpacity onPress={() => void Linking.openSettings()} style={[styles.settingsButton, { borderColor: colors.border }]} accessibilityRole="button"><Text style={[styles.settingsText, { color: colors.text }]}>MỞ CÀI ĐẶT</Text></TouchableOpacity> : null}<TouchableOpacity onPress={navigation.goBack} style={styles.cancelButton} accessibilityRole="button"><Text style={[styles.cancelText, { color: colors.textMuted }]}>Quay lại</Text></TouchableOpacity></View>;

  return <View style={styles.container}>
    {isFocused ? <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" flash={flash} mode="picture" onCameraReady={() => setCameraReady(true)} onMountError={() => { setCameraReady(false); setCaptureError("Camera không khả dụng trên thiết bị này."); }} /> : null}
    <View style={[styles.topOverlay, { paddingTop: insets.top + 6 }]}><TouchableOpacity onPress={navigation.goBack} style={styles.roundControl} accessibilityRole="button" accessibilityLabel="Đóng Camera"><X size={23} color="#F8FAFC" /></TouchableOpacity><View style={styles.liveChip}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE CAM</Text></View><TouchableOpacity onPress={() => setFlash((current) => current === "off" ? "on" : "off")} style={styles.roundControl} accessibilityRole="button" accessibilityLabel={flash === "off" ? "Bật đèn flash" : "Tắt đèn flash"}>{flash === "off" ? <FlashlightOff size={21} color="#F8FAFC" /> : <Flashlight size={21} color="#22C55E" />}</TouchableOpacity></View>
    <View pointerEvents="none" style={styles.guide}><View style={[styles.corner, styles.topLeft]} /><View style={[styles.corner, styles.topRight]} /><View style={[styles.corner, styles.bottomLeft]} /><View style={[styles.corner, styles.bottomRight]} /><View style={styles.guideTextBox}><Text style={styles.guideTitle}>Chụp rõ toàn bộ điểm rác</Text><Text style={styles.guideBody}>Bao gồm rác thải và bối cảnh xung quanh</Text></View></View>
    <View style={[styles.bottomOverlay, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}><View style={styles.locationOverlay}><MapPin size={17} color="#22C55E" /><View style={styles.locationCopy}><Text style={styles.address} numberOfLines={2}>{location?.address}</Text><Text style={styles.locationMeta}>GPS ±{Math.round(location?.accuracyMeters ?? 0)}m · {currentTime}</Text></View></View>{captureError ? <Text style={styles.captureError}>{captureError}</Text> : null}<TouchableOpacity onPress={() => void takePicture()} disabled={capturing || !cameraReady} style={[styles.shutterOuter, { opacity: cameraReady ? 1 : 0.5 }]} accessibilityRole="button" accessibilityLabel="Chụp ảnh hiện trường"><View style={styles.shutterInner}>{capturing || !cameraReady ? <ActivityIndicator color="#07101F" /> : <Camera size={27} color="#07101F" />}</View></TouchableOpacity><View style={styles.requirement}><ShieldAlert size={13} color="#F59E0B" /><Text style={styles.requirementText}>YÊU CẦU ẢNH CHỤP TRỰC TIẾP · KHÔNG SỬ DỤNG ẢNH THƯ VIỆN</Text></View></View>
  </View>;
};

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: "#000" }, permissionScreen: { flex: 1, paddingHorizontal: 24, alignItems: "center", justifyContent: "center" }, permissionTitle: { marginTop: 16, fontSize: 20, fontWeight: "900", textAlign: "center" }, permissionBody: { marginTop: 8, fontSize: 13, lineHeight: 20, textAlign: "center" }, permissionButton: { minHeight: 50, minWidth: 210, marginTop: 22, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 }, permissionButtonText: { color: "#07101F", fontSize: 12, fontWeight: "900", letterSpacing: 0.5 }, settingsButton: { minHeight: 46, minWidth: 210, marginTop: 10, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" }, settingsText: { fontSize: 12, fontWeight: "900" }, cancelButton: { minHeight: 44, paddingHorizontal: 18, justifyContent: "center", marginTop: 6 }, cancelText: { fontSize: 12, fontWeight: "700" }, topOverlay: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, roundControl: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(7,16,31,0.72)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(248,250,252,0.18)" }, liveChip: { minHeight: 30, borderRadius: 15, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(7,16,31,0.76)", borderWidth: 1, borderColor: "rgba(34,197,94,0.35)" }, liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22C55E" }, liveText: { color: "#F8FAFC", fontSize: 9, fontWeight: "900", letterSpacing: 1 }, guide: { position: "absolute", left: 28, right: 28, top: "18%", bottom: "31%" }, corner: { position: "absolute", width: 42, height: 42, borderColor: "#22C55E" }, topLeft: { left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3 }, topRight: { right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3 }, bottomLeft: { left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3 }, bottomRight: { right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3 }, guideTextBox: { position: "absolute", left: 20, right: 20, bottom: 18, borderRadius: 11, backgroundColor: "rgba(7,16,31,0.72)", padding: 10, alignItems: "center" }, guideTitle: { color: "#F8FAFC", fontSize: 13, fontWeight: "900" }, guideBody: { color: "#CBD5E1", fontSize: 10, marginTop: 3 }, bottomOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, alignItems: "center", backgroundColor: "rgba(7,16,31,0.82)" }, locationOverlay: { alignSelf: "stretch", marginTop: 12, borderRadius: 13, padding: 11, flexDirection: "row", gap: 9, backgroundColor: "rgba(16,29,49,0.9)", borderWidth: 1, borderColor: "rgba(148,163,184,0.18)" }, locationCopy: { flex: 1 }, address: { color: "#F8FAFC", fontSize: 12, lineHeight: 17, fontWeight: "800" }, locationMeta: { color: "#94A3B8", fontSize: 10, fontWeight: "700", marginTop: 3 }, captureError: { color: "#FCA5A5", fontSize: 11, textAlign: "center", marginTop: 8 }, shutterOuter: { width: 82, height: 82, borderRadius: 41, borderWidth: 4, borderColor: "#22C55E", padding: 6, alignItems: "center", justifyContent: "center", marginVertical: 12 }, shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#22C55E", alignItems: "center", justifyContent: "center" }, requirement: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, requirementText: { flexShrink: 1, color: "#FBBF24", fontSize: 8, lineHeight: 12, fontWeight: "900", letterSpacing: 0.4, textAlign: "center" } });
