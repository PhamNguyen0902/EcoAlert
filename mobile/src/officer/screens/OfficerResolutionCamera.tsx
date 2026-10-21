import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions, type FlashMode } from "expo-camera";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, Eye, EyeOff, Flashlight, X } from "lucide-react-native";
import { normalizeFieldCaptureImage } from "../../shared/utils/fieldCaptureImage";
import { persistOriginalFieldImage } from "../../shared/utils/watermark";
import { useCivicTheme } from "../../shared/theme/useCivicTheme";
import { OfficerStepProgressBar } from "../components/OfficerUI";
import { officerErrorMessage } from "../utils/officerWorkflow";
import {
  acquireOfficerGps,
  type OfficerPhoto,
} from "../utils/officerResolution";

// Màn hình Camera chụp ảnh kết quả sau xử lý kèm hỗ trợ căn chuẩn góc chụp (Ghost Overlay / Thumbnail tham chiếu)
export function OfficerResolutionCamera({
  onCapture,
  onClose,
  beforeImageUri,
  referenceImageUri,
}: {
  onCapture: (photo: OfficerPhoto) => void;
  onClose: () => void;
  beforeImageUri?: string;
  referenceImageUri?: string;
}) {
  const initialReferenceUri = beforeImageUri || referenceImageUri;
  const [showGhost, setShowGhost] = useState(Boolean(initialReferenceUri));
  const ghostOpacity = 0.35; // Độ trong suốt chuẩn 0.35 giúp soi góc chụp gốc
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

  // Tự động lấy tọa độ GPS hiện tại ngay khi bấm chụp và gắn vào ảnh kết quả (After photo)
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
        onCapture({
          originalLocalUri,
          capturedAt,
          location: gps,
          width: normalized.width,
          height: normalized.height,
          usedGhostOverlay: Boolean(initialReferenceUri && showGhost),
        });
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
              "Không thể chụp ảnh hoặc lấy vị trí GPS. Vui lòng thử lại.",
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
          CHỤP ẢNH KẾT QUẢ (SAU XỬ LÝ)
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {initialReferenceUri ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Soi góc chụp gốc"
              style={[styles.toolButton, showGhost && styles.toolButtonActive]}
              onPress={() => setShowGhost((prev) => !prev)}
            >
              {showGhost ? (
                <Eye size={17} color="#22C55E" />
              ) : (
                <EyeOff size={17} color="#94A3B8" />
              )}
              <Text style={styles.toolButtonText}>
                {showGhost ? "Soi góc chụp gốc: Bật" : "Soi góc chụp gốc: Tắt"}
              </Text>
            </Pressable>
          ) : null}
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
      </View>
      <OfficerStepProgressBar step={3} />
      {!permission?.granted ? (
        <View style={styles.permission}>
          <Text style={[styles.message, { color: colors.text }]}>
            Cần cấp quyền Camera để chụp ảnh kết quả sau xử lý.
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

            {/* Khi bật Soi góc chụp gốc (Ghost Overlay): phủ ảnh ban đầu với opacity: 0.35 và pointerEvents="none" */}
            {initialReferenceUri && showGhost ? (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Image
                  source={{ uri: initialReferenceUri }}
                  style={[StyleSheet.absoluteFill, { opacity: ghostOpacity }]}
                  resizeMode="cover"
                />
                <View style={styles.ghostBadge}>
                  <Text style={styles.ghostBadgeText}>
                    Soi góc chụp gốc (Căn khớp vị trí & góc nhìn ban đầu)
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Khi tắt Ghost Overlay: hiển thị ảnh gốc dạng khung nhỏ (Thumbnail) ở góc trên màn hình kèm chỉ dẫn */}
            {initialReferenceUri && !showGhost ? (
              <View style={styles.thumbnailGuideOverlay} pointerEvents="none">
                <Image
                  source={{ uri: initialReferenceUri }}
                  style={styles.referenceThumbnail}
                  resizeMode="cover"
                />
                <View style={styles.thumbnailTextWrap}>
                  <Text style={styles.thumbnailTitle}>Ảnh sự cố ban đầu</Text>
                  <Text style={styles.thumbnailInstruction}>
                    Căn chỉnh góc chụp tương đồng với ảnh sự cố ban đầu
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      )}
      <View style={styles.footer}>
        <Text style={[styles.message, { color: colors.text }]}>
          Căn chỉnh góc chụp tương đồng với ảnh sự cố ban đầu
        </Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Ảnh chụp trực tiếp từ Camera · Tự động đính kèm tọa độ GPS hiện tại
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
            Đang lấy tọa độ GPS và chụp ảnh kết quả...
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
  ghostBadge: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#22C55E",
  },
  ghostBadgeText: {
    color: "#22C55E",
    fontSize: 11,
    fontWeight: "700",
  },
  thumbnailGuideOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(7, 16, 31, 0.85)",
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#38BDF8",
  },
  referenceThumbnail: {
    width: 58,
    height: 76,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#22C55E",
  },
  thumbnailTextWrap: {
    flex: 1,
    gap: 3,
  },
  thumbnailTitle: {
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "800",
  },
  thumbnailInstruction: {
    color: "#F8FAFC",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  toolButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  toolButtonActive: {
    borderColor: "#22C55E",
    borderWidth: 1,
  },
  toolButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
});
