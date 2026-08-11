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
import { useTheme } from "../../context/ThemeContext";
import { useChangePassword } from "../../hooks/useUsers";

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePasswordMutation = useChangePassword();

  const handleSave = async () => {
    if (!oldPassword || !newPassword) {
      RNAlert.alert("Lỗi xác thực", "Vui lòng điền đầy đủ các trường mật khẩu.");
      return;
    }
    if (newPassword.length < 6) {
      RNAlert.alert("Lỗi xác thực", "Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      RNAlert.alert("Lỗi xác thực", "Mật khẩu mới không khớp.");
      return;
    }

    try {
      await changePasswordMutation.mutateAsync({
        oldPassword,
        newPassword,
      });

      RNAlert.alert("Đổi mật khẩu thành công", "Mật khẩu của bạn đã được thay đổi thành công.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to change password.";
      RNAlert.alert("Lỗi mật khẩu", msg);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <KeyRound size={22} color={colors.primary} />
              <Text style={[styles.title, { color: colors.text }]}>Đổi mật khẩu</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Input
            label="Mật khẩu hiện tại *"
            placeholder="Nhập mật khẩu hiện tại"
            secureTextEntry
            value={oldPassword}
            onChangeText={setOldPassword}
          />

          <Input
            label="Mật khẩu mới *"
            placeholder="Ít nhất 6 ký tự"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />

          <Input
            label="Xác nhận mật khẩu mới *"
            placeholder="Nhập lại mật khẩu mới"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <Button
            title="Cập nhật mật khẩu"
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
  },
  closeBtn: {
    padding: 6,
  },
  submitBtn: {
    marginTop: 16,
  },
});

