import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert as RNAlert,
} from "react-native";
import { X, Tag } from "lucide-react-native";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { COLORS } from "../../utils/constants";
import { useCreateCategory, useUpdateCategory } from "../../hooks/useCategories";
import { Category, Severity } from "../../types";

interface CategoryFormModalProps {
  visible: boolean;
  category?: Category | null;
  onClose: () => void;
}

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  visible,
  category,
  onClose,
}) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [defaultSeverity, setDefaultSeverity] = useState<Severity>("medium");
  const [isActive, setIsActive] = useState(true);

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();

  const isEditing = Boolean(category);

  useEffect(() => {
    if (category) {
      setName(category.name || "");
      setCode(category.code || "");
      setDescription(category.description || "");
      setIcon(category.icon || "");
      setDefaultSeverity(category.defaultSeverity || "medium");
      setIsActive(category.isActive ?? true);
    } else {
      setName("");
      setCode("");
      setDescription("");
      setIcon("");
      setDefaultSeverity("medium");
      setIsActive(true);
    }
  }, [category, visible]);

  const handleSubmit = async () => {
    if (!name.trim() || !code.trim()) {
      RNAlert.alert("Validation Error", "Category Name and Code are required.");
      return;
    }

    try {
      if (isEditing && category) {
        await updateMutation.mutateAsync({
          id: category._id,
          data: {
            name: name.trim(),
            code: code.trim(),
            description: description.trim() || undefined,
            icon: icon.trim() || undefined,
            defaultSeverity,
            isActive,
          },
        });
        RNAlert.alert("Success", "Category updated successfully.");
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          code: code.trim(),
          description: description.trim() || undefined,
          icon: icon.trim() || undefined,
          defaultSeverity,
          isActive,
        });
        RNAlert.alert("Success", "Category created successfully.");
      }
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to save category.";
      RNAlert.alert("Save Error", msg);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Tag size={22} color="#7C3AED" />
              <Text style={styles.title}>
                {isEditing ? "Edit Category" : "Create Category"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContent} showsVerticalScrollIndicator={false}>
            <Input
              label="Category Name *"
              placeholder="e.g. Water Pollution"
              value={name}
              onChangeText={setName}
            />

            <Input
              label="Category Code *"
              placeholder="e.g. water_pollution"
              autoCapitalize="none"
              value={code}
              onChangeText={setCode}
            />

            <Input
              label="Description"
              placeholder="Brief description of this environmental alert category..."
              multiline
              numberOfLines={3}
              value={description}
              onChangeText={setDescription}
            />

            <Input
              label="Icon Name"
              placeholder="e.g. Droplets, Trash2, Wind"
              autoCapitalize="none"
              value={icon}
              onChangeText={setIcon}
            />

            <Text style={styles.label}>Default Severity</Text>
            <View style={styles.sevPickerRow}>
              {(["low", "medium", "high", "critical"] as Severity[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sevChip, defaultSeverity === s && styles.sevChipActive]}
                  onPress={() => setDefaultSeverity(s)}
                >
                  <Text style={[styles.sevChipText, defaultSeverity === s && styles.sevChipTextActive]}>
                    {s.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Active Category Status</Text>
              <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: "#7C3AED" }} />
            </View>

            <Button
              title={isEditing ? "Save Changes" : "Create Category"}
              onPress={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
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
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 8,
  },
  sevPickerRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  sevChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  sevChipActive: {
    borderColor: "#7C3AED",
    backgroundColor: "#F3E8FF",
  },
  sevChipText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.textMuted,
  },
  sevChipTextActive: {
    color: "#7C3AED",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 12,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  submitBtn: {
    marginTop: 14,
    backgroundColor: "#7C3AED",
  },
});
