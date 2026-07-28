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
import { COLORS } from "../../utils/constants";
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
      RNAlert.alert("Success", `User role updated to ${selectedRole}.`);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to update role.";
      RNAlert.alert("Role Update Error", msg);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Shield size={22} color="#7C3AED" />
              <Text style={styles.title}>Change User Role</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.userName}>{user.fullName}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>

          <Text style={styles.label}>Select New Role:</Text>
          <View style={styles.rolePickerRow}>
            {(["CITIZEN", "OFFICER", "ADMIN"] as UserRole[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.roleChip, selectedRole === r && styles.roleChipActive]}
                onPress={() => setSelectedRole(r)}
              >
                <Text style={[styles.roleChipText, selectedRole === r && styles.roleChipTextActive]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button
            title="Update Role"
            onPress={handleSaveRole}
            loading={changeRoleMutation.isPending}
            style={styles.submitBtn}
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
    backgroundColor: COLORS.surface,
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
    color: COLORS.text,
  },
  closeBtn: {
    padding: 6,
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  userEmail: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
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
    borderColor: COLORS.border,
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  roleChipActive: {
    borderColor: "#7C3AED",
    backgroundColor: "#F3E8FF",
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  roleChipTextActive: {
    color: "#7C3AED",
  },
  submitBtn: {
    backgroundColor: "#7C3AED",
  },
});
