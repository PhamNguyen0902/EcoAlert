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
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
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
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
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
      RNAlert.alert(t("modals.validationError", "Validation Error"), t("modals.catNameCodeRequired", "Category Name and Code are required."));
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
        RNAlert.alert(t("modals.successTitle", "Success"), t("modals.catUpdatedMsg", "Category updated successfully."));
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          code: code.trim(),
          description: description.trim() || undefined,
          icon: icon.trim() || undefined,
          defaultSeverity,
          isActive,
        });
        RNAlert.alert(t("modals.successTitle", "Success"), t("modals.catCreatedMsg", "Category created successfully."));
      }
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to save category.";
      RNAlert.alert(t("modals.saveError", "Save Error"), msg);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Tag size={22} color={isDark ? "#A78BFA" : "#7C3AED"} />
              <Text style={[styles.title, { color: colors.text }]}>
                {isEditing ? t("modals.editCatTitle", "Edit Category") : t("modals.createCatTitle", "Create Category")}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContent} showsVerticalScrollIndicator={false}>
            <Input
              label={`${t("modals.catName", "Category Name")} *`}
              placeholder="e.g. Water Pollution"
              value={name}
              onChangeText={setName}
            />

            <Input
              label={`${t("modals.catCode", "Category Code")} *`}
              placeholder="e.g. water_pollution"
              autoCapitalize="none"
              value={code}
              onChangeText={setCode}
            />

            <Input
              label={t("modals.description", "Description")}
              placeholder="Brief description of this environmental alert category..."
              multiline
              numberOfLines={3}
              value={description}
              onChangeText={setDescription}
            />

            <Input
              label={t("modals.iconName", "Icon Name")}
              placeholder="e.g. Droplets, Trash2, Wind"
              autoCapitalize="none"
              value={icon}
              onChangeText={setIcon}
            />

            <Text style={[styles.label, { color: colors.text }]}>{t("modals.defaultSeverity", "Default Severity")}</Text>
            <View style={styles.sevPickerRow}>
              {(["low", "medium", "high", "critical"] as Severity[]).map((s) => {
                const isActiveSev = defaultSeverity === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.sevChip,
                      {
                        backgroundColor: isActiveSev ? (isDark ? "rgba(124,58,237,0.3)" : "#F3E8FF") : colors.background,
                        borderColor: isActiveSev ? (isDark ? "#A78BFA" : "#7C3AED") : colors.border,
                      },
                    ]}
                    onPress={() => setDefaultSeverity(s)}
                  >
                    <Text style={[styles.sevChipText, { color: isActiveSev ? (isDark ? "#C4B5FD" : "#7C3AED") : colors.textMuted }]}>
                      {s.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>{t("modals.activeCatStatus", "Active Category Status")}</Text>
              <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: isDark ? "#A78BFA" : "#7C3AED" }} />
            </View>

            <Button
              title={isEditing ? t("modals.saveChangesBtn", "Save Changes") : t("modals.createCatBtn", "Create Category")}
              onPress={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
              style={[styles.submitBtn, { backgroundColor: "#7C3AED" }]}
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
  label: {
    fontSize: 14,
    fontWeight: "600",
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
    alignItems: "center",
  },
  sevChipText: {
    fontSize: 11,
    fontWeight: "800",
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
  },
  submitBtn: {
    marginTop: 14,
  },
});

