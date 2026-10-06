import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
} from "react-native";
import { CameraView, useCameraPermissions, type FlashMode } from "expo-camera";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, X, Flashlight } from "lucide-react-native";
import { normalizeFieldCaptureImage } from "../../utils/fieldCaptureImage";
import { persistOriginalFieldImage } from "../../utils/watermark";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { officerErrorMessage } from "../../utils/officerWorkflow";
import {
  acquireOfficerGps,
  type OfficerPhoto,
} from "../../utils/officerResolution";

export function OfficerResolutionCamera({
  onCapture,
  onClose,
}: {
  onCapture: (photo: OfficerPhoto) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useCivicTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const captureLock = useRef(false);
  const alive = useRef(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashMode>("off");
  const [frameWidth, setFrameWidth] = useState(0);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  useEffect(() => {
    alive.current = true;
    const listener = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      setReady(false);
    });
    return () => {
      alive.current = false;
      listener.remove();
    };
  }, []);
  const capture = async () => {
    if (!camera.current || !ready || captureLock.current) return;
    captureLock.current = true;
    setBusy(true);
    setError(null);
    try {
      const gps = await acquireOfficerGps({
        permission: async () =>
          (await Location.requestForegroundPermissionsAsync()).granted,
        position: async () => {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest,
          });
          return {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
            accuracyMeters: current.coords.accuracy,
          };
        },
      });
      if (!alive.current || AppState.currentState !== "active") return;
      const capturedAt = new Date().toISOString();
      const picture = await camera.current?.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (!picture?.uri)
        throw new Error("Camera chưa trả về ảnh. Vui lòng thử lại.");
      const normalized = await normalizeFieldCaptureImage(picture.uri);
      const originalLocalUri = await persistOriginalFieldImage(
        normalized.uri,
        capturedAt,
      );
      if (alive.current)
        onCapture({ originalLocalUri, capturedAt, location: gps });
    } catch (failure: unknown) {
      const localMessage =
        failure instanceof Error &&
        /^(Cần quyền GPS|GPS chưa|Camera chưa)/.test(failure.message)
          ? failure.message
          : undefined;
      if (alive.current)
        setError(
          localMessage ||
            officerErrorMessage(
              failure,
              "Không thể chụp ảnh hoặc lấy GPS. Vui lòng thử lại.",
            ),
        );
    } finally {
      captureLock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: Math.max(16, insets.bottom),
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng camera"
          disabled={busy}
          style={styles.control}
          onPress={onClose}
        >
          <X size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.primary }]}>
          LIVE CAM · SAU XỬ LÝ
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đổi chế độ flash"
          style={styles.control}
          onPress={() => setFlash(flash === "off" ? "on" : "off")}
        >
          <Flashlight
            size={22}
            color={flash === "on" ? colors.primary : colors.textMuted}
          />
        </Pressable>
      </View>
      {!permission?.granted ? (
        <View style={styles.permission}>
          <Text style={[styles.message, { color: colors.text }]}>
            Cần quyền Camera để chụp ảnh sau xử lý.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={[
              styles.permissionButton,
              { backgroundColor: colors.primary },
            ]}
            onPress={() =>
              permission?.canAskAgain === false
                ? void Linking.openSettings()
                : void requestPermission()
            }
          >
            <Text style={styles.buttonText}>
              {permission?.canAskAgain === false
                ? "MỞ CÀI ĐẶT"
                : "CHO PHÉP CAMERA"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View
          style={styles.previewArea}
          onLayout={({ nativeEvent: { layout } }) =>
            setFrameWidth(
              Math.max(
                0,
                Math.min(layout.width - 32, ((layout.height - 16) * 3) / 4),
              ),
            )
          }
        >
          <View style={[styles.frame, { width: frameWidth }]}>
            {foreground && frameWidth > 0 ? (
              <CameraView
                ref={camera}
                style={StyleSheet.absoluteFill}
                facing="back"
                mode="picture"
                flash={flash}
                responsiveOrientationWhenOrientationLocked
                onCameraReady={() => setReady(true)}
                onMountError={() => {
                  setReady(false);
                  setError("Camera không khả dụng. Hãy đóng và mở lại.");
                }}
              />
            ) : null}
          </View>
        </View>
      )}
      <View style={styles.footer}>
        <Text style={[styles.message, { color: colors.text }]}>
          Chụp rõ khu vực sau xử lý
        </Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Ảnh chụp trực tiếp · GPS mới tại thời điểm chụp
        </Text>
        {error ? (
          <Text
            accessibilityRole="alert"
            style={[styles.message, { color: colors.danger }]}
          >
            {error}
          </Text>
        ) : null}
        {busy ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.hint, { color: colors.cyan }]}
          >
            Đang lấy GPS và chụp ảnh...
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chụp ảnh sau xử lý"
          disabled={!ready || busy || !permission?.granted}
          onPress={() => void capture()}
          style={[
            styles.shutter,
            { borderColor: colors.primary, opacity: ready && !busy ? 1 : 0.5 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Camera size={32} color={colors.primary} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  title: { fontSize: 12, fontWeight: "800" },
  control: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  previewArea: { flex: 1, justifyContent: "center", alignItems: "center" },
  frame: {
    aspectRatio: 3 / 4,
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#050D17",
  },
  footer: { padding: 16, alignItems: "center", gap: 10 },
  message: { fontSize: 13, lineHeight: 20, textAlign: "center" },
  hint: { fontSize: 11, lineHeight: 17, textAlign: "center" },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  permission: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 20,
  },
  permissionButton: { padding: 16, borderRadius: 12 },
  buttonText: { color: "#07101F", fontWeight: "800" },
});
