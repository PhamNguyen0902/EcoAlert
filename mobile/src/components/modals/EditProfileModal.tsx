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
import { COLORS } from "../../utils/constants";
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
      RNAlert.alert("Validation Error", "Full Name cannot be empty.");
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
      });

      RNAlert.alert("Profile Updated", "Your profile details have been updated successfully.");
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to update profile.";
      RNAlert.alert("Update Error", msg);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <UserCheck size={22} color={COLORS.primary} />
              <Text style={styles.title}>Edit Profile Information</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <Input
            label="Full Name *"
            placeholder="Your full name"
            value={fullName}
            onChangeText={setFullName}
          />

          <Input
            label="Phone Number"
            placeholder="e.g. 0912345678"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <Button
            title="Save Profile"
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
