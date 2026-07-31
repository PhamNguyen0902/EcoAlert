import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert as RNAlert,
} from "react-native";
import { X, UserPlus } from "lucide-react-native";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useCreateUser } from "../../hooks/useUsers";
import { UserRole } from "../../types";

interface UserFormModalProps {
  visible: boolean;
  onClose: () => void;
}

export const UserFormModal: React.FC<UserFormModalProps> = ({ visible, onClose }) => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("CITIZEN");

  const createUserMutation = useCreateUser();

  const handleCreate = async () => {
    if (!email.trim() || !fullName.trim() || !password.trim()) {
      RNAlert.alert(t("modals.validationError", "Validation Error"), t("modals.fillRequiredUserFields", "Please fill in Email, Full Name, and Password."));
      return;
    }

    try {
      await createUserMutation.mutateAsync({
        email: email.trim(),
        fullName: fullName.trim(),
        password: password.trim(),
        phone: phone.trim() || undefined,
        role,
      });
      RNAlert.alert(t("modals.successTitle", "Success"), t("modals.userCreatedMsg", "User account created successfully."));
      setEmail("");
      setFullName("");
      setPassword("");
      setPhone("");
      setRole("CITIZEN");
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to create user.";
      RNAlert.alert(t("modals.creationError", "Creation Error"), msg);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <UserPlus size={22} color={isDark ? "#A78BFA" : "#7C3AED"} />
              <Text style={[styles.title, { color: colors.text }]}>{t("modals.createUserTitle", "Create New User")}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContent} showsVerticalScrollIndicator={false}>
            <Input
              label={`${t("auth.fullNameLabel", "Full Name")} *`}
              placeholder="e.g. Nguyen Van A"
              value={fullName}
              onChangeText={setFullName}
            />

            <Input
              label={`${t("auth.emailLabel", "Email Address")} *`}
              placeholder="e.g. user@ecoalert.org"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <Input
              label={`${t("modals.initialPassword", "Initial Password")} *`}
              placeholder="Minimum 6 characters"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <Input
              label={t("modals.phoneNumber", "Phone Number")}
              placeholder="e.g. 0912345678"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <Text style={[styles.label, { color: colors.text }]}>{t("modals.selectRole", "Select Role *")}</Text>
            <View style={styles.rolePickerRow}>
              {(["CITIZEN", "OFFICER", "ADMIN"] as UserRole[]).map((r) => {
                const isActive = role === r;
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
                    onPress={() => setRole(r)}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        { color: isActive ? (isDark ? "#C4B5FD" : "#7C3AED") : colors.textMuted },
                      ]}
                    >
                      {r}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Button
              title={t("modals.createAccountBtn", "Create Account")}
              onPress={handleCreate}
              loading={createUserMutation.isPending}
              style={[styles.submitBtn, { backgroundColor: isDark ? "#7C3AED" : "#7C3AED" }]}
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
    marginTop: 12,
  },
  rolePickerRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  submitBtn: {
    marginTop: 10,
  },
});

