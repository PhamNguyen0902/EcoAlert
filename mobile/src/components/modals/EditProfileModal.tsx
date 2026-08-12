import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert as RNAlert,
} from "react-native";
import { X, UserCheck } from "lucide-react-native";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useTheme } from "../../context/ThemeContext";
import { useUpdateProfile } from "../../hooks/useUsers";
import { User } from "../../types";

interface EditProfileModalProps {
  visible: boolean;
  user: User | null;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  user,
  onClose,
}) => {
  const { colors } = useTheme();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const updateProfileMutation = useUpdateProfile();

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "");
      setPhone(user.phone || "");
    }
  }, [user, visible]);

  if (!user) return null;

  const handleSave = async () => {
    if (!fullName.trim()) {
      RNAlert.alert("Lỗi xác thực", "Họ và tên không được để trống.");
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
      });

      RNAlert.alert("Cập nhật hồ sơ", "Chi tiết hồ sơ của bạn đã được cập nhật thành công.");
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to update profile.";
      RNAlert.alert("Lỗi cập nhật", msg);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <UserCheck size={22} color={colors.primary} />
              <Text style={[styles.title, { color: colors.text }]}>Chỉnh sửa thông tin hồ sơ</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Input
            label="Họ và tên *"
            placeholder="Họ và tên của bạn"
            value={fullName}
            onChangeText={setFullName}
          />

          <Input
            label="Số điện thoại"
            placeholder="VD: 0912345678"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <Button
            title="Lưu hồ sơ"
            onPress={handleSave}
            loading={updateProfileMutation.isPending}
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

