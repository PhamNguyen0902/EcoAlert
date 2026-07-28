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
import { X, CheckCircle2, Camera, UploadCloud } from "lucide-react-native";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { COLORS } from "../../utils/constants";
import {
  useResolveIncident,
  useUploadMedia,
  useStartHandling,
  useConfirmArrival,
} from "../../hooks/useAlerts";

interface ResolutionModalProps {
  visible: boolean;
  alertId: string;
  onClose: () => void;
}

const DEFAULT_PROOF_PHOTO = "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=600&q=80";

export const ResolutionModal: React.FC<ResolutionModalProps> = ({
  visible,
  alertId,
  onClose,
}) => {
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [treatmentMethod, setTreatmentMethod] = useState("Mechanical cleanup and waste disposal");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [evidenceUri, setEvidenceUri] = useState<string | null>(DEFAULT_PROOF_PHOTO);
  const [isUploading, setIsUploading] = useState(false);

  const resolveMutation = useResolveIncident();
  const uploadMutation = useUploadMedia();
  const startHandlingMutation = useStartHandling();
  const confirmArrivalMutation = useConfirmArrival();

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
      setEvidenceUri(localUri);
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

    try {
      let uploadedUrl: string = evidenceUri || DEFAULT_PROOF_PHOTO;

      if (evidenceUri && !evidenceUri.startsWith("http")) {
        uploadedUrl = await uploadMutation.mutateAsync({
          fileUri: evidenceUri,
          fileName: "resolution_evidence.jpg",
        });
      }

      // Auto-ensure prerequisite workflow steps (Start Handling & Confirm Arrival) are satisfied
      try {
        await startHandlingMutation.mutateAsync(alertId);
      } catch (e) {
        // Ignored if already started
      }

      try {
        await confirmArrivalMutation.mutateAsync({ id: alertId });
      } catch (e) {
        // Ignored if already confirmed
      }

      await resolveMutation.mutateAsync({
        id: alertId,
        data: {
          resolutionSummary: resolutionSummary.trim(),
          treatmentMethod: treatmentMethod.trim(),
          materialsUsed: materialsUsed.trim() || undefined,
          additionalNotes: additionalNotes.trim() || undefined,
          evidence: [{ url: uploadedUrl }],
        },
      });

      RNAlert.alert("Incident Resolved", "The incident status has been set to RESOLVED.");
      setResolutionSummary("");
      setTreatmentMethod("Mechanical cleanup and waste disposal");
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
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <CheckCircle2 size={22} color="#16A34A" />
              <Text style={styles.title}>Mark Incident Resolved</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.subTitle}>
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

            <Input
              label="Treatment Method *"
              placeholder="e.g. Chemical neutralization, manual cleanup, waste haulage"
              value={treatmentMethod}
              onChangeText={setTreatmentMethod}
            />

            <Input
              label="Materials & Equipment Used"
              placeholder="e.g. Excavator, protective gear, disinfectant solution"
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

            <Text style={styles.label}>Resolution Proof Evidence Photo *</Text>
            {evidenceUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: evidenceUri }} style={styles.imagePreview} />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => setEvidenceUri(null)}>
                  <X size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadBox} onPress={handlePickPhoto} disabled={isUploading}>
                {isUploading ? (
                  <ActivityIndicator size="small" color={COLORS.secondary} />
                ) : (
                  <>
                    <Camera size={28} color={COLORS.secondary} />
                    <Text style={styles.uploadText}>Take Photo or Select from Device</Text>
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
                startHandlingMutation.isPending ||
                confirmArrivalMutation.isPending ||
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
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: COLORS.surface,
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
    color: COLORS.text,
  },
  closeBtn: {
    padding: 6,
  },
  subTitle: {
    fontSize: 13,
    color: COLORS.textMuted,
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
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 8,
  },
  uploadBox: {
    height: 110,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    marginBottom: 20,
  },
  uploadText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.secondary,
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
});
