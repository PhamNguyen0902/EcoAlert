import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import { X, UserCheck, ShieldCheck, RefreshCw, AlertCircle, Check } from "lucide-react-native";
import { Button } from "../ui/Button";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import type { User } from "../../types";

interface OfficerPickerModalProps {
  visible: boolean;
  officers: User[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  isAssigning?: boolean;
  errorMessage?: string;
  onClose: () => void;
  onRetry?: () => void;
  onAssign: (officer: User) => void;
}

export const OfficerPickerModal: React.FC<OfficerPickerModalProps> = ({
  visible,
  officers,
  isLoading = false,
  isRefreshing = false,
  isAssigning = false,
  errorMessage,
  onClose,
  onRetry,
  onAssign,
}) => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [selectedOfficerId, setSelectedOfficerId] = useState<string | null>(null);

  useEffect(() => {
    if (visible && officers.length > 0 && !selectedOfficerId) {
      setSelectedOfficerId(officers[0]._id);
    }
  }, [visible, officers, selectedOfficerId]);

  const selectedOfficer = officers.find((o) => o._id === selectedOfficerId) || null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <UserCheck size={22} color={colors.primary} />
              <View>
                <Text style={[styles.title, { color: colors.text }]}>{t("modals.assignOfficerTitle", "Phân công Cán bộ")}</Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                  {t("modals.assignOfficerSub", "Chọn Cán bộ chịu trách nhiệm theo dõi và xử lý sự cố này.")}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.stateText, { color: colors.textMuted }]}>{t("modals.loadingOfficers", "Đang tải danh sách Cán bộ...")}</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.stateBox}>
              <AlertCircle size={32} color={colors.destructive} />
              <Text style={[styles.errorTitle, { color: colors.text }]}>{t("modals.errorLoadingOfficers", "Không thể tải danh sách")}</Text>
              <Text style={[styles.stateText, { color: colors.textMuted }]}>{errorMessage}</Text>
              {onRetry ? (
                <Button
                  title={t("modals.retry", "Thử lại")}
                  onPress={onRetry}
                  variant="outline"
                  loading={isRefreshing}
                  style={styles.retryBtn}
                  icon={<RefreshCw size={16} color={colors.primary} style={{ marginRight: 6 }} />}
                />
              ) : null}
            </View>
          ) : officers.length === 0 ? (
            <View style={styles.stateBox}>
              <AlertCircle size={32} color={colors.textMuted} />
              <Text style={[styles.errorTitle, { color: colors.text }]}>{t("modals.noOfficersFound", "Chưa có Cán bộ trong hệ thống")}</Text>
              <Text style={[styles.stateText, { color: colors.textMuted }]}>
                {t("modals.createOfficerFirst", "Hãy tạo tài khoản Cán bộ (OFFICER) trong Quản lý người dùng trước.")}
              </Text>
            </View>
          ) : (
            <>
              <FlatList
                data={officers}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                style={styles.list}
                renderItem={({ item }) => {
                  const selected = selectedOfficerId === item._id;
                  const inactive = item.isActive === false;

                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.officerRow,
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? (isDark ? "rgba(34,197,94,0.2)" : colors.primaryLight) : colors.surface,
                        },
                      ]}
                      onPress={() => setSelectedOfficerId(item._id)}
                    >
                      <View style={[styles.officerAvatar, { backgroundColor: colors.background }]}>
                        <ShieldCheck size={22} color={selected ? colors.primary : colors.textMuted} />
                      </View>
                      <View style={styles.officerMeta}>
                        <Text style={[styles.officerName, { color: colors.text }]}>{item.fullName}</Text>
                        <Text style={[styles.officerEmail, { color: colors.textMuted }]}>{item.email}</Text>
                        {inactive ? <Text style={[styles.inactiveLabel, { color: colors.destructive }]}>Vô hiệu hóa</Text> : null}
                      </View>
                      <View style={[styles.radioOuter, { borderColor: selected ? colors.primary : colors.border }]}>
                        {selected ? <Check size={14} color={colors.primary} /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />

              <Button
                title={t("modals.confirmAssignBtn", "Xác nhận phân công")}
                onPress={() => selectedOfficer && onAssign(selectedOfficer)}
                loading={isAssigning}
                disabled={!selectedOfficer}
                style={styles.submitBtn}
              />
            </>
          )}
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
    maxHeight: "80%",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: "row",
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  title: { fontSize: 18, fontWeight: "800" },
  subtitle: { maxWidth: 290, marginTop: 4, fontSize: 13, lineHeight: 18 },
  closeBtn: { padding: 4 },
  list: { marginBottom: 16, maxHeight: 320 },
  stateBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 10,
  },
  errorTitle: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  stateText: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  retryBtn: { marginTop: 6 },
  officerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 10,
    gap: 12,
  },
  officerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  officerMeta: { flex: 1 },
  officerName: { fontSize: 14, fontWeight: "700" },
  officerEmail: { marginTop: 2, fontSize: 12 },
  inactiveLabel: { marginTop: 3, fontSize: 11, fontWeight: "700" },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtn: { marginTop: 4 },
});

