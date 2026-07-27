import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Check, ShieldCheck, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { User } from "../../types";
import { COLORS } from "../../utils/constants";
import { Button } from "../ui/Button";

interface OfficerPickerModalProps {
  visible: boolean;
  officers: User[];
  isLoading: boolean;
  isRefreshing: boolean;
  isAssigning: boolean;
  errorMessage?: string;
  onClose: () => void;
  onRetry: () => void;
  onAssign: (officer: User) => void;
}

export const OfficerPickerModal: React.FC<OfficerPickerModalProps> = ({
  visible,
  officers,
  isLoading,
  isRefreshing,
  isAssigning,
  errorMessage,
  onClose,
  onRetry,
  onAssign,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>();
  const selectedOfficer = useMemo(
    () => officers.find((officer) => officer._id === selectedOfficerId),
    [officers, selectedOfficerId],
  );

  useEffect(() => {
    if (!visible) setSelectedOfficerId(undefined);
  }, [visible]);

  const close = () => {
    if (!isAssigning) onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={close}
    >
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Assign to Officer</Text>
              <Text style={styles.subtitle}>Select the Officer who will handle this incident.</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close Officer picker"
              disabled={isAssigning}
              onPress={close}
              style={styles.closeButton}
            >
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.stateText}>Loading Officers...</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.stateContainer}>
              <Text style={styles.errorTitle}>Unable to load Officers</Text>
              <Text style={styles.stateText}>{errorMessage}</Text>
              <Button title="Try Again" variant="outline" size="sm" onPress={onRetry} />
            </View>
          ) : officers.length === 0 ? (
            <View style={styles.stateContainer}>
              <Text style={styles.errorTitle}>No Officers available</Text>
              <Text style={styles.stateText}>Create or activate an Officer account before assigning this incident.</Text>
            </View>
          ) : (
            <FlatList
              data={officers}
              keyExtractor={(officer) => officer._id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              refreshing={isRefreshing}
              onRefresh={onRetry}
              renderItem={({ item }) => {
                const selected = item._id === selectedOfficerId;
                const active = item.isActive !== false;
                return (
                  <TouchableOpacity
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled: !active }}
                    disabled={!active || isAssigning}
                    activeOpacity={0.75}
                    onPress={() => setSelectedOfficerId(item._id)}
                    style={[
                      styles.officerRow,
                      selected && styles.officerRowSelected,
                      !active && styles.officerRowDisabled,
                    ]}
                  >
                    <View style={[styles.avatar, selected && styles.avatarSelected]}>
                      <ShieldCheck size={22} color={selected ? COLORS.primary : COLORS.textMuted} />
                    </View>
                    <View style={styles.officerDetails}>
                      <Text style={styles.officerName}>{item.fullName}</Text>
                      <Text style={styles.officerEmail} numberOfLines={1}>{item.email}</Text>
                      {!active ? <Text style={styles.inactiveLabel}>Inactive account</Text> : null}
                    </View>
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected ? <Check size={15} color="#FFFFFF" /> : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <View style={styles.actions}>
            <Button
              title="Cancel"
              variant="outline"
              disabled={isAssigning}
              onPress={close}
              style={styles.actionButton}
            />
            <Button
              title="Assign Officer"
              loading={isAssigning}
              disabled={!selectedOfficer}
              onPress={() => selectedOfficer && onAssign(selectedOfficer)}
              style={styles.actionButton}
              icon={<ShieldCheck size={18} color="#FFFFFF" />}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.52)",
  },
  sheet: {
    maxHeight: "82%",
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handle: {
    width: 44,
    height: 5,
    alignSelf: "center",
    marginBottom: 16,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  subtitle: { maxWidth: 290, marginTop: 4, fontSize: 13, lineHeight: 18, color: COLORS.textMuted },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: COLORS.background,
  },
  stateContainer: {
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  errorTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, textAlign: "center" },
  stateText: { fontSize: 13, lineHeight: 19, color: COLORS.textMuted, textAlign: "center" },
  list: { maxHeight: 390 },
  listContent: { gap: 10, paddingBottom: 6 },
  officerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
  },
  officerRowSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  officerRowDisabled: { opacity: 0.48 },
  avatar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: COLORS.background,
  },
  avatarSelected: { backgroundColor: "#FFFFFF" },
  officerDetails: { flex: 1 },
  officerName: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  officerEmail: { marginTop: 2, fontSize: 12, color: COLORS.textMuted },
  inactiveLabel: { marginTop: 3, fontSize: 11, fontWeight: "700", color: COLORS.destructive },
  radio: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  radioSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  actions: { flexDirection: "row", gap: 12, paddingTop: 16 },
  actionButton: { flex: 1 },
});
