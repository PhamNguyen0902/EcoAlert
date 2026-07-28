import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert as RNAlert,
} from "react-native";
import { X, Edit3 } from "lucide-react-native";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { COLORS } from "../../utils/constants";
import { useUpdateAlert } from "../../hooks/useAlerts";
import { Alert, AlertCategory, Severity } from "../../types";

interface EditAlertModalProps {
  visible: boolean;
  alert: Alert | null;
  onClose: () => void;
}

const CATEGORIES: { label: string; value: AlertCategory }[] = [
  { label: "Illegal Dumping", value: "illegal_dumping" },
  { label: "Water Pollution", value: "water_pollution" },
  { label: "Air Pollution", value: "air_pollution" },
  { label: "Illegal Burning", value: "illegal_burning" },
  { label: "Flooding", value: "flooding" },
  { label: "Fallen Tree", value: "fallen_tree" },
  { label: "Other", value: "other" },
];

const SEVERITIES: { label: string; value: Severity }[] = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Critical", value: "critical" },
];

export const EditAlertModal: React.FC<EditAlertModalProps> = ({
  visible,
  alert,
  onClose,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<AlertCategory>("illegal_dumping");
  const [severity, setSeverity] = useState<Severity>("medium");

  const updateMutation = useUpdateAlert();

  useEffect(() => {
    if (alert) {
      setTitle(alert.title || "");
      setDescription(alert.description || "");
      setCategory(alert.category || "illegal_dumping");
      setSeverity(alert.severity || "medium");
    }
  }, [alert, visible]);

  if (!alert) return null;

  const handleUpdate = async () => {
    if (!title.trim() || title.length < 5) {
      RNAlert.alert("Validation Error", "Title must be at least 5 characters long.");
      return;
    }
    if (!description.trim() || description.length < 15) {
      RNAlert.alert("Validation Error", "Description must be at least 15 characters long.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: alert._id,
        data: {
          title: title.trim(),
          description: description.trim(),
          category,
          severity,
        },
      });

      RNAlert.alert("Success", "Incident report updated successfully.");
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to update incident.";
      RNAlert.alert("Update Error", msg);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Edit3 size={22} color={COLORS.primary} />
              <Text style={styles.title}>Edit Incident Report</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContent} showsVerticalScrollIndicator={false}>
            <Input
              label="Title *"
              placeholder="Incident title"
              value={title}
              onChangeText={setTitle}
            />

            <Input
              label="Description *"
              placeholder="Detailed description"
              multiline
              numberOfLines={4}
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
            />

            <Text style={styles.label}>Category</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.chip, category === cat.value && styles.chipActive]}
                  onPress={() => setCategory(cat.value)}
                >
                  <Text style={[styles.chipText, category === cat.value && styles.chipTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Severity Level</Text>
            <View style={styles.chipRow}>
              {SEVERITIES.map((sev) => (
                <TouchableOpacity
                  key={sev.value}
                  style={[styles.chip, severity === sev.value && styles.chipActive]}
                  onPress={() => setSeverity(sev.value)}
                >
                  <Text style={[styles.chipText, severity === sev.value && styles.chipTextActive]}>
                    {sev.label.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              title="Save Incident Changes"
              onPress={handleUpdate}
              loading={updateMutation.isPending}
              style={styles.submitBtn}
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
    maxHeight: "85%",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
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
  formContent: {
    marginBottom: 20,
  },
  textArea: {
    height: 90,
    textAlignVertical: "top",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  chipTextActive: {
    color: COLORS.primaryDark,
  },
  submitBtn: {
    marginTop: 12,
  },
});
