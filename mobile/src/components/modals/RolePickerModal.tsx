import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert as RNAlert,
} from "react-native";
import { X, Shield } from "lucide-react-native";
import { Button } from "../ui/Button";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChangeRole } from "../../hooks/useUsers";
import { User, UserRole } from "../../types";

interface RolePickerModalProps {
  visible: boolean;
  user: User | null;
  onClose: () => void;
}

export const RolePickerModal: React.FC<RolePickerModalProps> = ({
  visible,
  user,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [selectedRole, setSelectedRole] = useState<UserRole>(user?.role || "CITIZEN");
  const changeRoleMutation = useChangeRole();

  React.useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
    }
  }, [user]);

  if (!user) return null;

  const handleSaveRole = async () => {
    if (selectedRole === user.role) {
      onClose();
      return;
    }

    try {
      await changeRoleMutation.mutateAsync({
        id: user._id,
        role: selectedRole,
      });
      RNAlert.alert(t("modals.successTitle", "Thành công"), `Vai trò người dùng được cập nhật thành ${selectedRole}.`);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to update role.";
      RNAlert.alert("Lỗi cập nhật vai trò", msg);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Shield size={22} color={isDark ? "#A78BFA" : "#7C3AED"} />
              <Text style={[styles.title, { color: colors.text }]}>{t("modals.changeRoleTitle", "Change User Role")}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.userName, { color: colors.text }]}>{user.fullName}</Text>
          <Text style={[styles.userEmail, { color: colors.textMuted }]}>{user.email}</Text>

          <Text style={[styles.label, { color: colors.text }]}>{t("modals.selectNewRole", "Select New Role:")}</Text>
          <View style={styles.rolePickerRow}>
            {(["CITIZEN", "OFFICER", "ADMIN"] as UserRole[]).map((r) => {
              const isActive = selectedRole === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.roleChip,
                    {
                      backgroundColor: isActive ? (isDark ? "rgba(124,58,237,0.3)" : "#F3E8FF") : colors.background,
                      borderColor: isActive ? (isDark ? "#A78BFA" : "#7C3AED") : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedRole(r)}
                >
                  <Text style={[styles.roleChipText, { color: isActive ? (isDark ? "#C4B5FD" : "#7C3AED") : colors.textMuted }]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Button
            title={t("modals.updateRoleBtn", "Update Role")}
            onPress={handleSaveRole}
            loading={changeRoleMutation.isPending}
            style={[styles.submitBtn, { backgroundColor: "#7C3AED" }]}
          />
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
    padding: 24,
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
  userName: {
    fontSize: 16,
    fontWeight: "700",
  },
  userEmail: {
    fontSize: 13,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  rolePickerRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  submitBtn: {},
});

