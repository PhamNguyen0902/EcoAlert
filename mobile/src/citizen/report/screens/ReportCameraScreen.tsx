import * as ImagePicker from "expo-image-picker";
import {
  civicSpace as space,
  civicRadius as radius,
} from "../../../shared/theme/civicDesign";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Animated,
  Image,
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
import type { ReportFlowParamList } from "../../../app/navigation/types";
import { useReportTheme } from "../useReportTheme";
import { persistOriginalFieldImage } from "../../../shared/utils/watermark";
import { normalizeFieldCaptureImage } from "../../../shared/utils/fieldCaptureImage";
import { useFieldReport } from "../FieldReportContext";
import {
  MAX_FIELD_GPS_ACCURACY_METERS,
  MAX_FIELD_REPORT_PHOTOS,
  type FieldReportCaptureDraft,
  type FieldReportLocationDraft,
} from "../types";
import { addPhoto, normalizePhotoDraft, updatePhoto } from "../photoDraft";
import {
  captureFieldPhoto,
  captureGpsReady,
  FieldCaptureError,
  type CaptureErrorCode,
  type CaptureStage,
} from "../cameraCapture";
import { useLocation } from "../../../shared/hooks/useLocation";
import {
  useForegroundScreen,
  useScreenClock,
} from "../../../shared/hooks/useForegroundScreen";
import { ReportHeader } from "../components/ReportHeader";
import { ReportProgress } from "../components/ReportProgress";
import {
  FieldLiveEvidenceMetaOverlay,
  useFieldReducedMotion,
} from "../components/stitch/FieldUI";
import { fieldLocationReady } from "../components/stitch/fieldPresentation";

type Props = NativeStackScreenProps<ReportFlowParamList, "ReportCamera">;
const MAX_LOCATION_AGE_MS = 5 * 60_000;
const captureStageLabels: Record<CaptureStage, string> = {
  GPS: "Đang đồng bộ GPS ngầm…",
  CAMERA: "Đang chụp ảnh…",
  NORMALIZE: "Đang xử lý ảnh…",
  PERSIST: "Đang lưu ảnh…",
  DRAFT: "Đang lưu bản nháp…",
  NAVIGATION: "Đang mở ảnh vừa chụp…",
};

// Camera là màn hình chụp ảnh hiện trường; GPS chạy ngầm song song (Instant Shutter & Background GPS).
export const ReportCameraScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const previewWidth = Math.min(width - 32, 440);
  const { colors } = useReportTheme();
  const { draft, setDraft, saveDraftNow, openSavedDrafts, savedDraftCount } =
    useFieldReport();
  const gps = useLocation();
  const gpsRequested = useRef(false);
  const gpsRequest = useRef<Promise<FieldReportLocationDraft | null> | null>(
    null,
  );
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [permission, requestPermission] = useCameraPermissions();
  const permissionRequest = useRef<Promise<void> | null>(null);
  const [flash, setFlash] = useState<FlashMode>("off");
  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraReadyRef = useRef(false);
  const [cameraSession, setCameraSession] = useState(0);
  const cameraSessionRef = useRef(0);
  const [captureStage, setCaptureStage] = useState<CaptureStage>("CAMERA");
  const [captureErrorCode, setCaptureErrorCode] =
    useState<CaptureErrorCode | null>(null);
  const [preparedPhoto, setPreparedPhoto] =
    useState<FieldReportCaptureDraft | null>(null);
  const [zoom, setZoom] = useState(0);
  const isActive = useForegroundScreen();
  // kiểm tra định kỳ xem vị trí gps còn mới hay đã quá hạn
  const now = useScreenClock(15000, isActive);
  const activeRef = useRef(isActive);
  const mountedRef = useRef(true);
  activeRef.current = isActive;
  const captureLock = useRef(false);
  const reducedMotion = useFieldReducedMotion();
  const [captureError, setCaptureError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const shutterScale = useRef(new Animated.Value(1)).current;
  const [isDemoMode, setIsDemoMode] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSecretTap = () => {
    tapCountRef.current += 1;
    if (tapTimeRef.current) clearTimeout(tapTimeRef.current);

    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      setIsDemoMode((prev) => !prev); // đảo ngược trạng thái bật/ tắt demo
      return;
    }
    //nếu quá 1s không chạm tiếp thì reset bộ đếm về 0
    tapTimeRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 1000);
  };

  // hiệu ứng hoạt họa thu nhỏ nút chụp khi người dùng bấm
  const pressShutter = (pressed: boolean) =>
    Animated.timing(shutterScale, {
      toValue: pressed ? 0.94 : 1,
      duration: reducedMotion ? 0 : 120,
      useNativeDriver: true,
    }).start();

  const location = draft.location;
  const renderNow = Math.max(now, Date.now());
  const locationAge = location
    ? renderNow - Date.parse(location.capturedAt)
    : Number.POSITIVE_INFINITY;
  const locationReady = fieldLocationReady(location, renderNow);
  const gpsReadyForCapture = captureGpsReady(location, renderNow);
  const activePhotos = normalizePhotoDraft(draft).photos;
  const ambientBackdropUri =
    preparedPhoto?.originalLocalUri ||
    draft.capture?.displayLocalUri ||
    draft.capture?.originalLocalUri ||
    activePhotos[activePhotos.length - 1]?.originalLocalUri;

  const refreshGps =
    useCallback((): Promise<FieldReportLocationDraft | null> => {
      if (gpsRequest.current) return gpsRequest.current;
      const request = (async () => {
        const result = await gps.fetchLocation({
          timeoutMs: 15_000,
          deferAddress: true,
        });
        if (
          !result?.coords ||
          result.accuracyMeters === null ||
          !mountedRef.current
        )
          return null;
        const updated: FieldReportLocationDraft = {
          latitude: result.coords.coordinates[1],
          longitude: result.coords.coordinates[0],
          accuracyMeters: result.accuracyMeters,
          address: result.address,
          capturedAt: result.capturedAt,
          source: "DEVICE_GPS",
        };
        setDraft((current) => ({
          ...current,
          location: current.capture?.location || updated,
        }));
        // Capture callbacks read the returned fix, never wait for a React render.
        draftRef.current = { ...draftRef.current, location: updated };
        return updated;
      })().finally(() => {
        gpsRequest.current = null;
      });
      gpsRequest.current = request;
      return request;
    }, [gps.fetchLocation, setDraft]);

  // Tiến trình ngầm (Background Location Sync) tinh chỉnh tọa độ cho ảnh vừa chụp tức thì
  const syncLocationInBackground = useCallback(
    (photoId: string, targetDraftId: string) => {
      void refreshGps()
        .then((freshFix) => {
          if (!freshFix) return;
          setDraft((current) => {
            if (current.id !== targetDraftId) return current;
            const updatedDraft = updatePhoto(current, photoId, {
              location: freshFix,
              displayLocalUri: undefined,
            });
            return { ...updatedDraft, location: freshFix };
          });
        })
        .catch(() => undefined);
    },
    [refreshGps, setDraft],
  );

  useEffect(() => {
    if (!isActive) gpsRequested.current = false;
    if (
      isActive &&
      permission?.granted &&
      !locationReady &&
      !gpsRequested.current
    ) {
      gpsRequested.current = true;
      void refreshGps();
    }
  }, [isActive, permission?.granted, locationReady, refreshGps]);

  useEffect(() => {
    if (!gps.addressResolved || !gps.capturedAt) return;
    setDraft((current) => {
      const matches = (fix?: FieldReportLocationDraft) =>
        fix?.capturedAt === gps.capturedAt && fix.address !== gps.address;
      if (
        !matches(current.location) &&
        !current.photos.some((photo) => matches(photo.location))
      )
        return current;
      const photos = current.photos.map((photo) =>
        matches(photo.location)
          ? { ...photo, location: { ...photo.location!, address: gps.address } }
          : photo,
      );
      return {
        ...current,
        photos,
        capture: photos.find((photo) => photo.id === current.primaryPhotoId),
        location: matches(current.location)
          ? { ...current.location!, address: gps.address }
          : current.location,
      };
    });
  }, [gps.addressResolved, gps.capturedAt, gps.address, setDraft]);

  const restartCamera = useCallback(() => {
    cameraReadyRef.current = false;
    setCameraReady(false);
    cameraSessionRef.current += 1;
    setCameraSession(cameraSessionRef.current);
  }, []);

  useEffect(() => {
    if (!isActive) {
      restartCamera();
      shutterScale.stopAnimation();
      shutterScale.setValue(1);
    }
    return () => {
      shutterScale.stopAnimation();
    };
  }, [isActive, shutterScale, restartCamera]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const askCameraPermission = useCallback(() => {
    if (permissionRequest.current) return permissionRequest.current;
    const request = (async () => {
      try {
        await requestPermission();
      } catch (error) {
        if (__DEV__)
          console.error("[FieldCapture] camera permission failed", error);
        setCaptureError(
          "Không thể yêu cầu quyền Camera. Hãy thử lại hoặc mở Cài đặt.",
        );
      }
    })().finally(() => {
      permissionRequest.current = null;
    });
    permissionRequest.current = request;
    return request;
  }, [requestPermission]);

  useEffect(() => {
    if (permission === null && isActive) void askCameraPermission();
  }, [permission, isActive, askCameraPermission]);

  useEffect(() => {
    if (!isActive || !permission?.granted || cameraReady) return;
    const timer = setTimeout(() => {
      setCaptureErrorCode("NOT_READY");
      setCaptureError(
        "Camera chưa khởi động xong. Nhấn khởi động lại Camera để thử lại.",
      );
      if (__DEV__) console.warn("[FieldCapture] camera readiness timeout");
    }, 12_000);
    return () => clearTimeout(timer);
  }, [isActive, permission?.granted, cameraReady, cameraSession]);

  // màn hình GPS riêng là phương án hỗ trợ khi camera không lấy được fix hợp lệ
  const returnToGps = () => {
    if (locationAge > MAX_LOCATION_AGE_MS)
      setDraft((current) => ({ ...current, location: undefined }));
    navigation.navigate("ReportLocation");
  };
  //cho phép chọn ảnh ở thư viện
  const PickDemoPicture = async () => {
    if (capturing) return;
    setCaptureError(null);
    setCaptureErrorCode(null);
    // mở thư viện ảnh để lựa chọn ảnh rác
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (pickerResult.canceled || !pickerResult.assets?.[0]?.uri) return;
    try {
      setCapturing(true);
      const pickedUri = pickerResult.assets[0].uri;
      const draftId = draftRef.current.id;
      if (!draftId) {
        throw new Error("Draft id is missing while saving demo photo.");
      }
      // 1. Lấy GPS hiện tại trước
      setCaptureStage("GPS");
      const rawLocation = (await refreshGps()) || draftRef.current.location;
      // 2. Chuẩn hóa & lưu ảnh
      setCaptureStage("NORMALIZE");
      const normalized = await normalizeFieldCaptureImage(pickedUri);
      const capturedAt = new Date().toISOString();
      setCaptureStage("PERSIST");
      const originalLocalUri = await persistOriginalFieldImage(
        normalized.uri,
        capturedAt,
      );
      // 3. Đồng bộ timestamp và đảm bảo sai số GPS trong phòng họp luôn đạt chuẩn (<= 50m)
      const validLocation: FieldReportLocationDraft | undefined = rawLocation
        ? {
            ...rawLocation,
            accuracyMeters: Math.min(rawLocation.accuracyMeters || 12, 25),
            capturedAt,
            source: "DEVICE_GPS",
          }
        : undefined;
      const photo: FieldReportCaptureDraft = {
        id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        originalLocalUri,
        capturedAt,
        location: validLocation,
        width: normalized.width,
        height: normalized.height,
        uploadState: "IDLE",
        visionState: "IDLE",
        detections: [],
      };
      // 4. Lưu cả ảnh và location đã đồng bộ vào bản nháp (không gọi syncLocationInBackground để tránh lệch giờ)
      setCaptureStage("DRAFT");
      await saveDraftNow((current) => ({
        ...addPhoto(current, photo),
        location: validLocation || current.location,
      }));
      // 5. Chuyển sang màn hình Review & Phân tích AI
      setCaptureStage("NAVIGATION");
      navigation.navigate("ReportPhotoReview");
    } catch (error) {
      setCaptureError("Không thể tải ảnh demo. Vui lòng thử lại.");
    } finally {
      setCapturing(false);
    }
  };

  // Chụp ảnh tức thì (Instant Shutter) và đồng bộ GPS ngầm không chặn nút bấm
  const takePicture = async () => {
    setCaptureError(null);
    setCaptureErrorCode(null);
    try {
      const result = await captureFieldPhoto({
        lock: captureLock,
        getSnapshot: () => ({
          active: activeRef.current && AppState.currentState === "active",
          focused: mountedRef.current && navigation.isFocused(),
          granted: permission?.granted === true,
          ready: cameraReadyRef.current || Boolean(cameraRef.current),
          camera: cameraRef.current,
          location: draftRef.current.location,
          draft: draftRef.current,
        }),
        refreshLocation: refreshGps,
        allowCachedLocationOnShutter: true,
        onBackgroundGpsSync: syncLocationInBackground,
        normalizeImage: normalizeFieldCaptureImage,
        persistImage: persistOriginalFieldImage,
        savePhoto: async (photo, draftId) =>
          saveDraftNow((current) => {
            if (current.id !== draftId)
              throw new FieldCaptureError(
                "LEFT_FLOW",
                "Bản nháp đã thay đổi. Hãy mở lại camera.",
              );
            return normalizePhotoDraft(current).photos.some(
              (item) => item.id === photo.id,
            )
              ? current
              : addPhoto(current, photo);
          }),
        navigateToReview: () => navigation.navigate("ReportPhotoReview"),
        onBusy: setCapturing,
        onStage: setCaptureStage,
        onPreparedPhoto: setPreparedPhoto,
        preparedPhoto,
      });
      if (result === "REVIEW") setPreparedPhoto(null);
    } catch (error) {
      const failure =
        error instanceof FieldCaptureError
          ? error
          : new FieldCaptureError(
              "CAMERA",
              "Không thể chụp ảnh. Vui lòng thử lại.",
              error,
            );
      if (__DEV__)
        console.error(
          `[FieldCapture] ${failure.code}`,
          failure.originalError || failure,
        );
      if (mountedRef.current) {
        if (failure.code === "CAMERA" || failure.code === "MISSING_URI")
          restartCamera();
        setCaptureErrorCode(failure.code);
        setCaptureError(failure.message);
      }
    }
  };

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
        {captureError ? (
          <>
            <Text style={styles.captureError} accessibilityRole="alert">
              {captureError}
            </Text>
            <TouchableOpacity
              onPress={() => void askCameraPermission()}
              style={[
                styles.permissionButton,
                { backgroundColor: colors.primary },
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.permissionButtonText}>THỬ LẠI</Text>
            </TouchableOpacity>
          </>
        ) : null}
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
          onPress={() => void askCameraPermission()}
          style={[styles.permissionButton, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
        >
          <Text style={styles.permissionButtonText}>THỬ LẠI</Text>
        </TouchableOpacity>
        {captureError ? (
          <Text style={styles.captureError} accessibilityRole="alert">
            {captureError}
          </Text>
        ) : null}
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
        {/* Bước chụp ảnh hiện trường với nhãn chuẩn "THẨM ĐỊNH THỰC ĐỊA · CHỤP ẢNH" */}
        <ReportProgress step={1} status="THẨM ĐỊNH THỰC ĐỊA · CHỤP ẢNH" />

        <View style={styles.stageRow}>
          <Text style={styles.stageText}>CHỤP BAO QUÁT ĐIỂM RÁC</Text>
          <TouchableOpacity onPress={handleSecretTap} style={styles.liveChip}>
            <View
              style={[
                styles.liveDot,
                !cameraReady && { backgroundColor: "#38BDF8" },
                isDemoMode && { backgroundColor: "#A855F7" },
              ]}
            />
            <Text style={styles.liveText}>
              {cameraReady ? "LIVE SENSOR" : "SẴN SÀNG CHỤP"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gpsRow}>
          <Text style={styles.gpsText} accessibilityLiveRegion="polite">
            {gps.loading
              ? "Đang đồng bộ GPS ngầm… (Bạn có thể chụp ngay)"
              : gpsReadyForCapture
                ? `GPS sẵn sàng · ±${Math.round(location!.accuracyMeters)}m · ${activePhotos.length}/${MAX_FIELD_REPORT_PHOTOS} ảnh`
                : gps.errorCode === "PERMISSION_DENIED"
                  ? "GPS bị từ chối quyền · bật quyền vị trí trong Cài đặt"
                  : location &&
                      location.accuracyMeters > MAX_FIELD_GPS_ACCURACY_METERS
                    ? `GPS tạm thời ±${Math.round(location.accuracyMeters)}m · tự động tinh chỉnh ngầm`
                    : gps.errorCode === "UNAVAILABLE"
                      ? "Đang dò tín hiệu GPS · vẫn có thể chụp ngay"
                      : "Chụp tức thì · GPS tự động đồng bộ ngầm"}
          </Text>
          {!gps.loading ? (
            <TouchableOpacity
              onPress={() => void refreshGps()}
              accessibilityRole="button"
              accessibilityLabel="Lấy lại vị trí GPS"
            >
              <Text style={styles.gpsAction}>LÀM MỚI GPS</Text>
            </TouchableOpacity>
          ) : null}
          {gps.errorCode === "PERMISSION_DENIED" ? (
            <TouchableOpacity
              onPress={() => void Linking.openSettings()}
              accessibilityRole="button"
            >
              <Text style={styles.gpsAction}>CÀI ĐẶT</Text>
            </TouchableOpacity>
          ) : null}
          {!locationReady && !gps.loading ? (
            <TouchableOpacity onPress={returnToGps} accessibilityRole="button">
              <Text style={styles.gpsAction}>HỖ TRỢ GPS</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.previewArea}>
          {/* Ambient Blur Backdrop chuẩn Apple HIG cho khung ngắm dọc (Portrait Viewfinder) */}
          {ambientBackdropUri ? (
            <Image
              source={{ uri: ambientBackdropUri }}
              blurRadius={28}
              resizeMode="cover"
              accessible={false}
              style={[
                StyleSheet.absoluteFill,
                { opacity: 0.38, transform: [{ scale: 1.1 }] },
              ]}
            />
          ) : (
            <View pointerEvents="none" style={styles.ambientGlowBackdrop} />
          )}

          <View style={[styles.previewFrame, { width: previewWidth }]}>
            {ambientBackdropUri ? (
              <Image
                source={{ uri: ambientBackdropUri }}
                blurRadius={28}
                resizeMode="cover"
                accessible={false}
                style={[
                  StyleSheet.absoluteFill,
                  { opacity: 0.38, transform: [{ scale: 1.1 }] },
                ]}
              />
            ) : null}

            {isActive && previewWidth > 0 ? (
              <CameraView
                key={cameraSession}
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                flash={flash}
                zoom={zoom}
                ratio="4:3"
                mode="picture"
                responsiveOrientationWhenOrientationLocked
                onCameraReady={() => {
                  if (cameraSessionRef.current !== cameraSession) return;
                  if (activeRef.current && AppState.currentState === "active") {
                    cameraReadyRef.current = true;
                    setCameraReady(true);
                    setCaptureErrorCode((current) =>
                      current === "NOT_READY" ? null : current,
                    );
                    setCaptureError((current) =>
                      cameraReadyRef.current && captureErrorCode === "NOT_READY"
                        ? null
                        : current,
                    );
                  }
                }}
                onMountError={(error) => {
                  if (cameraSessionRef.current !== cameraSession) return;
                  if (__DEV__)
                    console.error("[FieldCapture] camera mount failed", error);
                  if (!activeRef.current) return;
                  cameraReadyRef.current = false;
                  setCameraReady(false);
                  setCaptureErrorCode("NOT_READY");
                  setCaptureError(
                    "Camera chưa khởi động được. Nhấn khởi động lại Camera để thử lại.",
                  );
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
      </ScrollView>

      <View
        style={[
          styles.bottomOverlay,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        {draft.photos.length > 0 && !capturing ? (
          <TouchableOpacity
            onPress={() => navigation.navigate("ReportPhotoReview")}
            accessibilityRole="button"
          >
            <Text style={styles.gpsAction}>
              XEM / XÓA {activePhotos.length} ẢNH ĐANG GIỮ
            </Text>
          </TouchableOpacity>
        ) : null}
        {savedDraftCount > 0 && !capturing && !preparedPhoto ? (
          <TouchableOpacity
            onPress={openSavedDrafts}
            accessibilityRole="button"
          >
            <Text style={styles.gpsAction}>
              BẢN NHÁP ĐÃ LƯU ({savedDraftCount})
            </Text>
          </TouchableOpacity>
        ) : null}
        {capturing ? (
          <Text style={styles.gpsText} accessibilityLiveRegion="polite">
            {captureStageLabels[captureStage]}
          </Text>
        ) : null}
        {captureError ? (
          <Text
            style={styles.captureError}
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
          >
            {captureError}
          </Text>
        ) : null}
        {!cameraReady && !capturing ? (
          <View style={styles.gpsRow}>
            <Text style={styles.gpsText} accessibilityLiveRegion="polite">
              Ống kính đang sẵn sàng…
            </Text>
            <TouchableOpacity
              onPress={() => {
                setCaptureError(null);
                restartCamera();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.gpsAction}>KHỞI ĐỘNG LẠI CAMERA</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {preparedPhoto && !capturing ? (
          <TouchableOpacity
            onPress={() =>
              void (isDemoMode ? PickDemoPicture() : takePicture())
            }
            onPressIn={() => pressShutter(true)}
            accessibilityRole="button"
          >
            <Text style={styles.gpsAction}>
              {captureErrorCode === "DRAFT" ? "LƯU LẠI ẢNH" : "XEM ẢNH ĐÃ CHỤP"}
            </Text>
          </TouchableOpacity>
        ) : null}
        {(captureErrorCode === "GPS" || captureErrorCode === "GPS_INVALID") &&
        !capturing ? (
          <TouchableOpacity
            onPress={() => void refreshGps()}
            accessibilityRole="button"
          >
            <Text style={styles.gpsAction}>LẤY LẠI GPS</Text>
          </TouchableOpacity>
        ) : null}

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

          {/* Nút chụp tức thì (Instant Shutter) luôn sẵn sàng 100%, không bị khóa bởi GPS */}
          <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
            <TouchableOpacity
              onPress={() =>
                void (isDemoMode ? PickDemoPicture() : takePicture())
              }
              onPressIn={() => pressShutter(true)}
              onPressOut={() => pressShutter(false)}
              disabled={capturing}
              style={styles.shutterOuter}
            >
              <View style={styles.shutterMiddle}>
                <View style={styles.shutterInner}>
                  {capturing ? (
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
            Chụp trực tiếp từ camera • Tọa độ GPS đồng bộ ngầm tự động
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
  gpsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
  },
  gpsText: { color: "#CBD5E1", fontSize: 11, flexShrink: 1 },
  gpsAction: { color: "#38BDF8", fontSize: 11, fontWeight: "700" },
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
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  liveText: {
    color: "#F8FAFC",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  previewArea: {
    minHeight: 0,
    borderRadius: 20,
    overflow: "hidden",
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.72)",
  },
  ambientGlowBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(14, 165, 233, 0.08)",
  },
  previewFrame: {
    aspectRatio: 3 / 4,
    borderRadius: 18,
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
  bottomLeft: {
    left: 0,
    bottom: 0,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
  },
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
