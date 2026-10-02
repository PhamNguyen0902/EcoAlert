import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions, type FlashMode } from "expo-camera";
import { useIsFocused } from "@react-navigation/native";
import {
  Camera,
  Flashlight,
  FlashlightOff,
  MapPin,
  ShieldAlert,
  X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ReportFlowParamList } from "../../../navigation/types";
import { useReportTheme } from "../useReportTheme";
import { LinearGradient } from "expo-linear-gradient";
import { formatCaptureTimestamp } from "../../../utils/watermark";
import { persistOriginalFieldImage } from "../../../utils/watermark";
import { normalizeFieldCaptureImage } from "../../../utils/fieldCaptureImage";
import { useFieldReport } from "../FieldReportContext";
import { MAX_FIELD_GPS_ACCURACY_METERS } from "../types";

type Props = NativeStackScreenProps<ReportFlowParamList, "ReportCamera">;
const MAX_LOCATION_AGE_MS = 5 * 60_000;

export const ReportCameraScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useReportTheme();
  const { draft, setDraft } = useFieldReport();
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<FlashMode>("off");
  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const shutterScale = useRef(new Animated.Value(1)).current;
  const pressShutter = (pressed: boolean) =>
    Animated.timing(shutterScale, {
      toValue: pressed ? 0.94 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  const isFocused = useIsFocused();
  const location = draft.location;
  const locationAge = location
    ? Date.now() - Date.parse(location.capturedAt)
    : Number.POSITIVE_INFINITY;
  const locationReady = Boolean(
    location &&
    location.accuracyMeters <= MAX_FIELD_GPS_ACCURACY_METERS &&
    locationAge <= MAX_LOCATION_AGE_MS,
  );
  const currentTime = useMemo(() => formatCaptureTimestamp(new Date()), []);

  useEffect(() => {
    if (permission === null) void requestPermission();
  }, [permission, requestPermission]);

  const returnToGps = () => {
    if (locationAge > MAX_LOCATION_AGE_MS)
      setDraft((current) => ({ ...current, location: undefined }));
    navigation.navigate("ReportLocation");
  };

  const takePicture = async () => {
    if (!cameraRef.current || capturing || !cameraReady || !locationReady)
      return;
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
      navigation.navigate("ReportPhotoReview");
    } catch {
      setCaptureError(
        "Không thể chụp ảnh. Vui lòng kiểm tra Camera và thử lại.",
      );
    } finally {
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
    <View style={styles.container}>
      {isFocused ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          flash={flash}
          mode="picture"
          responsiveOrientationWhenOrientationLocked
          onCameraReady={() => setCameraReady(true)}
          onMountError={() => {
            setCameraReady(false);
            setCaptureError("Camera không khả dụng trên thiết bị này.");
          }}
        />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(7,16,31,0.75)", "transparent"]}
        style={styles.topGradient}
      />
      <View style={[styles.topOverlay, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          onPress={navigation.goBack}
          style={styles.roundControl}
          accessibilityRole="button"
          accessibilityLabel="Đóng Camera"
        >
          <X size={23} color="#F8FAFC" />
        </TouchableOpacity>
        <View style={styles.liveChip}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE CAM</Text>
        </View>
        <TouchableOpacity
          onPress={() =>
            setFlash((current) => (current === "off" ? "on" : "off"))
          }
          style={styles.roundControl}
          accessibilityRole="button"
          accessibilityLabel={
            flash === "off" ? "Bật đèn flash" : "Tắt đèn flash"
          }
        >
          {flash === "off" ? (
            <FlashlightOff size={21} color="#F8FAFC" />
          ) : (
            <Flashlight size={21} color="#22C55E" />
          )}
        </TouchableOpacity>
      </View>
      <View pointerEvents="none" style={styles.guide}>
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />
        <View style={styles.guideTextBox}>
          <Text style={styles.guideTitle}>Đưa điểm rác vào khung</Text>
        </View>
      </View>
      <View
        style={[
          styles.bottomOverlay,
          { paddingBottom: Math.max(insets.bottom, 12) + 8 },
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={["transparent", "rgba(7,16,31,0.94)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.instruction}>
          <Text style={styles.instructionText}>
            Chụp rõ điểm rác và bối cảnh xung quanh
          </Text>
        </View>
        <View style={styles.locationOverlay}>
          <MapPin size={17} color="#22C55E" />
          <View style={styles.locationCopy}>
            <Text style={styles.address} numberOfLines={2}>
              {location?.address}
            </Text>
            <Text style={styles.locationMeta}>
              GPS ±{Math.round(location?.accuracyMeters ?? 0)}m · {currentTime}
            </Text>
          </View>
        </View>
        {captureError ? (
          <Text style={styles.captureError}>{captureError}</Text>
        ) : null}
        <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
          <TouchableOpacity
            onPress={() => void takePicture()}
            onPressIn={() => pressShutter(true)}
            onPressOut={() => pressShutter(false)}
            disabled={capturing || !cameraReady}
            style={[styles.shutterOuter, { opacity: cameraReady ? 1 : 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel="Chụp ảnh hiện trường"
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
        <View style={styles.requirement}>
          <ShieldAlert size={13} color="#F59E0B" />
          <Text style={styles.requirementText}>
            ẢNH CHỤP TRỰC TIẾP · KHÔNG DÙNG ẢNH THƯ VIỆN
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07101F" },
  permissionScreen: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  permissionBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  permissionLoading: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  permissionButton: {
    minHeight: 52,
    minWidth: 210,
    marginTop: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  permissionButtonText: {
    color: "#07101F",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  settingsButton: {
    minHeight: 48,
    minWidth: 210,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsText: { fontSize: 13, fontWeight: "700" },
  cancelButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
    marginTop: 8,
  },
  cancelText: { fontSize: 13, fontWeight: "600" },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 160 },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roundControl: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(7,16,31,0.60)",
    alignItems: "center",
    justifyContent: "center",
  },
  liveChip: {
    minHeight: 32,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(7,16,31,0.60)",
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E" },
  liveText: {
    color: "#F8FAFC",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  guide: {
    position: "absolute",
    left: 32,
    right: 32,
    top: "20%",
    bottom: "40%",
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
    bottom: 16,
    alignItems: "center",
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
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 32,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 12,
  },
  instruction: {
    borderRadius: 10,
    backgroundColor: "rgba(7,16,31,0.60)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  instructionText: {
    color: "#CBD5E1",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  locationOverlay: {
    alignSelf: "stretch",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    backgroundColor: "rgba(13,26,43,0.76)",
  },
  locationCopy: { flex: 1 },
  address: {
    color: "#F8FAFC",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  locationMeta: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 8,
  },
  captureError: {
    color: "#F87171",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  shutterOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(34,197,94,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterMiddle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: "#22C55E",
    backgroundColor: "#07101F",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },
  requirement: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  requirementText: {
    flexShrink: 1,
    color: "#94A3B8",
    fontSize: 9,
    lineHeight: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
