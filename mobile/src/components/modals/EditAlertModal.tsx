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
import { useTheme } from "../../context/ThemeContext";
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
  const { colors, isDark } = useTheme();
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
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Edit3 size={22} color={colors.primary} />
              <Text style={[styles.title, { color: colors.text }]}>Edit Incident Report</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
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

            <Text style={[styles.label, { color: colors.text }]}>Category</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.value;
                return (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? "rgba(34,197,94,0.25)" : colors.primaryLight)
                          : (isDark ? "rgba(51, 65, 85, 0.4)" : colors.surface),
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setCategory(cat.value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: isSelected
                            ? (isDark ? "#4ADE80" : colors.primaryDark)
                            : colors.text,
                        },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Severity Level</Text>
            <View style={styles.chipRow}>
              {SEVERITIES.map((sev) => {
                const isSelected = severity === sev.value;
                return (
                  <TouchableOpacity
                    key={sev.value}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? "rgba(34,197,94,0.25)" : colors.primaryLight)
                          : (isDark ? "rgba(51, 65, 85, 0.4)" : colors.surface),
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setSeverity(sev.value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: isSelected
                            ? (isDark ? "#4ADE80" : colors.primaryDark)
                            : colors.text,
                        },
                      ]}
                    >
                      {sev.label.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
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
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  submitBtn: {
    marginTop: 12,
  },
});
