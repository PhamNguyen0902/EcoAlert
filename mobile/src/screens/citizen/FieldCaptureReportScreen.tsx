import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert as RNAlert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  CheckCircle2,
  MapPin,
  Navigation,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react-native";
import { useCreateAlert, useUploadMedia } from "../../hooks/useAlerts";
import { useLocation } from "../../hooks/useLocation";
import { useOfflineSync } from "../../hooks/useOfflineSync";
import { offlineQueue } from "../../utils/offlineQueue";
import { formatWatermarkData } from "../../utils/watermark";
import { Card } from "../../components/ui/Card";
import type { CaptureMetadata } from "../../types";
import { GlassCard } from "../../components/ui/GlassCard";
import { Button } from "../../components/ui/Button";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import type { CitizenStackParamList, CitizenTabParamList } from "../../navigation/types";

type Props = BottomTabScreenProps<CitizenTabParamList, "ReportTab">;

const MAX_FIELD_GPS_ACCURACY_METERS = 50;

interface CapturedEvidence {
  localUri: string;
  uploadedUrl: string;
  capturedAt: string;
  accuracyMeters: number | null;
  address: string;
  latitude: number;
  longitude: number;
}

const createCaptureMetadata = (evidence: CapturedEvidence): CaptureMetadata => {
  if (evidence.accuracyMeters === null) {
    throw new Error("A live GPS accuracy value is required for field capture.");
  }

  return {
    method: "LIVE_CAMERA",
    capturedAt: evidence.capturedAt,
    gpsAccuracyMeters: evidence.accuracyMeters,
    locationSource: "DEVICE_GPS",
  };
};

const isBackendMediaUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const requestErrorMessage = (error: unknown, fallback: string): string => {
  const requestError = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return requestError.response?.data?.message || requestError.message || fallback;
};

/**
 * Citizen waste reporting flow optimized for mobile field capture.
 * Evidence can only be created by opening the device camera from this screen.
 * A fresh device GPS fix is required before the camera opens.
 */
export const FieldCaptureReportScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const createAlertMutation = useCreateAlert();
  const uploadMediaMutation = useUploadMedia();
  const { isOffline, isConnected } = useOfflineSync();
  const {
    coords,
    address,
    accuracyMeters,
    capturedAt,
    source,
    loading: locationLoading,
    error: locationError,
    fetchLocation,
  } = useLocation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<CapturedEvidence | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const copy = language === "vi"
    ? {
        pageTitle: "Báo cáo rác tại hiện trường",
        subtitle: "Chụp trực tiếp bằng camera và gắn vị trí GPS hiện tại.",
        stepLocation: "1. Xác minh vị trí",
        locate: "Lấy GPS hiện tại",
        refreshLocation: "Lấy lại GPS",
        noLocation: "Chưa có vị trí thiết bị.",
        accuracy: "Độ chính xác GPS",
        goodAccuracy: "Đủ điều kiện chụp hiện trường",
        weakAccuracy: `Cần GPS chính xác hơn ±${MAX_FIELD_GPS_ACCURACY_METERS} m`,
        stepCamera: "2. Chụp ảnh hiện trường",
        cameraOnly: "EcoAlert chỉ chấp nhận ảnh chụp trực tiếp. Không sử dụng ảnh từ thư viện.",
        takePhoto: "Mở camera và chụp",
        retake: "Chụp lại",
        fieldCapture: "ECOALERT FIELD CAPTURE",
        stepDetails: "3. Xác nhận nội dung",
        titleLabel: "Tiêu đề",
        titlePlaceholder: "Ví dụ: Rác sinh hoạt tràn lề đường",
        descriptionLabel: "Mô tả",
        descriptionPlaceholder: "Mô tả tình trạng rác, mức cản trở hoặc mùi hôi...",
        aiTitle: "AI sẽ phân tích sau khi gửi",
        aiBody: "YOLO/Vision sẽ nhận diện rác và hệ thống AI hỗ trợ phân loại, đánh giá mức độ. Kết quả vẫn có thể được cán bộ kiểm tra lại.",
        submit: isOffline ? "Lưu báo cáo ngoại tuyến" : "Gửi báo cáo rác",
        locationRequired: "Cần lấy vị trí GPS trước khi chụp.",
        deviceLocationRequired: "Báo cáo hiện trường phải dùng vị trí GPS trực tiếp từ thiết bị.",
        accuracyRequired: `GPS hiện tại chưa đủ chính xác. Hãy thử lại đến khi sai số không quá ${MAX_FIELD_GPS_ACCURACY_METERS} m.`,
        cameraPermission: "EcoAlert cần quyền camera để chụp ảnh hiện trường.",
        photoRequired: "Hãy chụp ít nhất một ảnh hiện trường.",
        titleRequired: "Tiêu đề cần ít nhất 5 ký tự.",
        descriptionRequired: "Mô tả cần ít nhất 10 ký tự.",
        success: "Báo cáo đã được gửi. EcoAlert AI đang phân tích ảnh.",
        offlineSuccess: "Báo cáo đã được lưu trên thiết bị và sẽ đồng bộ khi có mạng.",
      }
    : {
        pageTitle: "Field waste report",
        subtitle: "Capture directly with the camera and attach the current device GPS location.",
        stepLocation: "1. Verify location",
        locate: "Get current GPS",
        refreshLocation: "Refresh GPS",
        noLocation: "Device location has not been acquired.",
        accuracy: "GPS accuracy",
        goodAccuracy: "Ready for field capture",
        weakAccuracy: `GPS must be within ±${MAX_FIELD_GPS_ACCURACY_METERS} m`,
        stepCamera: "2. Capture field evidence",
        cameraOnly: "EcoAlert accepts live camera capture only. Photo library uploads are disabled.",
        takePhoto: "Open camera",
        retake: "Retake photo",
        fieldCapture: "ECOALERT FIELD CAPTURE",
        stepDetails: "3. Confirm report",
        titleLabel: "Title",
        titlePlaceholder: "e.g. Household waste blocking the sidewalk",
        descriptionLabel: "Description",
        descriptionPlaceholder: "Describe the waste, obstruction, odor, or other impact...",
        aiTitle: "AI analysis starts after submission",
        aiBody: "YOLO/Vision detects waste and AI supports classification and severity assessment. Officers can still review the result.",
        submit: isOffline ? "Save offline report" : "Submit waste report",
        locationRequired: "Get a GPS location before taking the photo.",
        deviceLocationRequired: "Field reports require a live device GPS location.",
        accuracyRequired: `GPS accuracy is too weak. Retry until the error is within ${MAX_FIELD_GPS_ACCURACY_METERS} m.`,
        cameraPermission: "EcoAlert needs camera permission for field capture.",
        photoRequired: "Capture at least one field photo.",
        titleRequired: "Title must contain at least 5 characters.",
        descriptionRequired: "Description must contain at least 10 characters.",
        success: "Report submitted. EcoAlert AI is analyzing the evidence.",
        offlineSuccess: "Report saved on this device and will sync when the network is restored.",
      };

  const gpsReady = Boolean(
    coords &&
      source === "device" &&
      accuracyMeters !== null &&
      accuracyMeters <= MAX_FIELD_GPS_ACCURACY_METERS,
  );

  const watermark = useMemo(() => {
    if (!evidence) return null;
    return formatWatermarkData(
      {
        latitude: evidence.latitude,
        longitude: evidence.longitude,
        address: evidence.address,
        timestamp: new Date(evidence.capturedAt),
        brandTag: copy.fieldCapture,
      },
      language,
    );
  }, [copy.fieldCapture, evidence, language]);

  const handleCapture = async () => {
    setIsCapturing(true);
    try {
      // Always refresh location immediately before opening the camera so the
      // evidence and GPS fix belong to the same field-capture session.
      const liveLocation = await fetchLocation();
      if (!liveLocation?.coords) {
        RNAlert.alert(copy.stepLocation, copy.locationRequired);
        return;
      }
      if (liveLocation.source !== "device") {
        RNAlert.alert(copy.stepLocation, copy.deviceLocationRequired);
        return;
      }
      if (
        liveLocation.accuracyMeters === null ||
        liveLocation.accuracyMeters > MAX_FIELD_GPS_ACCURACY_METERS
      ) {
        RNAlert.alert(copy.stepLocation, copy.accuracyRequired);
        return;
      }

      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        RNAlert.alert(copy.stepCamera, copy.cameraPermission);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.9,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      let uploadedUrl = asset.uri;
      setIsUploading(true);
      try {
        if (isConnected !== false) {
          const resultUrl = await uploadMediaMutation.mutateAsync({
            fileUri: asset.uri,
            fileName: asset.fileName || `field_${Date.now()}.jpg`,
            fileType: asset.mimeType || "image/jpeg",
          });
          if (resultUrl && isBackendMediaUrl(resultUrl)) uploadedUrl = resultUrl;
        }
      } catch (error) {
        console.warn("[FieldCapture] Upload deferred for offline sync:", error);
      } finally {
        setIsUploading(false);
      }

      const [longitude, latitude] = liveLocation.coords.coordinates;
      setEvidence({
        localUri: asset.uri,
        uploadedUrl,
        capturedAt: liveLocation.capturedAt || new Date().toISOString(),
        accuracyMeters: liveLocation.accuracyMeters,
        address: liveLocation.address,
        latitude,
        longitude,
      });
    } finally {
      setIsCapturing(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setEvidence(null);
  };

  const validate = (): string | null => {
    if (!coords || source !== "device") return copy.deviceLocationRequired;
    if (accuracyMeters === null || accuracyMeters > MAX_FIELD_GPS_ACCURACY_METERS) {
      return copy.accuracyRequired;
    }
    if (!evidence) return copy.photoRequired;
    if (title.trim().length < 5) return copy.titleRequired;
    if (description.trim().length < 10) return copy.descriptionRequired;
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      RNAlert.alert(copy.pageTitle, error);
      return;
    }
    if (!evidence || !coords) return;

    const captureMetadata = createCaptureMetadata(evidence);

    if (isOffline || !isBackendMediaUrl(evidence.uploadedUrl)) {
      await offlineQueue.saveOfflineDraft({
        title: title.trim(),
        description: description.trim(),
        address: evidence.address,
        location: { type: "Point", coordinates: [evidence.longitude, evidence.latitude] },
        localMediaUris: [evidence.localUri],
        captureMetadata,
        isAnonymous: false,
      });
      RNAlert.alert(copy.pageTitle, copy.offlineSuccess, [{ text: "OK", onPress: resetForm }]);
      return;
    }

    try {
      const created = await createAlertMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        address: evidence.address,
        location: { type: "Point", coordinates: [evidence.longitude, evidence.latitude] },
        mediaUrls: [evidence.uploadedUrl],
        captureMetadata,
        isAnonymous: false,
      });

      RNAlert.alert(copy.pageTitle, copy.success, [
        {
          text: "OK",
          onPress: () => {
            resetForm();
            navigation
              .getParent<NativeStackNavigationProp<CitizenStackParamList>>()
              ?.navigate("AlertDetail", { id: created._id });
          },
        },
      ]);
    } catch (submitError) {
      RNAlert.alert(copy.pageTitle, requestErrorMessage(submitError, "Unable to submit report."));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{copy.pageTitle}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>{copy.subtitle}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <GlassCard style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Navigation size={19} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{copy.stepLocation}</Text>
            </View>

            <Text style={[styles.address, { color: colors.text }]}>
              {address || copy.noLocation}
            </Text>
            {coords ? (
              <Text style={[styles.coords, { color: colors.textMuted }]}>
                {coords.coordinates[1].toFixed(6)}, {coords.coordinates[0].toFixed(6)}
              </Text>
            ) : null}

            <View style={[styles.gpsStatus, { borderColor: gpsReady ? colors.primary : colors.border }]}>
              <MapPin size={16} color={gpsReady ? colors.primary : colors.textMuted} />
              <View style={styles.gpsStatusCopy}>
                <Text style={[styles.gpsStatusLabel, { color: colors.textMuted }]}>{copy.accuracy}</Text>
                <Text style={[styles.gpsStatusValue, { color: colors.text }]}>
                  {accuracyMeters === null ? "—" : `±${Math.round(accuracyMeters)} m`}
                </Text>
              </View>
              {gpsReady ? (
                <View style={styles.readyPill}>
                  <CheckCircle2 size={13} color="#166534" />
                  <Text style={styles.readyPillText}>{copy.goodAccuracy}</Text>
                </View>
              ) : null}
            </View>
            {!gpsReady && accuracyMeters !== null ? (
              <Text style={[styles.warningText, { color: colors.accent }]}>{copy.weakAccuracy}</Text>
            ) : null}
            {locationError ? <Text style={[styles.errorText, { color: colors.destructive }]}>{locationError}</Text> : null}

            <TouchableOpacity
              onPress={() => void fetchLocation()}
              disabled={locationLoading}
              style={[styles.locationButton, { backgroundColor: colors.primaryLight }]}
            >
              {locationLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <RefreshCw size={17} color={colors.primary} />
              )}
              <Text style={[styles.locationButtonText, { color: isDark ? "#86EFAC" : colors.primaryDark }]}>
                {coords ? copy.refreshLocation : copy.locate}
              </Text>
            </TouchableOpacity>
          </GlassCard>

          <GlassCard style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Camera size={19} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{copy.stepCamera}</Text>
            </View>
            <Text style={[styles.helper, { color: colors.textMuted }]}>{copy.cameraOnly}</Text>

            {evidence ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: evidence.localUri }} style={styles.previewImage} />
                <View style={styles.watermarkOverlay}>
                  <View style={styles.watermarkBrandRow}>
                    <ShieldCheck size={14} color="#4ADE80" />
                    <Text style={styles.watermarkBrand}>{watermark?.brandStr}</Text>
                  </View>
                  <Text style={styles.watermarkLine}>{watermark?.addressStr}</Text>
                  <Text style={styles.watermarkLine}>{watermark?.locationStr}</Text>
                  <Text style={styles.watermarkLine}>{watermark?.dateTimeStr}</Text>
                </View>
                <TouchableOpacity style={styles.removePhoto} onPress={() => setEvidence(null)}>
                  <X size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : null}

            <Button
              title={evidence ? copy.retake : copy.takePhoto}
              onPress={() => void handleCapture()}
              loading={isCapturing || isUploading}
              icon={<Camera size={18} color="#FFF" />}
              style={styles.primaryButton}
            />
          </GlassCard>

          <GlassCard style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <ShieldCheck size={19} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{copy.stepDetails}</Text>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{copy.titleLabel}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={copy.titlePlaceholder}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{copy.descriptionLabel}</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={copy.descriptionPlaceholder}
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              style={[
                styles.input,
                styles.descriptionInput,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            />
          </GlassCard>

          <Card
            style={[
              styles.aiCard,
              {
                backgroundColor: isDark ? "rgba(99,102,241,0.14)" : "#EEF2FF",
                borderColor: isDark ? "rgba(129,140,248,0.35)" : "#C7D2FE",
              },
            ]}
          >
            <View style={styles.sectionTitleRow}>
              <Sparkles size={18} color={isDark ? "#A5B4FC" : "#4F46E5"} />
              <Text style={[styles.aiTitle, { color: isDark ? "#C7D2FE" : "#3730A3" }]}>{copy.aiTitle}</Text>
            </View>
            <Text style={[styles.aiBody, { color: isDark ? "#C7D2FE" : "#4338CA" }]}>{copy.aiBody}</Text>
          </Card>

          <Button
            title={copy.submit}
            onPress={() => void handleSubmit()}
            loading={createAlertMutation.isPending || isUploading}
            icon={<Send size={18} color="#FFF" />}
            style={styles.submitButton}
          />

          {capturedAt ? (
            <Text style={[styles.sessionMeta, { color: colors.textMuted }]}>Session GPS: {capturedAt}</Text>
          ) : null}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 23, fontWeight: "900" },
  headerSubtitle: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  content: { padding: 16, paddingBottom: 48, gap: 14 },
  card: { padding: 16 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "800", flex: 1 },
  address: { fontSize: 14, fontWeight: "700", marginTop: 14, lineHeight: 20 },
  coords: { fontSize: 11, marginTop: 4, fontVariant: ["tabular-nums"] },
  gpsStatus: { flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderRadius: 13, padding: 12, marginTop: 12 },
  gpsStatusCopy: { flex: 1 },
  gpsStatusLabel: { fontSize: 10, fontWeight: "700" },
  gpsStatusValue: { fontSize: 14, fontWeight: "900", marginTop: 2 },
  readyPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: "#DCFCE7", maxWidth: "58%" },
  readyPillText: { color: "#166534", fontSize: 9, fontWeight: "800", flexShrink: 1 },
  warningText: { fontSize: 11, fontWeight: "700", marginTop: 8 },
  errorText: { fontSize: 11, fontWeight: "700", marginTop: 8 },
  locationButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 11, marginTop: 12 },
  locationButtonText: { fontSize: 13, fontWeight: "800" },
  helper: { fontSize: 12, lineHeight: 18, marginTop: 8, marginBottom: 12 },
  previewContainer: { position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 12, backgroundColor: "#020617" },
  previewImage: { width: "100%", aspectRatio: 4 / 3, resizeMode: "cover" },
  watermarkOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(2,6,23,0.76)", paddingHorizontal: 12, paddingVertical: 10 },
  watermarkBrandRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  watermarkBrand: { color: "#4ADE80", fontSize: 11, fontWeight: "900" },
  watermarkLine: { color: "#F8FAFC", fontSize: 9, lineHeight: 14 },
  removePhoto: { position: "absolute", top: 9, right: 9, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  primaryButton: { marginTop: 2 },
  inputLabel: { fontSize: 11, fontWeight: "800", marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 46, fontSize: 14 },
  descriptionInput: { minHeight: 110, paddingTop: 12 },
  aiCard: { padding: 15, borderWidth: 1 },
  aiTitle: { fontSize: 14, fontWeight: "900", flex: 1 },
  aiBody: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  submitButton: { marginTop: 2 },
  sessionMeta: { fontSize: 9, textAlign: "center", marginTop: 2 },
});
