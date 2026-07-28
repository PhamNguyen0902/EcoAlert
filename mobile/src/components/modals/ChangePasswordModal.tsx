import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert as RNAlert,
} from "react-native";
import { X, KeyRound } from "lucide-react-native";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { COLORS } from "../../utils/constants";
import { useChangePassword } from "../../hooks/useUsers";

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  visible,
  onClose,
}) => {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePasswordMutation = useChangePassword();

  const handleSave = async () => {
    if (!oldPassword || !newPassword) {
      RNAlert.alert("Validation Error", "Please fill in all password fields.");
      return;
    }
    if (newPassword.length < 6) {
      RNAlert.alert("Validation Error", "New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      RNAlert.alert("Validation Error", "New passwords do not match.");
      return;
    }

    try {
      await changePasswordMutation.mutateAsync({
        oldPassword,
        newPassword,
      });

      RNAlert.alert("Password Changed", "Your password has been changed successfully.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to change password.";
      RNAlert.alert("Password Error", msg);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <KeyRound size={22} color={COLORS.primary} />
              <Text style={styles.title}>Change Password</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <Input
            label="Current Password *"
            placeholder="Enter current password"
            secureTextEntry
            value={oldPassword}
            onChangeText={setOldPassword}
          />

          <Input
            label="New Password *"
            placeholder="At least 6 characters"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />

          <Input
            label="Confirm New Password *"
            placeholder="Re-enter new password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <Button
            title="Update Password"
            onPress={handleSave}
            loading={changePasswordMutation.isPending}
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
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  closeBtn: {
    padding: 6,
  },
  submitBtn: {
    marginTop: 16,
  },
});
