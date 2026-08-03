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
import { X, Edit3, Sparkles } from "lucide-react-native";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useUpdateAlert } from "../../hooks/useAlerts";
import type { Alert } from "../../types";

interface EditAlertModalProps {
  visible: boolean;
  alert: Alert | null;
  onClose: () => void;
}

export const EditAlertModal: React.FC<EditAlertModalProps> = ({
  visible,
  alert,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const updateMutation = useUpdateAlert();

  useEffect(() => {
    if (alert) {
      setTitle(alert.title || "");
      setDescription(alert.description || "");
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
        },
      });

      RNAlert.alert("Success", "Incident report updated successfully.");
      onClose();
    } catch (error: unknown) {
      const requestError = error as { response?: { data?: { message?: string } }; message?: string };
      const msg = requestError.response?.data?.message || requestError.message || "Failed to update incident.";
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

            <View
              style={[
                styles.aiReadOnlyCard,
                {
                  backgroundColor: isDark ? "rgba(99,102,241,0.18)" : "#EEF2FF",
                  borderColor: isDark ? "rgba(129,140,248,0.35)" : "#C7D2FE",
                },
              ]}
            >
              <Sparkles size={16} color={isDark ? "#A5B4FC" : "#4F46E5"} />
              <Text style={[styles.aiReadOnlyText, { color: isDark ? "#C7D2FE" : "#3730A3" }]}>
                {t(
                  "report.aiReadOnlyEdit",
                  "Category and severity are assessed by EcoAlert AI and cannot be edited here.",
                )}
              </Text>
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
  aiReadOnlyCard: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  aiReadOnlyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  submitBtn: {
    marginTop: 12,
  },
});
