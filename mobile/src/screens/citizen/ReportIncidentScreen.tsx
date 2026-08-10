import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert as RNAlert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import * as ImagePicker from "expo-image-picker";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  EyeOff,
  MapPin,
  Maximize2,
  Navigation,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  WifiOff,
  X,
} from "lucide-react-native";
import {
  useCheckNearbyAlerts,
  useConfirmAlert,
  useCreateAlert,
  useUploadMedia,
} from "../../hooks/useAlerts";
import { useLocation } from "../../hooks/useLocation";
import { useOfflineSync } from "../../hooks/useOfflineSync";
import { offlineQueue } from "../../utils/offlineQueue";
import { formatWatermarkData } from "../../utils/watermark";
import { GlassCard } from "../../components/ui/GlassCard";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import type { CitizenStackParamList, CitizenTabParamList } from "../../navigation/types";
import { getAiAnalysisState, getWorkflowStatusLabel } from "../../utils/aiAnalysis";
import type { AlertCategory, ImageValidation } from "../../types";
import { alertService } from "../../api/alertService";

type Props = BottomTabScreenProps<CitizenTabParamList, "ReportTab">;

interface UploadedEvidence {
  localUri: string;
  uploadedUrl: string;
}

interface FormErrors {
  title?: string;
  description?: string;
  evidence?: string;
  location?: string;
}

const isBackendMediaUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const requestErrorMessage = (error: unknown, fallback: string): string => {
  const requestError = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return requestError.response?.data?.message || requestError.message || fallback;
};

export const ReportIncidentScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { language, t } = useLanguage();
  const createAlertMutation = useCreateAlert();
  const uploadMediaMutation = useUploadMedia();
  const confirmAlertMutation = useConfirmAlert();
  const { isOffline, isConnected } = useOfflineSync();
  const {
    coords,
    address,
    loading: locLoading,
    error: locError,
    fetchLocation,
    setManualLocation,
  } = useLocation();

  const nearbyQuery = useCheckNearbyAlerts(
    coords?.coordinates[1],
    coords?.coordinates[0],
    200,
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<UploadedEvidence[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [imageValidation, setImageValidation] = useState<ImageValidation | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<AlertCategory | undefined>();
  const [classificationDecision, setClassificationDecision] = useState<"CONFIRM" | "CORRECT" | undefined>();

  useEffect(() => {
    void fetchLocation();
  }, [fetchLocation]);

  useEffect(() => {
    const selectedLocation = route.params?.selectedLocation;
    if (!selectedLocation) return;

    setManualLocation(
      selectedLocation.latitude,
      selectedLocation.longitude,
      selectedLocation.address,
    );
    navigation.setParams({ selectedLocation: undefined });
  }, [navigation, route.params?.selectedLocation, setManualLocation]);

  const openFullScreenMap = () => {
    const stackNavigation = navigation.getParent<NativeStackNavigationProp<CitizenStackParamList>>();
    stackNavigation?.navigate("LocationPicker", {
      initialLocation: coords
        ? {
            latitude: coords.coordinates[1],
            longitude: coords.coordinates[0],
            address,
          }
        : undefined,
    });
  };

  const processPickedPhotos = async (assets: ImagePicker.ImagePickerAsset[]) => {
    setIsUploading(true);
    setErrors((current) => ({ ...current, evidence: undefined }));

    const newEvidenceItems: UploadedEvidence[] = [];

    for (const asset of assets) {
      try {
        let uploadedUrl = asset.uri;
        if (isConnected !== false) {
          const resultUrl = await uploadMediaMutation.mutateAsync({
            fileUri: asset.uri,
            fileName: asset.fileName || `report_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.jpg`,
            fileType: asset.mimeType || "image/jpeg",
          });
          if (resultUrl && isBackendMediaUrl(resultUrl)) {
            uploadedUrl = resultUrl;
          }
        }
        if (!imageValidation && isBackendMediaUrl(uploadedUrl)) {
          const validation = await alertService.validateImage(uploadedUrl) as ImageValidation;
          setImageValidation(validation);
          if (validation.decision === "INVALID") {
            RNAlert.alert(
              "Hình ảnh không phù hợp với báo cáo sự cố",
              "Không phát hiện sự cố môi trường rõ ràng trong ảnh. Vui lòng chọn ảnh khác.",
            );
            continue;
          }
          if (validation.suggestedCategory) {
            setSelectedCategory(validation.suggestedCategory);
            setClassificationDecision("CONFIRM");
          }
        }
        newEvidenceItems.push({ localUri: asset.uri, uploadedUrl });
      } catch (error) {
        console.warn("[ReportIncident] Photo upload warning, saving local URI for offline sync:", error);
        newEvidenceItems.push({ localUri: asset.uri, uploadedUrl: asset.uri });
      }
    }

    setEvidence((current) => [...current, ...newEvidenceItems]);
    setIsUploading(false);
  };

  const handlePickPhoto = () => {
    RNAlert.alert(
      t("report.imagesLabel", "Incident Photo & Evidence"),
      t("report.photoSource", "Choose a photo source:"),
      [
        {
          text: t("report.camera", "Camera"),
          onPress: async () => {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
              RNAlert.alert(
                t("report.permissionTitle", "Permission required"),
                t("report.cameraPermission", "Camera access is required to take a photo."),
              );
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: false,
              quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              await processPickedPhotos(result.assets);
            }
          },
        },
        {
          text: t("report.gallery", "Photo library (Multiple)"),
          onPress: async () => {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
              RNAlert.alert(
                t("report.permissionTitle", "Permission required"),
                t("report.galleryPermission", "Photo library access is required to select evidence."),
              );
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsMultipleSelection: true,
              selectionLimit: 5,
              quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              await processPickedPhotos(result.assets);
            }
          },
        },
        { text: t("modals.cancel", "Cancel"), style: "cancel" },
      ],
    );
  };

  const handleConfirmExistingAlert = async (alertId: string) => {
    try {
      await confirmAlertMutation.mutateAsync(alertId);
      RNAlert.alert(
        t("report.confirmedTitle", "Confirmed"),
        t("report.confirmedBody", "Thank you. Your confirmation was added to this report."),
      );
    } catch (error) {
      RNAlert.alert(
        t("report.confirmErrorTitle", "Unable to confirm"),
        requestErrorMessage(error, t("report.confirmErrorBody", "Please try again.")),
      );
    }
  };

  const chooseCategory = () => {
    const options: Array<{ label: string; value: AlertCategory }> = [
      { label: "Rác thải / đổ trộm", value: "illegal_dumping" },
      { label: "Ô nhiễm nước", value: "water_pollution" },
      { label: "Ngập lụt", value: "flooding" },
      { label: "Đốt rác", value: "illegal_burning" },
      { label: "Khác", value: "other" },
    ];
    RNAlert.alert("Chọn danh mục", "Danh mục này là quyết định của bạn; AI chỉ hỗ trợ gợi ý.", [
      ...options.map((option) => ({ text: option.label, onPress: () => { setSelectedCategory(option.value); setClassificationDecision(option.value === imageValidation?.suggestedCategory ? "CONFIRM" : "CORRECT"); } })),
      { text: "Hủy", style: "cancel" },
    ]);
  };

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};
    if (title.trim().length < 5) {
      nextErrors.title = t("report.titleError", "Title must be at least 5 characters.");
    }
    if (description.trim().length < 10) {
      nextErrors.description = t(
        "report.descriptionError",
        "Description must be at least 10 characters.",
      );
    }
    if (evidence.length === 0) {
      nextErrors.evidence = t("report.evidenceError", "Add at least one photo.");
    }
    if (!coords) {
      nextErrors.location = t("report.locationError", "Incident location is required.");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveAsOfflineDraft = async () => {
    try {
      await offlineQueue.saveOfflineDraft({
        title: title.trim(),
        description: description.trim(),
        address: address || undefined,
        location: {
          type: "Point",
          coordinates: coords!.coordinates,
        },
        localMediaUris: evidence.map((item) => item.localUri),
        isAnonymous,
      });

      RNAlert.alert(
        t("report.offlineSavedTitle", "Đã lưu bản nháp Ngoại tuyến"),
        t(
          "report.offlineSavedBody",
          "Báo cáo sự cố của bạn đã được lưu vào hàng chờ. EcoAlert sẽ tự động gửi báo cáo khi có kết nối mạng.",
        ),
        [
          {
            text: t("modals.ok", "OK"),
            onPress: () => {
              setTitle("");
              setDescription("");
              setEvidence([]);
              setIsAnonymous(false);
            },
          },
        ],
      );
    } catch (e) {
      RNAlert.alert(
        t("report.errorTitle", "Lỗi lưu nháp"),
        t("report.errorBody", "Không thể lưu báo cáo ngoại tuyến. Vui lòng thử lại."),
      );
    }
  };

  const handleSubmit = async () => {
    if (isUploading || !validate()) return;

    if (isOffline) {
      await saveAsOfflineDraft();
      return;
    }

    try {
      const createdAlert = await createAlertMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        address: address || undefined,
        location: {
          type: "Point",
          coordinates: coords!.coordinates,
        },
        mediaUrls: evidence.map((item) => item.uploadedUrl),
        isAnonymous,
        ...(selectedCategory ? { category: selectedCategory, classification: { selectedCategory, decision: classificationDecision || "CORRECT" } } : {}),
        ...(imageValidation ? { imageValidation } : {}),
      });

      RNAlert.alert(
        t("report.successTitle", "Report submitted"),
        t(
          "report.successAiMsg",
          "Your report was submitted successfully. EcoAlert AI is now analyzing it.",
        ),
        [
          {
            text: t("report.viewReport", "View report"),
            onPress: () => {
              setTitle("");
              setDescription("");
              setEvidence([]);
              setIsAnonymous(false);
              navigation
                .getParent<NativeStackNavigationProp<CitizenStackParamList>>()
                ?.navigate("AlertDetail", { id: createdAlert._id });
            },
          },
        ],
      );
    } catch (error) {
      RNAlert.alert(
        t("report.submitErrorTitle", "Submission failed"),
        requestErrorMessage(
          error,
          t("report.submitErrorBody", "The report could not be submitted. Would you like to save it offline?"),
        ),
        [
          { text: t("modals.cancel", "Hủy"), style: "cancel" },
          {
            text: t("report.saveOffline", "Lưu ngoại tuyến"),
            onPress: () => void saveAsOfflineDraft(),
          },
        ],
      );
    }
  };

  const initialRegion = {
    latitude: coords?.coordinates[1] ?? 10.762622,
    longitude: coords?.coordinates[0] ?? 106.660172,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.stickyHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t("report.title", "Report Incident")}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            {t("report.subtitle", "Describe, photograph, and locate the environmental issue.")}
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isOffline ? (
            <Card
              style={[
                styles.duplicateCard,
                {
                  backgroundColor: isDark ? "rgba(239,68,68,0.2)" : "#FEE2E2",
                  borderColor: isDark ? "rgba(239,68,68,0.4)" : "#EF4444",
                  marginBottom: 16,
                },
              ]}
            >
              <View style={styles.duplicateHeader}>
                <WifiOff size={18} color="#EF4444" />
                <Text style={[styles.duplicateTitle, { color: isDark ? "#FCA5A5" : "#991B1B" }]}>
                  Đang ở Chế độ Ngoại tuyến (Offline Mode)
                </Text>
              </View>
              <Text style={[styles.duplicateSub, { color: isDark ? "#FECACA" : "#B91C1C" }]}>
                Không có kết nối mạng. Báo cáo của bạn sẽ được tự động lưu nháp và đồng bộ lên hệ thống ngay khi thiết bị kết nối lại Wifi/4G.
              </Text>
            </Card>
          ) : null}
          {nearbyQuery.data?.length ? (
            <Card
              style={[
                styles.duplicateCard,
                {
                  backgroundColor: isDark ? "rgba(245,158,11,0.2)" : "#FEF3C7",
                  borderColor: isDark ? "rgba(245,158,11,0.4)" : "#F59E0B",
                },
              ]}
            >
              <View style={styles.duplicateHeader}>
                <Users size={18} color={isDark ? "#FBBF24" : "#D97706"} />
                <Text style={[styles.duplicateTitle, { color: isDark ? "#FDE047" : "#92400E" }]}>
                  {t("report.nearbyTitle", "A nearby report may already exist")}
                </Text>
              </View>
              <Text style={[styles.duplicateSub, { color: isDark ? "#FCD34D" : "#B45309" }]}>
                {t("report.nearbyBody", "Confirm an existing incident instead of creating a duplicate.")}
              </Text>
              {nearbyQuery.data.slice(0, 2).map((nearbyAlert) => {
                const aiState = getAiAnalysisState(nearbyAlert);
                return (
                  <View key={nearbyAlert._id} style={[styles.duplicateItem, { backgroundColor: colors.surface }]}>
                    <View style={styles.duplicateCopy}>
                      <Text style={[styles.dupItemTitle, { color: colors.text }]} numberOfLines={1}>
                        {nearbyAlert.title}
                      </Text>
                      <Text style={[styles.dupItemSub, { color: colors.textMuted }]}>
                        {nearbyAlert.confirmationsCount || 1} {t("report.confirmations", "confirmations")} · {getWorkflowStatusLabel(nearbyAlert.status, language)}
                      </Text>
                      {aiState === "PENDING" ? (
                        <Text style={[styles.dupAiText, { color: colors.secondary }]}>
                          {t("aiAnalysis.analyzingShort", "AI: Analyzing…")}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.dupConfirmBtn}
                      onPress={() => void handleConfirmExistingAlert(nearbyAlert._id)}
                      disabled={confirmAlertMutation.isPending}
                    >
                      <CheckCircle2 size={14} color="#FFF" />
                      <Text style={styles.dupConfirmText}>+1 {t("report.confirm", "Confirm")}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </Card>
          ) : null}

          <GlassCard style={styles.formCard}>
            <Text style={[styles.formTitle, { color: colors.text }]}>
              {t("report.detailsTitle", "Report Details")}
            </Text>
            <Input
              label={t("report.incidentTitle", "Incident Title")}
              placeholder={t("report.incidentTitlePlaceholder", "e.g. Waste dumped beside the canal")}
              value={title}
              onChangeText={setTitle}
              error={errors.title}
            />
            <Input
              label={t("report.descriptionLabel", "Detailed Description")}
              placeholder={t("report.descriptionPlaceholder", "Describe what is happening and any hazards you observed...")}
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
              error={errors.description}
            />

            <View style={[styles.anonymousRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.anonInfo}>
                <View style={styles.anonTitleRow}>
                  <EyeOff size={16} color={colors.primary} />
                  <Text style={[styles.anonTitle, { color: colors.text }]}>
                    {t("report.anonymousTitle", "Anonymous report")}
                  </Text>
                </View>
                <Text style={[styles.anonSub, { color: colors.textMuted }]}>
                  {t("report.anonymousBody", "Keep your identity hidden according to the existing privacy policy.")}
                </Text>
              </View>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: isDark ? "#334155" : "#CBD5E1", true: colors.primary }}
              />
            </View>
          </GlassCard>

          <GlassCard style={styles.evidenceCard}>
            <Text style={[styles.formTitle, { color: colors.text }]}>
              {t("report.imagesLabel", "Incident Photo & Evidence")}
            </Text>
            <Text style={[styles.helperText, { color: colors.textMuted }]}>
              {t("report.evidenceHelper", "Photos are uploaded securely before the report is submitted.")}
            </Text>
            {imageValidation ? (
              <View style={[styles.aiValidationCard, { backgroundColor: imageValidation.decision === "INVALID" ? "#FEF2F2" : imageValidation.decision === "UNCERTAIN" ? "#FFFBEB" : colors.primaryLight }]}>
                <Text style={[styles.aiValidationTitle, { color: colors.text }]}>Gợi ý của EcoAlert AI: {imageValidation.decision}</Text>
                <Text style={[styles.helperText, { color: colors.textMuted }]}>{imageValidation.reason}</Text>
                {imageValidation.confidence !== null ? <Text style={[styles.helperText, { color: colors.textMuted }]}>Độ tin cậy: {Math.round(imageValidation.confidence * 100)}%</Text> : null}
                <TouchableOpacity onPress={chooseCategory}><Text style={[styles.categoryChoice, { color: colors.primary }]}>Danh mục: {selectedCategory || "UNCLASSIFIED"} · Chọn / chỉnh sửa</Text></TouchableOpacity>
              </View>
            ) : null}
            {evidence.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                {evidence.map((item, index) => (
                  <View key={item.uploadedUrl || index} style={styles.photoThumbContainer}>
                    <Image source={{ uri: item.localUri }} style={styles.photoThumb} />
                    <View style={styles.watermarkBadgeOverlay}>
                      <ShieldCheck size={10} color="#4ADE80" />
                      <Text style={styles.watermarkBadgeText} numberOfLines={1}>
                        {coords ? `${coords.coordinates[1].toFixed(2)},${coords.coordinates[0].toFixed(2)}` : "GPS Stamped"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.photoRemoveBtn}
                      onPress={() => setEvidence((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      accessibilityLabel={t("report.removePhoto", "Remove photo")}
                    >
                      <X size={14} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}
            <TouchableOpacity
              style={[
                styles.addPhotoBtn,
                {
                  borderColor: colors.primary,
                  backgroundColor: isDark ? "rgba(34,197,94,0.15)" : colors.primaryLight,
                },
              ]}
              onPress={handlePickPhoto}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Camera size={20} color={colors.primary} />
                  <Text style={[styles.addPhotoText, { color: isDark ? "#4ADE80" : colors.primaryDark }]}>
                    {t("report.addImageBtn", "Take Photo or Select from Device")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {errors.evidence ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.evidence}</Text> : null}
          </GlassCard>

          <View style={styles.mapHeader}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>
              {t("report.locationLabel", "Incident Location (GPS)")}
            </Text>
            <TouchableOpacity
              style={[styles.gpsButton, { backgroundColor: isDark ? "rgba(34,197,94,0.2)" : colors.primaryLight }]}
              onPress={() => void fetchLocation()}
              disabled={locLoading}
            >
              {locLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Navigation size={14} color={colors.primary} />
                  <Text style={[styles.gpsText, { color: colors.primary }]}>
                    {t("report.locateMe", "Locate me")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Card style={styles.mapCard}>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={initialRegion}
                region={coords ? initialRegion : undefined}
                onPress={({ nativeEvent }) => {
                  setManualLocation(nativeEvent.coordinate.latitude, nativeEvent.coordinate.longitude);
                }}
              >
                {coords ? (
                  <Marker
                    coordinate={{
                      latitude: coords.coordinates[1],
                      longitude: coords.coordinates[0],
                    }}
                    title={t("report.locationLabel", "Incident Location")}
                    description={address || t("report.selectedCoordinates", "Selected coordinates")}
                    draggable
                    onDragEnd={({ nativeEvent }) => {
                      setManualLocation(nativeEvent.coordinate.latitude, nativeEvent.coordinate.longitude);
                    }}
                  />
                ) : null}
              </MapView>
              <TouchableOpacity
                style={[styles.fullMapButton, { backgroundColor: colors.surface }]}
                onPress={openFullScreenMap}
                accessibilityLabel={t("report.selectLocationBtn", "Pick Location on Map")}
              >
                <Maximize2 size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.addressBox, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
              <MapPin size={18} color={colors.primary} />
              <View style={styles.addressCopy}>
                <Text style={[styles.addressText, { color: colors.text }]} numberOfLines={2}>
                  {address || t("report.locationHint", "Tap the map or use Locate me to set the position")}
                </Text>
                {coords ? (
                  <Text style={[styles.coordinatesText, { color: colors.textMuted }]}>
                    {coords.coordinates[1].toFixed(6)}, {coords.coordinates[0].toFixed(6)}
                  </Text>
                ) : null}
              </View>
            </View>
            {locError ? <Text style={[styles.errorText, { color: colors.destructive }]}>{locError}</Text> : null}
            {errors.location ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.location}</Text> : null}
          </Card>

          <Card
            style={[
              styles.aiInfoCard,
              {
                backgroundColor: isDark ? "rgba(99,102,241,0.16)" : "#EEF2FF",
                borderColor: isDark ? "rgba(129,140,248,0.35)" : "#C7D2FE",
              },
            ]}
          >
            <View style={styles.aiInfoHeader}>
              <Sparkles size={18} color={isDark ? "#A5B4FC" : "#4F46E5"} />
              <Text style={[styles.aiInfoTitle, { color: isDark ? "#C7D2FE" : "#3730A3" }]}>
                {t("report.aiInfoTitle", "AI will analyze automatically")}
              </Text>
            </View>
            <Text style={[styles.aiInfoBody, { color: isDark ? "#C7D2FE" : "#4338CA" }]}>
              {t(
                "report.aiInfoBody",
                "You don't need to classify the incident yourself. EcoAlert AI will analyze the report after submission and determine its category, severity, and confidence.",
              )}
            </Text>
            <Text style={[styles.aiReviewNote, { color: colors.textMuted }]}>
              {t("report.aiReviewNote", "The result may be reviewed by an officer.")}
            </Text>
          </Card>

          <Button
            title={t("report.submitBtn", "Submit Incident Report")}
            onPress={() => void handleSubmit()}
            loading={createAlertMutation.isPending || isUploading}
            style={styles.submitBtn}
            icon={<Send size={18} color="#FFF" style={styles.submitIcon} />}
          />

          <View style={styles.infoBox}>
            <AlertCircle size={14} color={colors.textMuted} />
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              {t("report.accuracyNotice", "Please provide accurate information to help officers respond effectively.")}
            </Text>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  stickyHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    zIndex: 10,
    elevation: 4,
  },
  headerTitle: { fontSize: 24, fontWeight: "800" },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  content: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 14 },
  formCard: { padding: 20, marginBottom: 16 },
  evidenceCard: { padding: 20, marginBottom: 16 },
  formTitle: { fontSize: 16, fontWeight: "800", marginBottom: 12 },
  helperText: { fontSize: 12, lineHeight: 18, marginTop: -6, marginBottom: 12 },
  anonymousRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
  },
  anonInfo: { flex: 1, paddingRight: 10 },
  anonTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  anonTitle: { fontSize: 13, fontWeight: "700" },
  anonSub: { fontSize: 11, marginTop: 3, lineHeight: 16 },
  photoList: { flexDirection: "row", marginBottom: 12 },
  photoThumbContainer: { position: "relative", marginRight: 10 },
  photoThumb: { width: 96, height: 80, borderRadius: 12 },
  photoRemoveBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  addPhotoText: { fontSize: 13, fontWeight: "700" },
  aiValidationCard: { marginTop: 12, marginBottom: 8, padding: 12, borderRadius: 12 },
  aiValidationTitle: { fontSize: 13, fontWeight: "800", marginBottom: 4 },
  categoryChoice: { marginTop: 7, fontSize: 13, fontWeight: "700" },
  sectionLabel: { fontSize: 15, fontWeight: "700" },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    gap: 6,
  },
  gpsText: { fontSize: 12, fontWeight: "700" },
  mapCard: { padding: 0, overflow: "hidden", marginBottom: 16 },
  mapContainer: { height: 220, width: "100%" },
  map: { ...StyleSheet.absoluteFillObject },
  fullMapButton: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  addressBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  addressCopy: { flex: 1 },
  addressText: { fontSize: 13, fontWeight: "500" },
  coordinatesText: { fontSize: 11, marginTop: 4, fontVariant: ["tabular-nums"] },
  errorText: { fontSize: 12, marginTop: 8, fontWeight: "600" },
  aiInfoCard: { padding: 16, borderWidth: 1, marginBottom: 20 },
  aiInfoHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiInfoTitle: { fontSize: 15, fontWeight: "800" },
  aiInfoBody: { fontSize: 13, lineHeight: 19, marginTop: 9 },
  aiReviewNote: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  submitBtn: { marginTop: 4 },
  submitIcon: { marginRight: 8 },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    gap: 6,
    paddingHorizontal: 20,
  },
  infoText: { fontSize: 11, textAlign: "center", flex: 1 },
  duplicateCard: { padding: 14, borderWidth: 1, marginBottom: 16 },
  duplicateHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  duplicateTitle: { fontSize: 14, fontWeight: "700", flex: 1 },
  duplicateSub: { fontSize: 12, marginBottom: 10, lineHeight: 17 },
  duplicateItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    marginTop: 6,
    gap: 8,
  },
  duplicateCopy: { flex: 1 },
  dupItemTitle: { fontSize: 13, fontWeight: "700" },
  dupItemSub: { fontSize: 11, marginTop: 2 },
  dupAiText: { fontSize: 11, fontWeight: "700", marginTop: 3 },
  dupConfirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#059669",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  dupConfirmText: { fontSize: 12, fontWeight: "700", color: "#FFF" },
  watermarkBadgeOverlay: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.70)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  watermarkBadgeText: { fontSize: 9, fontWeight: "700", color: "#FFFFFF", flex: 1 },
});
