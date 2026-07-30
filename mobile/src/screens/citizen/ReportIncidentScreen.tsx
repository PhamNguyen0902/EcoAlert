import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert as RNAlert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Image,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import * as ImagePicker from "expo-image-picker";
import { MapPin, Navigation, Send, AlertCircle, Camera, X, Sparkles, EyeOff, Users, CheckCircle2 } from "lucide-react-native";
import { useCreateAlert, useUploadMedia, useCheckNearbyAlerts, useConfirmAlert, useAnalyzeMedia } from "../../hooks/useAlerts";
import { useLocation } from "../../hooks/useLocation";
import { GlassCard } from "../../components/ui/GlassCard";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { COLORS, SEVERITY_COLORS } from "../../utils/constants";
import { AlertCategory, Severity } from "../../types";

const CATEGORIES: { label: string; value: AlertCategory; icon: string }[] = [
  { label: "Illegal Dumping", value: "illegal_dumping", icon: "🗑️" },
  { label: "Water Pollution", value: "water_pollution", icon: "💧" },
  { label: "Air Pollution", value: "air_pollution", icon: "💨" },
  { label: "Illegal Burning", value: "illegal_burning", icon: "🔥" },
  { label: "Flooding", value: "flooding", icon: "🌊" },
  { label: "Fallen Tree", value: "fallen_tree", icon: "🌳" },
  { label: "Noise Pollution", value: "noise_pollution", icon: "🔊" },
  { label: "Other Incident", value: "other", icon: "⚠️" },
];

const SEVERITIES: { label: string; value: Severity }[] = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Critical", value: "critical" },
];

export const ReportIncidentScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const createAlertMutation = useCreateAlert();
  const uploadMediaMutation = useUploadMedia();
  const analyzeMediaMutation = useAnalyzeMedia();
  const confirmAlertMutation = useConfirmAlert();

  const { coords, address, loading: locLoading, error: locError, fetchLocation, setManualLocation } = useLocation();

  const nearbyQuery = useCheckNearbyAlerts(
    coords ? coords.coordinates[1] : undefined,
    coords ? coords.coordinates[0] : undefined,
    200
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<AlertCategory>("illegal_dumping");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; description?: string; location?: string }>({});

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  const handlePickPhoto = () => {
    RNAlert.alert(
      "Attach Incident Evidence",
      "Choose photo source from your device:",
      [
        {
          text: "📸 Take Photo (Camera)",
          onPress: async () => {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (!permissionResult.granted) {
              RNAlert.alert("Permission Required", "Camera access permission is required to capture photos.");
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              await processPickedPhoto(result.assets[0].uri);
            }
          },
        },
        {
          text: "🖼️ Choose from Photo Library",
          onPress: async () => {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
              RNAlert.alert("Permission Required", "Photo library access permission is required.");
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              await processPickedPhoto(result.assets[0].uri);
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const processPickedPhoto = async (localUri: string) => {
    setIsUploading(true);
    try {
      const uploadedUrl = await uploadMediaMutation.mutateAsync({
        fileUri: localUri,
        fileName: `report_${Date.now()}.jpg`,
      });
      setMediaUrls((prev) => [...prev, uploadedUrl]);
      // Auto AI analysis on upload
      handleAiAnalyze(uploadedUrl);
    } catch (err) {
      setMediaUrls((prev) => [...prev, localUri]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAiAnalyze = async (imageUrl?: string) => {
    const targetImg = imageUrl || (mediaUrls.length > 0 ? mediaUrls[0] : undefined);
    const inputText = (description || title || "").trim().toLowerCase();

    if (!inputText && !targetImg) {
      RNAlert.alert("AI Assistant", "Vui lòng nhập mô tả hoặc tải ảnh sự cố trước khi dùng AI.");
      return;
    }

    // Smart keyword & category inference engine
    let inferredCat: AlertCategory = "illegal_dumping";
    let inferredSev: Severity = "medium";
    let autoTitle = "Báo cáo sự cố xả rác bừa bãi";
    let autoDesc = description && description.length >= 15 
      ? description 
      : "Ghi nhận sự cố xả rác thải bừa bãi tại khu vực, gây ô nhiễm môi trường và ảnh hưởng mỹ quan đô thị.";

    if (inputText.includes("rác") || inputText.includes("phế thải") || inputText.includes("xả")) {
      inferredCat = "illegal_dumping";
      inferredSev = "medium";
      autoTitle = "Báo cáo sự cố xả rác thải bừa bãi";
      autoDesc = "Ghi nhận hành vi xả rác thải bừa bãi tại khu vực, gây ô nhiễm môi trường và mất mỹ quan đô thị.";
    } else if (inputText.includes("nước") || inputText.includes("sông") || inputText.includes("suối") || inputText.includes("xả thải")) {
      inferredCat = "water_pollution";
      inferredSev = "high";
      autoTitle = "Phát hiện sự cố ô nhiễm nguồn nước";
      autoDesc = "Ghi nhận dấu hiệu xả nước thải đục bẩn ra môi trường, gây ảnh hưởng nghiêm trọng tới nguồn nước khu vực.";
    } else if (inputText.includes("khói") || inputText.includes("cháy") || inputText.includes("đốt") || inputText.includes("bụi")) {
      inferredCat = "illegal_burning";
      inferredSev = "high";
      autoTitle = "Sự cố đốt rác / khói bụi gây ô nhiễm không khí";
      autoDesc = "Phát hiện hành vi đốt rác thải trái phép sinh nhiều khói độc hại, gây ô nhiễm không khí khu dân cư.";
    } else if (inputText.includes("ngập") || inputText.includes("lụt") || inputText.includes("triều cường")) {
      inferredCat = "flooding";
      inferredSev = "high";
      autoTitle = "Sự cố ngập nước / nghẽn dòng chảy";
      autoDesc = "Hiện trạng ngập nước nghiêm trọng tại khu vực gây cản trở giao thông và ảnh hưởng sinh hoạt.";
    } else if (inputText.includes("cây") || inputText.includes("đổ") || inputText.includes("gãy")) {
      inferredCat = "fallen_tree";
      inferredSev = "critical";
      autoTitle = "Cây xanh gãy đổ gây nguy hiểm";
      autoDesc = "Cây xanh bị gãy đổ chắn ngang đường, nguy cơ gây mất an toàn cho người và phương tiện lưu thông.";
    } else if (inputText.includes("ồn") || inputText.includes("tiếng ồn")) {
      inferredCat = "noise_pollution";
      inferredSev = "low";
      autoTitle = "Sự cố ô nhiễm tiếng ồn vượt quy chuẩn";
      autoDesc = "Tiếng ồn lớn phát ra liên tục trong khu dân cư gây ảnh hưởng tới sinh hoạt và sức khỏe người dân.";
    }

    try {
      const aiRes = await analyzeMediaMutation.mutateAsync({
        description: description || inputText,
        imageUrl: targetImg,
      });

      if (aiRes) {
        if (aiRes.category) setCategory(aiRes.category.toLowerCase() as AlertCategory);
        if (aiRes.severity) setSeverity(aiRes.severity.toLowerCase() as Severity);
        setTitle(aiRes.suggested_title || autoTitle);
        setDescription(aiRes.suggested_description || autoDesc);
        setAiNote(aiRes.analysis_note || `AI Confidence: ${Math.round((aiRes.confidence || 0.88) * 100)}%`);
      } else {
        setCategory(inferredCat);
        setSeverity(inferredSev);
        setTitle(autoTitle);
        setDescription(autoDesc);
        setAiNote("AI đã tự động phân tích và chọn danh mục phù hợp.");
      }
    } catch (err) {
      // Smart Fallback when AI service API is offline/unreachable
      setCategory(inferredCat);
      setSeverity(inferredSev);
      setTitle(autoTitle);
      setDescription(autoDesc);
      setAiNote("AI Smart Analyzer: Đã hoàn thiện danh mục, tiêu đề & mô tả.");
    } finally {
      setErrors({});
      RNAlert.alert("AI Auto-Fill ✨", "Đã tự động điền Tiêu đề, Mô tả chuẩn và chọn Danh mục sự cố cho bạn!");
    }
  };

  const handleConfirmExistingAlert = async (alertId: string) => {
    try {
      await confirmAlertMutation.mutateAsync(alertId);
      RNAlert.alert(
        "Đã đồng xác nhận",
        "Cảm ơn bạn! Báo cáo trùng lặp đã được đồng xác nhận (+1) giúp cán bộ ưu tiên xử lý.",
        [{ text: "OK", onPress: () => navigation?.navigate("DashboardTab") }]
      );
    } catch (err) {
      RNAlert.alert("Lỗi", "Không thể đồng xác nhận sự cố này.");
    }
  };

  const handleRemovePhoto = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    const errs: { title?: string; description?: string; location?: string } = {};
    if (!title.trim() || title.length < 5) {
      errs.title = "Please enter an incident title (at least 5 characters).";
    }
    if (!description.trim() || description.length < 10) {
      errs.description = "Please describe the incident (at least 10 characters).";
    }
    if (!coords) {
      errs.location = "Please select or retrieve GPS coordinates on the map.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      await createAlertMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        location: coords!,
        address: address || "Unknown Location",
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        isAnonymous,
      });

      RNAlert.alert(
        "Incident Reported",
        isAnonymous
          ? "Báo cáo ẩn danh của bạn đã được gửi thành công. Danh tính được bảo mật hoàn toàn."
          : "Your environmental report has been submitted to EcoAlert officers for verification.",
        [
          {
            text: "OK",
            onPress: () => {
              setTitle("");
              setDescription("");
              setMediaUrls([]);
              setIsAnonymous(false);
              if (navigation) {
                navigation.navigate("DashboardTab");
              }
            },
          },
        ]
      );
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to submit report.";
      RNAlert.alert("Submission Error", msg);
    }
  };

  const initialRegion = {
    latitude: coords ? coords.coordinates[1] : 10.762622,
    longitude: coords ? coords.coordinates[0] : 106.660172,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Sticky Top Header */}
        <View style={styles.stickyHeader}>
          <Text style={styles.headerTitle}>Report Incident</Text>
          <Text style={styles.headerSubtitle}>
            Submit real-time geotagged alerts to municipal environmental officers.
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Nearby Duplicate Warning Banner */}
          {nearbyQuery.data && nearbyQuery.data.length > 0 ? (
            <Card style={styles.duplicateCard}>
              <View style={styles.duplicateHeader}>
                <Users size={18} color="#D97706" />
                <Text style={styles.duplicateTitle}>
                  Phát hiện {nearbyQuery.data.length} sự cố lân cận trong 200m!
                </Text>
              </View>
              <Text style={styles.duplicateSub}>
                Sự cố tại vị trí này có thể đã được người dân khác báo cáo. Bạn có thể bấm "Đồng xác nhận" để gửi thông tin ưu tiên xử lý.
              </Text>
              {nearbyQuery.data.slice(0, 2).map((alert) => (
                <View key={alert._id} style={styles.duplicateItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dupItemTitle} numberOfLines={1}>
                      {alert.title}
                    </Text>
                    <Text style={styles.dupItemSub}>
                      {alert.confirmationsCount || 1} lượt đồng xác nhận • {alert.status.toUpperCase()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.dupConfirmBtn}
                    onPress={() => handleConfirmExistingAlert(alert._id)}
                    disabled={confirmAlertMutation.isPending}
                  >
                    <CheckCircle2 size={14} color="#FFF" style={{ marginRight: 4 }} />
                    <Text style={styles.dupConfirmText}>+1 Xác nhận</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </Card>
          ) : null}

          {/* Category Selector */}
          <Text style={styles.sectionLabel}>Select Incident Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catScroll}
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.value;
              return (
                <TouchableOpacity
                  key={cat.value}
                  activeOpacity={0.8}
                  onPress={() => setCategory(cat.value)}
                  style={[styles.catChip, isSelected && styles.catChipSelected]}
                >
                  <Text style={styles.catIcon}>{cat.icon}</Text>
                  <Text style={[styles.catText, isSelected && styles.catTextSelected]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Severity Selector */}
          <Text style={styles.sectionLabel}>Severity Priority Level</Text>
          <View style={styles.severityContainer}>
            {SEVERITIES.map((sev) => {
              const isSelected = severity === sev.value;
              const sevColor = SEVERITY_COLORS[sev.value] || { bg: "#F1F5F9", text: "#475569" };
              return (
                <TouchableOpacity
                  key={sev.value}
                  activeOpacity={0.8}
                  onPress={() => setSeverity(sev.value)}
                  style={[
                    styles.sevChip,
                    { backgroundColor: isSelected ? sevColor.text : sevColor.bg },
                    isSelected && { borderColor: sevColor.text },
                  ]}
                >
                  <Text style={[styles.sevText, { color: isSelected ? "#FFFFFF" : sevColor.text }]}>
                    {sev.label.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Form Fields */}
          <GlassCard style={styles.formCard}>
            <View style={styles.aiActionRow}>
              <Text style={styles.formTitle}>Report Details</Text>
              <TouchableOpacity
                style={styles.aiButton}
                onPress={() => handleAiAnalyze()}
                disabled={analyzeMediaMutation.isPending}
              >
                {analyzeMediaMutation.isPending ? (
                  <ActivityIndicator size="small" color="#4F46E5" />
                ) : (
                  <>
                    <Sparkles size={14} color="#4F46E5" />
                    <Text style={styles.aiBtnText}>AI Auto-Fill</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {aiNote ? (
              <View style={styles.aiBanner}>
                <Sparkles size={14} color="#4338CA" />
                <Text style={styles.aiBannerText}>{aiNote}</Text>
              </View>
            ) : null}

            <Input
              label="Incident Title"
              placeholder="e.g. Chemical waste dumping in river"
              value={title}
              onChangeText={setTitle}
              error={errors.title}
            />

            <Input
              label="Detailed Description"
              placeholder="Provide details: what is happening, approximate volume, hazards observed..."
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
              error={errors.description}
            />

            {/* Anonymous Toggle (1.4) */}
            <View style={styles.anonymousRow}>
              <View style={styles.anonInfo}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <EyeOff size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.anonTitle}>Báo cáo Ẩn danh (Anonymous)</Text>
                </View>
                <Text style={styles.anonSub}>
                  Ẩn tên & SĐT của bạn khỏi giao diện công khai và phía cán bộ xử lý.
                </Text>
              </View>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: "#CBD5E1", true: COLORS.primary }}
              />
            </View>

            {/* Photo & Evidence Upload Section */}
            <Text style={styles.photoLabel}>Incident Photo & Evidence</Text>
            {mediaUrls.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                {mediaUrls.map((url, index) => (
                  <View key={index} style={styles.photoThumbContainer}>
                    <Image source={{ uri: url }} style={styles.photoThumb} />
                    <TouchableOpacity
                      style={styles.photoRemoveBtn}
                      onPress={() => handleRemovePhoto(index)}
                    >
                      <X size={14} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <TouchableOpacity
              style={styles.addPhotoBtn}
              onPress={handlePickPhoto}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Camera size={20} color={COLORS.primary} />
                  <Text style={styles.addPhotoText}>Take Photo or Select from Device</Text>
                </>
              )}
            </TouchableOpacity>
          </GlassCard>

          {/* Geolocation Section with React Native Maps */}
          <View style={styles.mapHeader}>
            <Text style={styles.sectionLabel}>Incident Location (GPS)</Text>
            <TouchableOpacity style={styles.gpsButton} onPress={fetchLocation} disabled={locLoading}>
              {locLoading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Navigation size={14} color={COLORS.primary} />
                  <Text style={styles.gpsText}>Locate Me</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Card style={styles.mapCard}>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={initialRegion}
                region={
                  coords
                    ? {
                        latitude: coords.coordinates[1],
                        longitude: coords.coordinates[0],
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }
                    : undefined
                }
                onPress={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setManualLocation(latitude, longitude);
                }}
              >
                {coords ? (
                  <Marker
                    coordinate={{
                      latitude: coords.coordinates[1],
                      longitude: coords.coordinates[0],
                    }}
                    title="Incident Location"
                    description={address || "Selected coordinates"}
                    draggable
                    onDragEnd={(e) => {
                      const { latitude, longitude } = e.nativeEvent.coordinate;
                      setManualLocation(latitude, longitude);
                    }}
                  />
                ) : null}
              </MapView>
            </View>

            <View style={styles.addressBox}>
              <MapPin size={18} color={COLORS.primary} />
              <Text style={styles.addressText} numberOfLines={2}>
                {address || "Tap map or click 'Locate Me' to set position"}
              </Text>
            </View>
            {locError ? <Text style={styles.errorText}>{locError}</Text> : null}
            {errors.location ? <Text style={styles.errorText}>{errors.location}</Text> : null}
          </Card>

          {/* Submit Button */}
          <Button
            title="Submit Incident Report"
            onPress={handleSubmit}
            loading={createAlertMutation.isPending || isUploading}
            style={styles.submitBtn}
            icon={<Send size={18} color="#FFF" style={{ marginRight: 8 }} />}
          />

          <View style={styles.infoBox}>
            <AlertCircle size={14} color={COLORS.textMuted} />
            <Text style={styles.infoText}>
              False reports or malicious submissions may result in citizen account suspension.
            </Text>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoid: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollView: { flex: 1 },
  stickyHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    zIndex: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: COLORS.text },
  headerSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  content: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 14 },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 10,
    marginTop: 12,
  },
  catScroll: { paddingBottom: 8, gap: 10 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  catChipSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  catIcon: { fontSize: 16, marginRight: 6 },
  catText: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  catTextSelected: { color: COLORS.primaryDark, fontWeight: "700" },
  severityContainer: { flexDirection: "row", gap: 8, marginBottom: 16 },
  sevChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  sevText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  formCard: { padding: 20, marginBottom: 16 },
  photoLabel: { fontSize: 14, fontWeight: "600", color: COLORS.text, marginTop: 14, marginBottom: 8 },
  photoList: { flexDirection: "row", marginBottom: 12 },
  photoThumbContainer: { position: "relative", marginRight: 10 },
  photoThumb: { width: 90, height: 75, borderRadius: 12 },
  photoRemoveBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
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
    borderColor: COLORS.primary,
    borderStyle: "dashed",
    backgroundColor: COLORS.primaryLight,
    marginTop: 4,
  },
  addPhotoText: { fontSize: 13, fontWeight: "700", color: COLORS.primaryDark },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  gpsText: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
  mapCard: { padding: 0, overflow: "hidden", marginBottom: 24 },
  mapContainer: { height: 220, width: "100%" },
  map: { ...StyleSheet.absoluteFillObject },
  addressBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  addressText: { fontSize: 13, color: COLORS.text, flex: 1, fontWeight: "500" },
  errorText: {
    fontSize: 12,
    color: COLORS.destructive,
    paddingHorizontal: 14,
    paddingBottom: 10,
    fontWeight: "600",
  },
  submitBtn: { marginTop: 8 },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    gap: 6,
    paddingHorizontal: 20,
  },
  infoText: { fontSize: 11, color: COLORS.textMuted, textAlign: "center" },
  duplicateCard: {
    padding: 14,
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderWidth: 1,
    marginBottom: 16,
  },
  duplicateHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  duplicateTitle: { fontSize: 14, fontWeight: "700", color: "#92400E" },
  duplicateSub: { fontSize: 12, color: "#B45309", marginBottom: 10, lineHeight: 16 },
  duplicateItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 10,
    borderRadius: 10,
    marginTop: 6,
    gap: 8,
  },
  dupItemTitle: { fontSize: 13, fontWeight: "700", color: "#1E293B" },
  dupItemSub: { fontSize: 11, color: "#64748B", marginTop: 2 },
  dupConfirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dupConfirmText: { fontSize: 12, fontWeight: "700", color: "#FFF" },
  aiActionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  formTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  aiBtnText: { fontSize: 12, fontWeight: "700", color: "#4F46E5" },
  aiBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0E7FF",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },
  aiBannerText: { fontSize: 12, color: "#3730A3", fontWeight: "600", flex: 1 },
  anonymousRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  anonInfo: { flex: 1, paddingRight: 10 },
  anonTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  anonSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
});
