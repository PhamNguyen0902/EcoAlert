import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert as RNAlert,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { X, CheckCircle2, Camera, UploadCloud } from "lucide-react-native";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useTheme } from "../../context/ThemeContext";
import {
  useResolveIncident,
  useUploadMedia,
} from "../../hooks/useAlerts";

interface ResolutionModalProps {
  visible: boolean;
  alertId: string;
  onClose: () => void;
}

const TREATMENT_OPTIONS = [
  { label: "🗑️ Thu gom rác thải", value: "Thu gom & vận chuyển phế thải đến nơi xử lý" },
  { label: "🧪 Xử lý hóa chất", value: "Xử lý hóa chất trung hòa & phun khử trùng" },
  { label: "🌊 Nạo vét dòng chảy", value: "Nạo vét bùn đất & khai thông dòng chảy" },
  { label: "🌳 Cắt tỉa cây gãy", value: "Cắt tỉa cây xanh & giải phóng chướng ngại vật" },
  { label: "🔥 Dập tắt đám cháy", value: "Dập tắt đám cháy & xử lý tàn dư khói độc" },
  { label: "🔊 Xử lý tiếng ồn", value: "Nhắc nhở & xử lý vi phạm tiếng ồn" },
];

const MATERIAL_OPTIONS = [
  "Xe gom rác & Bao tải",
  "Máy xúc / Xe cẩu",
  "Hóa chất & Máy phun",
  "Cưa máy & Đồ bảo hộ",
  "Máy bơm hút xả",
];

export const ResolutionModal: React.FC<ResolutionModalProps> = ({
  visible,
  alertId,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [treatmentMethod, setTreatmentMethod] = useState("Thu gom & vận chuyển phế thải đến nơi xử lý");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const resolveMutation = useResolveIncident();
  const uploadMutation = useUploadMedia();

  const handleSelectTreatment = (val: string) => {
    setTreatmentMethod(val);
  };

  const handleSelectMaterial = (val: string) => {
    if (!materialsUsed) {
      setMaterialsUsed(val);
    } else if (materialsUsed.includes(val)) {
      setMaterialsUsed((prev) => prev.replace(val, "").replace(/,\s*,/g, ",").trim());
    } else {
      setMaterialsUsed((prev) => `${prev}, ${val}`);
    }
  };

  const handlePickPhoto = () => {
    RNAlert.alert(
      "Attach Resolution Proof Evidence",
      "Choose photo source from your device:",
      [
        {
          text: "📸 Take Photo (Camera)",
          onPress: async () => {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (!permissionResult.granted) {
              RNAlert.alert("Permission Required", "Camera permission is required to take photo.");
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              await uploadSelectedPhoto(result.assets[0].uri);
            }
          },
        },
        {
          text: "🖼️ Choose from Photo Library",
          onPress: async () => {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
              RNAlert.alert("Permission Required", "Photo library permission is required.");
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              await uploadSelectedPhoto(result.assets[0].uri);
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const uploadSelectedPhoto = async (localUri: string) => {
    setIsUploading(true);
    try {
      const uploadedUrl = await uploadMutation.mutateAsync({
        fileUri: localUri,
        fileName: `resolution_${Date.now()}.jpg`,
      });
      setEvidenceUri(uploadedUrl);
    } catch (err) {
      setEvidenceUri(null);
      RNAlert.alert("Upload Error", "Could not upload the after-treatment image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolutionSummary.trim()) {
      RNAlert.alert("Validation Error", "Resolution Summary is required.");
      return;
    }
    if (!treatmentMethod.trim()) {
      RNAlert.alert("Validation Error", "Treatment Method is required.");
      return;
    }
    if (!evidenceUri) {
      RNAlert.alert("Validation Error", "An after-treatment image is required.");
      return;
    }

    try {
      let uploadedUrl: string = evidenceUri;

      if (evidenceUri && !evidenceUri.startsWith("http")) {
        uploadedUrl = await uploadMutation.mutateAsync({
          fileUri: evidenceUri,
          fileName: "resolution_evidence.jpg",
        });
      }

      let location: { latitude: number; longitude: number; accuracyMeters: number } | undefined;
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === "granted") {
        try {
          const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
          location = {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
            accuracyMeters: current.coords.accuracy ?? Number.MAX_SAFE_INTEGER,
          };
        } catch {
          // GPS context is best-effort; the verified check-in remains mandatory server-side.
        }
      }

      await resolveMutation.mutateAsync({
        id: alertId,
        data: {
          resolutionSummary: resolutionSummary.trim(),
          treatmentMethod: treatmentMethod.trim(),
          materialsUsed: materialsUsed.trim() || undefined,
          additionalNotes: additionalNotes.trim() || undefined,
          evidence: [{ url: uploadedUrl, ...(location ? { location } : {}) }],
        },
      });

      RNAlert.alert("Incident Resolved", "The incident status has been set to RESOLVED.");
      setResolutionSummary("");
      setTreatmentMethod("Thu gom & vận chuyển phế thải đến nơi xử lý");
      setMaterialsUsed("");
      setAdditionalNotes("");
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to resolve incident.";
      RNAlert.alert("Resolution Error", msg);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <CheckCircle2 size={22} color="#16A34A" />
              <Text style={[styles.title, { color: colors.text }]}>Mark Incident Resolved</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.subTitle, { color: colors.textMuted }]}>
              Upload proof photo and specify treatment methods used to resolve this environmental incident.
            </Text>

            <Input
              label="Resolution Summary *"
              placeholder="e.g. Removed 500kg waste and sanitized riverbank area"
              multiline
              numberOfLines={3}
              style={styles.textArea}
              value={resolutionSummary}
              onChangeText={setResolutionSummary}
            />

            {/* Quick Select Treatment Method Chips */}
            <Text style={[styles.label, { color: colors.text }]}>Treatment Method (Select Option) *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {TREATMENT_OPTIONS.map((opt) => {
                const isSelected = treatmentMethod === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? "rgba(34, 197, 94, 0.25)" : "#DCFCE7")
                          : (isDark ? "rgba(51, 65, 85, 0.4)" : colors.surface),
                        borderColor: isSelected ? (isDark ? "#4ADE80" : "#16A34A") : colors.border,
                      },
                    ]}
                    onPress={() => handleSelectTreatment(opt.value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: isSelected
                            ? (isDark ? "#4ADE80" : "#15803D")
                            : colors.text,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Input
              label=""
              placeholder="Or custom edit treatment method..."
              value={treatmentMethod}
              onChangeText={setTreatmentMethod}
            />

            {/* Quick Select Materials Chips */}
            <Text style={[styles.label, { color: colors.text }]}>Materials & Equipment Used</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {MATERIAL_OPTIONS.map((mat) => {
                const isSelected = materialsUsed.includes(mat);
                return (
                  <TouchableOpacity
                    key={mat}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? "rgba(34, 197, 94, 0.25)" : "#DCFCE7")
                          : (isDark ? "rgba(51, 65, 85, 0.4)" : colors.surface),
                        borderColor: isSelected ? (isDark ? "#4ADE80" : "#16A34A") : colors.border,
                      },
                    ]}
                    onPress={() => handleSelectMaterial(mat)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: isSelected
                            ? (isDark ? "#4ADE80" : "#15803D")
                            : colors.text,
                        },
                      ]}
                    >
                      {isSelected ? `✓ ${mat}` : mat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Input
              label=""
              placeholder="Or custom edit materials used..."
              value={materialsUsed}
              onChangeText={setMaterialsUsed}
            />

            <Input
              label="Additional Notes / Remarks"
              placeholder="Any follow-up recommendations or safety observations..."
              multiline
              numberOfLines={2}
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
            />

            <Text style={[styles.label, { color: colors.text }]}>Resolution Proof Evidence Photo *</Text>
            {evidenceUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: evidenceUri }} style={styles.imagePreview} />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => setEvidenceUri(null)}>
                  <X size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.uploadBox,
                  {
                    borderColor: colors.border,
                    backgroundColor: isDark ? "rgba(34,197,94,0.12)" : colors.background,
                  },
                ]}
                onPress={handlePickPhoto}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Camera size={28} color={colors.primary} />
                    <Text style={[styles.uploadText, { color: colors.primary }]}>Take Photo or Select from Device</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <Button
              title="Submit Resolution"
              onPress={handleResolve}
              loading={
                resolveMutation.isPending ||
                uploadMutation.isPending ||
                isUploading
              }
              style={styles.submitBtn}
              icon={<UploadCloud size={18} color="#FFF" style={{ marginRight: 6 }} />}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  closeBtn: {
    padding: 6,
  },
  subTitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  formContent: {
    marginBottom: 20,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 8,
  },
  uploadBox: {
    height: 110,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  uploadText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
  },
  imagePreviewContainer: {
    position: "relative",
    marginBottom: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: 150,
    borderRadius: 16,
  },
  removeImageBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtn: {
    backgroundColor: "#16A34A",
    marginTop: 10,
  },
  chipScroll: {
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    marginRight: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
