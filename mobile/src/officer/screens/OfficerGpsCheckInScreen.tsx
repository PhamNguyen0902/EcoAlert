import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert as RNAlert,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { usePreventRemove } from "@react-navigation/native";
import { CameraView, useCameraPermissions, type FlashMode } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Camera, CheckCircle2, Flashlight, Lock, MapPin, Play, ShieldAlert } from "lucide-react-native";
import {
  useAlert,
  useConfirmArrival,
  useStartHandling,
} from "../../shared/hooks/useAlerts";
import { useProfile } from "../../auth/hooks/useAuth";
import { useOfficerPosition } from "../hooks/useOfficerPosition";
import { useOfficerShiftGuard } from "../hooks/useOfficerShiftGuard";
import { useCivicTheme } from "../../shared/theme/useCivicTheme";
import {
  OfficerBadge,
  OfficerCard,
  OfficerHeader,
  OfficerStepProgressBar,
  officerStyles as s,
} from "../components/OfficerUI";
import { Button } from "../../shared/components/ui/Button";
import { EvidenceImageFrame } from "../../shared/components/media/EvidenceImageFrame";
import { getGeoJsonMapCoordinates } from "../../shared/utils/maps";
import { normalizeFieldCaptureImage } from "../../shared/utils/fieldCaptureImage";
import { persistOriginalFieldImage } from "../../shared/utils/watermark";
import {
  officerDate,
  officerDistance,
  ownsOfficerTask,
} from "../utils/officerPresentation";
import {
  isWasteOfficerTask,
  officerErrorMessage,
  officerStatus,
} from "../utils/officerWorkflow";
import type { OfficerStackParamList } from "../../app/navigation/types";

const MAX_CHECKIN_RADIUS_METERS = 100;
const MAX_CHECKIN_ACCURACY_METERS = 50;

// Bước 1: Check-in (Điểm danh tại hiện trường) bằng Camera trực tiếp + đối chiếu GPS tự động
export function OfficerGpsCheckInScreen({
  route,
  navigation,
}: NativeStackScreenProps<OfficerStackParamList, "OfficerGpsCheckIn">) {
  const { colors } = useCivicTheme();
  const insets = useSafeAreaInsets();
  const task = useAlert(route.params.id);
  const { data: profile } = useProfile();
  const gps = useOfficerPosition();
  const {
    isOnShift,
    isOperating: isShiftOperating,
    startShiftDirectly,
    assertOnShiftWithAlert,
  } = useOfficerShiftGuard();
  const startHandling = useStartHandling();
  const arrival = useConfirmArrival();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const lock = useRef(false);
  const alive = useRef(true);

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<FlashMode>("off");
  const [frameWidth, setFrameWidth] = useState(0);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [distanceErrorMeters, setDistanceErrorMeters] = useState<number | null>(
    null,
  );
  const [checkInSuccess, setCheckInSuccess] = useState(false);

  const isPending = busy || arrival.isPending || startHandling.isPending;

  usePreventRemove(isPending, () =>
    RNAlert.alert(
      "Đang xử lý Check-in",
      "Vui lòng chờ hệ thống xác nhận vị trí và ảnh hiện trường.",
    ),
  );

  useEffect(() => {
    alive.current = true;
    const sub = AppState.addEventListener("change", (nextState) => {
      setForeground(nextState === "active");
      setReady(false);
    });
    return () => {
      alive.current = false;
      sub.remove();
    };
  }, []);

  // Tự động lấy tọa độ GPS ngầm ngay khi mở màn hình Check-in
  useEffect(() => {
    void gps.refresh();
  }, []);

  const alertData = task.data;
  const mine = ownsOfficerTask(alertData, profile);
  const status = alertData ? officerStatus(alertData) : "";
  const allowed = Boolean(
    mine &&
      alertData &&
      isWasteOfficerTask(alertData) &&
      ["ASSIGNED", "IN_PROGRESS"].includes(status),
  );
  const verified = Boolean(
    (allowed && alertData?.checkIn?.verified === true) || checkInSuccess,
  );

  const destination = mine
    ? getGeoJsonMapCoordinates(alertData?.location?.coordinates)
    : null;
  const currentDistance =
    gps.position && destination
      ? officerDistance(gps.position, destination)
      : null;

  // Chụp ảnh trực tiếp từ camera + tự động lấy/đối chiếu GPS ngầm + gửi xác nhận Check-in
  const handleCaptureAndCheckIn = async () => {
    if (!allowed || verified || !camera.current || !ready || lock.current)
      return;

    if (!isOnShift) {
      assertOnShiftWithAlert(() => {
        void handleCaptureAndCheckIn();
      });
      return;
    }

    lock.current = true;
    setBusy(true);
    setError(null);
    setDistanceErrorMeters(null);

    try {
      const nowIso = new Date().toISOString();
      const picture = await camera.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (!picture?.uri) {
        throw new Error("Camera chưa trả về ảnh. Vui lòng chụp lại.");
      }

      const normalized = await normalizeFieldCaptureImage(picture.uri);
      const savedUri = await persistOriginalFieldImage(normalized.uri, nowIso);
      if (alive.current) {
        setCapturedPhotoUri(savedUri);
        setCapturedAt(nowIso);
      }

      // Tự động lấy GPS nếu chưa có hoặc cần làm mới
      const freshGps = gps.position || (await gps.refresh());
      if (!freshGps) {
        throw new Error(
          gps.error ||
            "Chưa xác định được tọa độ GPS hiện tại. Vui lòng bật định vị và đứng ở nơi thoáng.",
        );
      }

      // Kiểm tra độ chính xác GPS
      if (
        !Number.isFinite(freshGps.accuracyMeters) ||
        freshGps.accuracyMeters > MAX_CHECKIN_ACCURACY_METERS
      ) {
        throw new Error(
          `Độ chính xác tín hiệu GPS hiện tại quá thấp (±${Math.round(freshGps.accuracyMeters)}m, yêu cầu ≤ ${MAX_CHECKIN_ACCURACY_METERS}m). Vui lòng ra nơi thoáng và thử lại.`,
        );
      }

      // Đối chiếu khoảng cách tới tọa độ sự cố
      if (destination) {
        const dist = officerDistance(freshGps, destination);
        if (dist > MAX_CHECKIN_RADIUS_METERS) {
          if (alive.current) setDistanceErrorMeters(Math.round(dist));
          throw new Error(
            `Vị trí hiện tại cách điểm sự cố khoảng ${Math.round(dist)}m (vượt quá bán kính cho phép ${MAX_CHECKIN_RADIUS_METERS}m). Vui lòng di chuyển lại gần điểm sự cố và thử lại.`,
          );
        }
      }

      // Nếu nhiệm vụ đang ở trạng thái ASSIGNED, tự động chuyển sang IN_PROGRESS trước khi gọi arrival
      if (alertData && officerStatus(alertData) === "ASSIGNED") {
        await startHandling.mutateAsync(route.params.id);
      }

      await arrival.mutateAsync({
        id: route.params.id,
        location: {
          latitude: freshGps.latitude,
          longitude: freshGps.longitude,
          accuracyMeters: freshGps.accuracyMeters,
        },
      });

      if (!alive.current) return;
      setCheckInSuccess(true);

      // Tự động chuyển về giao diện Bước 2 (Xử lý sự cố) sau khi hiển thị phản hồi thành công
      setTimeout(() => {
        if (!alive.current) return;
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.replace("OfficerAlertDetail", { id: route.params.id });
        }
      }, 900);
    } catch (failure: unknown) {
      if (!alive.current) return;
      if (
        failure instanceof Error &&
        (failure.message.includes("NO_ACTIVE_SHIFT") ||
          failure.message.toLowerCase().includes("ca trực"))
      ) {
        assertOnShiftWithAlert();
        return;
      }
      const customMessage =
        failure instanceof Error &&
        /^(Camera chưa|Chưa xác định|Độ chính xác|Vị trí hiện tại)/.test(
          failure.message,
        )
          ? failure.message
          : undefined;
      setError(
        customMessage ||
          officerErrorMessage(
            failure,
            "Không thể điểm danh tại hiện trường. Vui lòng kiểm tra vị trí GPS và thử lại.",
          ),
      );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const handleRetry = async () => {
    setError(null);
    setDistanceErrorMeters(null);
    setCapturedPhotoUri(null);
    setCapturedAt(null);
    await gps.refresh();
  };

  return (
    <View
      style={[
        s.screen,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <OfficerHeader
        title="Check-in hiện trường"
        back={navigation.goBack}
        disabled={isPending}
      />
      <OfficerStepProgressBar
        task={alertData}
        step={verified ? 2 : 1}
      />
      <ScrollView
        contentContainerStyle={[
          s.content,
          { paddingBottom: Math.max(24, insets.bottom + 16) },
        ]}
      >
        {!isOnShift && (
          <View style={styles.shiftGuardWarningCard}>
            <View style={styles.shiftGuardWarningHeader}>
              <Lock size={15} color="#F59E0B" />
              <Text style={styles.shiftGuardWarningTitle}>
                YÊU CẦU BẮT ĐẦU CA TRỰC
              </Text>
            </View>
            <Text style={styles.shiftGuardWarningText}>
              Bạn cần bắt đầu ca trực để mở khóa thao tác Check-in và xác nhận vị trí tại hiện trường.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bắt đầu ca trực ngay"
              disabled={isShiftOperating}
              onPress={() => void startShiftDirectly()}
              style={styles.shiftGuardButton}
            >
              {isShiftOperating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.shiftGuardBtnRow}>
                  <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
                  <Text style={styles.shiftGuardBtnText}>
                    BẮT ĐẦU CA TRỰC NGAY
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        )}
        <OfficerCard accent={verified}>
          <View style={s.row}>
            {verified ? (
              <CheckCircle2 size={22} color={colors.primary} />
            ) : (
              <MapPin size={22} color={colors.cyan} />
            )}
            <View style={s.grow}>
              <Text
                accessibilityLiveRegion="polite"
                style={[
                  s.heading,
                  { color: verified ? colors.primary : colors.text },
                ]}
              >
                {verified
                  ? "Check-in thành công!"
                  : "Chụp ảnh minh chứng có mặt tại hiện trường"}
              </Text>
              <Text style={[s.meta, { color: colors.textSecondary }]}>
                {alertData?.address || "Đã ghi nhận tọa độ điểm sự cố"}
              </Text>
            </View>
          </View>
          <View style={[s.row, { flexWrap: "wrap" }]}>
            <OfficerBadge
              label={
                gps.position
                  ? `GPS ±${Math.round(gps.position.accuracyMeters)}m`
                  : gps.pending
                    ? "Đang tự động định vị GPS..."
                    : "Đang chờ tín hiệu GPS"
              }
              color={colors.cyan}
            />
            {currentDistance !== null && (
              <OfficerBadge
                label={`Cách điểm sự cố: ${Math.round(currentDistance)}m`}
                color={
                  currentDistance <= MAX_CHECKIN_RADIUS_METERS
                    ? colors.primary
                    : colors.warning
                }
              />
            )}
          </View>
        </OfficerCard>

        {verified ? (
          <OfficerCard accent>
            <Text style={[s.heading, { color: colors.primary }]}>
              Check-in thành công — Đang chuyển sang Bước 2 (Xử lý sự cố)
            </Text>
            {capturedPhotoUri ? (
              <EvidenceImageFrame
                imageUri={capturedPhotoUri}
                style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: 12 }}
                accessibilityLabel="Ảnh minh chứng Check-in tại hiện trường"
              />
            ) : null}
            <Text style={[s.meta, { color: colors.textSecondary }]}>
              Thời gian xác nhận:{" "}
              {officerDate(
                alertData?.checkIn?.checkedInAt ||
                  capturedAt ||
                  new Date().toISOString(),
              )}
            </Text>
          </OfficerCard>
        ) : error ? (
          <OfficerCard>
            <View style={[s.row, { alignItems: "flex-start" }]}>
              <ShieldAlert size={22} color={colors.danger} />
              <View style={[s.grow, { gap: 6 }]}>
                <Text style={[s.heading, { color: colors.danger }]}>
                  Chưa thể xác nhận vị trí Check-in
                </Text>
                <Text
                  accessibilityRole="alert"
                  style={[s.body, { color: colors.text }]}
                >
                  {error}
                </Text>
                {distanceErrorMeters !== null && (
                  <Text style={[s.meta, { color: colors.warning }]}>
                    Khoảng cách lệch thực tế: {distanceErrorMeters}m (Bán kính
                    hợp lệ tối đa: {MAX_CHECKIN_RADIUS_METERS}m)
                  </Text>
                )}
              </View>
            </View>
            {capturedPhotoUri ? (
              <EvidenceImageFrame
                imageUri={capturedPhotoUri}
                style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 12 }}
                accessibilityLabel="Ảnh đã chụp cần thử lại"
              />
            ) : null}
          </OfficerCard>
        ) : !permission?.granted ? (
          <OfficerCard>
            <Text style={[s.heading, { color: colors.text }]}>
              Cấp quyền Camera để chụp ảnh Check-in
            </Text>
            <Text style={[s.body, { color: colors.textSecondary }]}>
              Quy trình bắt buộc chụp ảnh trực tiếp tại hiện trường (không chọn
              ảnh từ thư viện) kèm đối chiếu tọa độ GPS tự động.
            </Text>
          </OfficerCard>
        ) : (
          <View style={{ gap: 10 }}>
            <View
              style={styles.cameraWrapper}
              onLayout={({ nativeEvent: { layout } }) =>
                setFrameWidth(Math.max(240, layout.width))
              }
            >
              <View style={[styles.cameraFrame, { width: frameWidth || "100%" }]}>
                {foreground ? (
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
                      setError("Không thể khởi động Camera. Vui lòng thử lại.");
                    }}
                  />
                ) : null}
                <View style={styles.cameraTopOverlay}>
                  <OfficerBadge
                    label="CAMERA TRỰC TIẾP · KHÔNG DÙNG THƯ VIỆN"
                    color={colors.primary}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Đổi chế độ đèn flash"
                    onPress={() => setFlash(flash === "off" ? "on" : "off")}
                    style={styles.flashButton}
                  >
                    <Flashlight
                      size={18}
                      color={flash === "on" ? colors.primary : "#FFFFFF"}
                    />
                  </Pressable>
                </View>
              </View>
            </View>
            <Text
              style={[
                s.meta,
                { color: colors.textMuted, textAlign: "center" },
              ]}
            >
              Hệ thống tự động lấy tọa độ GPS và đối chiếu khoảng cách ngay khi
              bạn bấm chụp ảnh.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Duy nhất 1 nút hành động chính (Single Primary CTA) ở dưới cùng */}
      <View
        style={{
          padding: 16,
          paddingBottom: Math.max(16, insets.bottom),
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        {verified ? (
          <Button
            appearance="civic"
            title="TIẾP TỤC: BƯỚC 2 (XỬ LÝ SỰ CỐ)"
            onPress={() =>
              navigation.canGoBack()
                ? navigation.goBack()
                : navigation.replace("OfficerAlertDetail", {
                    id: route.params.id,
                  })
            }
          />
        ) : error ? (
          <Button
            appearance="civic"
            title="Thử lại"
            loading={isPending || gps.pending}
            onPress={() => void handleRetry()}
          />
        ) : !permission?.granted ? (
          <Button
            appearance="civic"
            title={
              permission?.canAskAgain === false
                ? "Mở cài đặt cấp quyền Camera"
                : "Cho phép Camera để Check-in"
            }
            onPress={() =>
              permission?.canAskAgain === false
                ? void Linking.openSettings()
                : void requestPermission()
            }
          />
        ) : (
          <Button
            appearance="civic"
            title="Chụp ảnh & Check-in hiện trường"
            icon={<Camera size={18} color="#07101F" />}
            loading={isPending}
            disabled={!allowed || !ready || isPending}
            onPress={() => void handleCaptureAndCheckIn()}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shiftGuardWarningCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
    borderColor: "rgba(245, 158, 11, 0.35)",
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    padding: 12,
    gap: 8,
  },
  shiftGuardWarningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  shiftGuardWarningTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#F59E0B",
    letterSpacing: 0.5,
  },
  shiftGuardWarningText: {
    fontSize: 12,
    lineHeight: 17,
    color: "#D97706",
  },
  shiftGuardButton: {
    backgroundColor: "#10B981",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  shiftGuardBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  shiftGuardBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  cameraWrapper: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraFrame: {
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#050D17",
  },
  cameraTopOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  flashButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(7,16,31,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
});
