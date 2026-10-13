import {
  civicSpace as space,
  civicRadius as radius,
} from "../../../theme/civicDesign";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Animated,
  ScrollView,
  useWindowDimensions,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions, type FlashMode } from "expo-camera";
import {
  Camera,
  Flashlight,
  FlashlightOff,
  ShieldAlert,
  ZoomIn,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ReportFlowParamList } from "../../../navigation/types";
import { useReportTheme } from "../useReportTheme";
import { persistOriginalFieldImage } from "../../../utils/watermark";
import { normalizeFieldCaptureImage } from "../../../utils/fieldCaptureImage";
import { useFieldReport } from "../FieldReportContext";
import { MAX_FIELD_GPS_ACCURACY_METERS } from "../types";
import {
  useForegroundScreen,
  useScreenClock,
} from "../../../hooks/useForegroundScreen";
import { ReportHeader } from "../components/ReportHeader";
import { ReportProgress } from "../components/ReportProgress";
import {
  FieldLiveEvidenceMetaOverlay,
  useFieldReducedMotion,
} from "../components/stitch/FieldUI";
import { fieldLocationReady } from "../components/stitch/fieldPresentation";

type Props = NativeStackScreenProps<ReportFlowParamList, "ReportCamera">;
const MAX_LOCATION_AGE_MS = 5 * 60_000;
// màn hình bước hai chụp ảnh trực tiếp tại hiện trường bằng camera
export const ReportCameraScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const previewWidth = Math.min(width - 32, 440);
  const { colors } = useReportTheme();
  const { draft, setDraft } = useFieldReport();
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<FlashMode>("off");
  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [zoom, setZoom] = useState(0);
  const isActive = useForegroundScreen();
  // Freshness UI needs a coarse clock; the HUD owns its one-second clock.
  const now = useScreenClock(15000, isActive);
  const activeRef = useRef(isActive);
  const activityEpoch = useRef(0);
  activeRef.current = isActive;
  const captureLock = useRef(false);
  const reducedMotion = useFieldReducedMotion();
  const [captureError, setCaptureError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const shutterScale = useRef(new Animated.Value(1)).current;
  // hiệu ứng hoạt họa thu nhỏ nút chụp khi người dùng bấm
  const pressShutter = (pressed: boolean) =>
    Animated.timing(shutterScale, {
      toValue: pressed ? 0.94 : 1,
      duration: reducedMotion ? 0 : 120,
      useNativeDriver: true,
    }).start();
  const location = draft.location;
  const locationAge = location
    ? now - Date.parse(location.capturedAt)
    : Number.POSITIVE_INFINITY;
  const locationReady = fieldLocationReady(location, now);
  useEffect(() => {
    activeRef.current = isActive;
    if (!isActive) {
      setCameraReady(false);
      shutterScale.stopAnimation();
      shutterScale.setValue(1);
    }
    return () => {
      activityEpoch.current += 1;
      activeRef.current = false;
      shutterScale.stopAnimation();
    };
  }, [isActive, shutterScale]);
  useEffect(() => {
    if (permission === null) void requestPermission();
  }, [permission, requestPermission]);
  // quay lại màn hình xác minh vị trí khi dữ liệu gps đã quá hạn thời gian
  const returnToGps = () => {
    if (locationAge > MAX_LOCATION_AGE_MS)
      setDraft((current) => ({ ...current, location: undefined }));
    navigation.navigate("ReportLocation");
  };
  // chụp ảnh trực tiếp từ camera, chuẩn hóa kích thước và lưu trữ ảnh gốc vào bộ nhớ an toàn
  const takePicture = async () => {
    if (
      !cameraRef.current ||
      captureLock.current ||
      capturing ||
      !cameraReady ||
      !locationReady ||
      !activeRef.current ||
      AppState.currentState !== "active"
    )
      return;
    if (!fieldLocationReady(location, Date.now())) {
      returnToGps();
      return;
    }
    captureLock.current = true;
    const epoch = activityEpoch.current;
    setCapturing(true);
    setCaptureError(null);
    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (!picture?.uri) throw new Error("Camera did not return an image");
      const capturedAt = new Date().toISOString();
      const normalized = await normalizeFieldCaptureImage(picture.uri);
      const originalLocalUri = await persistOriginalFieldImage(
        normalized.uri,
        capturedAt,
      );
      // A finished native capture must not reopen this flow after leaving it.
      if (
        !activeRef.current ||
        epoch !== activityEpoch.current ||
        AppState.currentState !== "active"
      ) return;
      setDraft((current) => ({
        ...current,
        capture: {
          originalLocalUri,
          capturedAt,
          width: normalized.width,
          height: normalized.height,
        },
        imageValidation: { state: "IDLE", detectedObjects: [] },
      }));
      // chuyển sang màn hình xem lại và đóng dấu ảnh
      navigation.navigate("ReportPhotoReview");
    } catch {
      if (
        activeRef.current &&
        epoch === activityEpoch.current &&
        AppState.currentState === "active"
      ) {
        setCaptureError(
          "Không thể chụp ảnh. Vui lòng kiểm tra Camera và thử lại.",
        );
      }
    } finally {
      captureLock.current = false;
      setCapturing(false);
    }
  };

  if (!locationReady)
    return (
      <View
        style={[
          styles.permissionScreen,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <ShieldAlert size={38} color={colors.accent} />
        <Text style={[styles.permissionTitle, { color: colors.text }]}>
          Cần làm mới vị trí GPS
        </Text>
        <Text style={[styles.permissionBody, { color: colors.textMuted }]}>
          Vị trí phải chính xác trong ±{MAX_FIELD_GPS_ACCURACY_METERS}m và được
          lấy trong vòng 5 phút trước khi chụp.
        </Text>
        <TouchableOpacity
          onPress={returnToGps}
          style={[styles.permissionButton, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
        >
          <Text style={styles.permissionButtonText}>QUAY LẠI LẤY GPS</Text>
        </TouchableOpacity>
      </View>
    );

  if (!permission)
    return (
      <View
        style={[
          styles.permissionScreen,
          { backgroundColor: colors.background },
        ]}
      >
        <Camera size={40} color={colors.primary} />
        <Text style={[styles.permissionTitle, { color: colors.text }]}>
          Chuẩn bị Camera
        </Text>
        <View style={styles.permissionLoading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.permissionBody, { color: colors.textMuted }]}>
            Đang kiểm tra quyền truy cập…
          </Text>
        </View>
      </View>
    );
  if (!permission.granted)
    return (
      <View
        style={[
          styles.permissionScreen,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <Camera size={40} color={colors.primary} />
        <Text style={[styles.permissionTitle, { color: colors.text }]}>
          Cần quyền Camera
        </Text>
        <Text style={[styles.permissionBody, { color: colors.textMuted }]}>
          EcoAlert cần quyền Camera để chụp ảnh hiện trường. Ảnh thư viện không
          được sử dụng trong luồng này.
        </Text>
        <TouchableOpacity
          onPress={() => void requestPermission()}
          style={[styles.permissionButton, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
        >
          <Text style={styles.permissionButtonText}>THỬ LẠI</Text>
        </TouchableOpacity>
        {permission.canAskAgain === false ? (
          <TouchableOpacity
            onPress={() => void Linking.openSettings()}
            style={[styles.settingsButton, { borderColor: colors.border }]}
            accessibilityRole="button"
          >
            <Text style={[styles.settingsText, { color: colors.text }]}>
              MỞ CÀI ĐẶT
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={navigation.goBack}
          style={styles.cancelButton}
          accessibilityRole="button"
        >
          <Text style={[styles.cancelText, { color: colors.textMuted }]}>
            Quay lại
          </Text>
        </TouchableOpacity>
      </View>
    );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ReportHeader title="Chụp ảnh hiện trường" onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={styles.captureContent}
        showsVerticalScrollIndicator={false}
      >
        <ReportProgress step={2} status="THẨM ĐỊNH THỰC ĐỊA" />
        <View style={styles.stageRow}>
          <Text style={styles.stageText}>CHỤP BAO QUÁT ĐIỂM RÁC</Text>
          <View style={styles.liveChip}>
            <View
              style={[
                styles.liveDot,
                !cameraReady && { backgroundColor: "#94A3B8" },
              ]}
            />
            <Text style={styles.liveText}>
              {cameraReady ? "LIVE SENSOR" : "ĐANG CHUẨN BỊ"}
            </Text>
          </View>
        </View>
        <View style={styles.previewArea}>
          <View style={[styles.previewFrame, { width: previewWidth }]}>
            {isActive && previewWidth > 0 ? (
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                flash={flash}
                zoom={zoom}
                ratio="4:3"
                mode="picture"
                responsiveOrientationWhenOrientationLocked
                onCameraReady={() => {
                  if (activeRef.current) setCameraReady(true);
                }}
                onMountError={() => {
                  if (!activeRef.current) return;
                  setCameraReady(false);
                  setCaptureError("Camera không khả dụng trên thiết bị này.");
                }}
              />
            ) : null}
            <View pointerEvents="none" style={styles.guide}>
              <View style={[styles.thirdVertical, { left: "33.33%" }]} />
              <View style={[styles.thirdVertical, { left: "66.66%" }]} />
              <View style={[styles.thirdHorizontal, { top: "33.33%" }]} />
              <View style={[styles.thirdHorizontal, { top: "66.66%" }]} />
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              <View style={styles.guideTextBox}>
                <Text style={styles.guideTitle}>
                  Giữ máy ổn định & chụp bao quát hiện trường
                </Text>
              </View>
            </View>
            <FieldLiveEvidenceMetaOverlay
              location={location}
              active={isActive}
            />
            {capturing ? (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: "rgba(255,255,255,0.18)" },
                ]}
              />
            ) : null}
          </View>
        </View>
        {captureError ? (
          <Text style={styles.captureError} accessibilityRole="alert">
            {captureError}
          </Text>
        ) : null}
      </ScrollView>
      <View
        style={[
          styles.bottomOverlay,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <View style={styles.controlPanel}>
          <TouchableOpacity
            onPress={() =>
              setFlash((current) =>
                current === "off" ? "auto" : current === "auto" ? "on" : "off",
              )
            }
            disabled={capturing}
            style={styles.controlWithLabel}
            accessibilityRole="button"
            accessibilityLabel={`Đèn flash: ${flash}. Chạm để đổi chế độ`}
          >
            {flash === "off" ? (
              <FlashlightOff size={22} color="#94A3B8" />
            ) : (
              <Flashlight size={22} color="#F59E0B" />
            )}
            <Text style={styles.controlText}>{flash.toUpperCase()}</Text>
          </TouchableOpacity>
          <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
            <TouchableOpacity
              onPress={() => void takePicture()}
              onPressIn={() => pressShutter(true)}
              onPressOut={() => pressShutter(false)}
              disabled={capturing || !cameraReady}
              style={[styles.shutterOuter, { opacity: cameraReady ? 1 : 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel="Chụp ảnh hiện trường"
              accessibilityState={{
                disabled: capturing || !cameraReady,
                busy: capturing,
              }}
            >
              <View style={styles.shutterMiddle}>
                <View style={styles.shutterInner}>
                  {capturing || !cameraReady ? (
                    <ActivityIndicator color="#07101F" />
                  ) : (
                    <Camera size={27} color="#07101F" />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity
            onPress={() =>
              setZoom((current) => (current >= 0.2 ? 0 : current + 0.1))
            }
            disabled={capturing}
            style={styles.controlWithLabel}
            accessibilityRole="button"
            accessibilityLabel={`Thu phóng camera ${Math.round(zoom * 100)} phần trăm. Chạm để đổi`}
          >
            <ZoomIn size={22} color="#22C55E" />
            <Text style={styles.controlText}>
              {zoom ? `${Math.round(zoom * 100)}%` : "ZOOM"}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.requirement}>
          <ShieldAlert size={13} color="#F59E0B" />
          <Text style={styles.requirementText}>
            Chụp trực tiếp từ camera • Không chấp nhận ảnh từ thư viện
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07101F" },
  captureContent: { padding: 16, gap: 12, paddingBottom: 12 },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  stageText: {
    fontSize: 9,
    lineHeight: 14,
    color: "#38BDF8",
    fontWeight: "700",
  },
  controlPanel: {
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#101D31",
    padding: 8,
    borderRadius: 16,
  },
  controlWithLabel: {
    minWidth: 56,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  controlText: { color: "#CBD5E1", fontSize: 10, fontWeight: "700" },
  thirdVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  thirdHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  permissionScreen: {
    flex: 1,
    paddingHorizontal: space.section,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionTitle: {
    marginTop: space.lg,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    textAlign: "center",
  },
  permissionBody: {
    marginTop: space.sm,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  permissionLoading: {
    marginTop: space.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  permissionButton: {
    minHeight: 52,
    minWidth: 210,
    marginTop: space.section,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
  },
  permissionButtonText: {
    color: "#07101F",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  settingsButton: {
    minHeight: 48,
    minWidth: 210,
    marginTop: space.md,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsText: { fontSize: 13, fontWeight: "700" },
  cancelButton: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    justifyContent: "center",
    marginTop: space.sm,
  },
  cancelText: { fontSize: 13, fontWeight: "600" },
  liveChip: {
    minHeight: 32,
    borderRadius: 8,
    paddingHorizontal: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: "rgba(7,16,31,0.60)",
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E" },
  liveText: {
    color: "#F8FAFC",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  previewArea: {
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  previewFrame: {
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#050D17",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.3)",
  },
  guide: {
    position: "absolute",
    top: 12,
    bottom: 12,
    left: 12,
    right: 12,
  },
  corner: {
    position: "absolute",
    width: 32,
    height: 32,
    borderColor: "#22C55E",
    opacity: 0.85,
  },
  topLeft: { left: 0, top: 0, borderLeftWidth: 2, borderTopWidth: 2 },
  topRight: { right: 0, top: 0, borderRightWidth: 2, borderTopWidth: 2 },
  bottomLeft: { left: 0, bottom: 0, borderLeftWidth: 2, borderBottomWidth: 2 },
  bottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: 2,
    borderBottomWidth: 2,
  },
  guideTextBox: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 8,
    alignItems: "center",
    backgroundColor: "rgba(7,16,31,0.78)",
    borderRadius: 8,
    padding: 8,
  },
  guideTitle: {
    color: "#F8FAFC",
    fontSize: 11,
    fontWeight: "600",
    textShadowColor: "rgba(7,16,31,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomOverlay: {
    paddingTop: space.sm,
    paddingHorizontal: space.lg,
    alignItems: "center",
    gap: space.md,
  },
  captureError: {
    color: "#F87171",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  shutterOuter: {
    width: 84,
    height: 84,
    borderRadius: radius.round,
    backgroundColor: "rgba(34,197,94,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterMiddle: {
    width: 70,
    height: 70,
    borderRadius: radius.round,
    borderWidth: 2,
    borderColor: "#22C55E",
    backgroundColor: "#07101F",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: radius.round,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  requirement: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
  },
  requirementText: {
    flexShrink: 1,
    color: "#94A3B8",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
