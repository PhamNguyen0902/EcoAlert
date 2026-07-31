import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert as RNAlert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Users, UserPlus, Shield, UserX, Trash2, Search, CheckCircle, Ban } from "lucide-react-native";
import { useUsers, useToggleUserStatus, useDeleteUser } from "../../hooks/useUsers";
import { UserFormModal } from "../../components/modals/UserFormModal";
import { RolePickerModal } from "../../components/modals/RolePickerModal";
import { GlassCard } from "../../components/ui/GlassCard";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { User, UserRole } from "../../types";

const ROLES: { labelKey: string; fallbackLabel: string; value: string }[] = [
  { labelKey: "admin.all", fallbackLabel: "ALL", value: "ALL" },
  { labelKey: "admin.citizen", fallbackLabel: "CITIZEN", value: "CITIZEN" },
  { labelKey: "admin.officer", fallbackLabel: "OFFICER", value: "OFFICER" },
  { labelKey: "admin.admin", fallbackLabel: "ADMIN", value: "ADMIN" },
];

export const UserManagementScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [activeRoleTab, setActiveRoleTab] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [isUserModalOpen, setUserModalOpen] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<User | null>(null);

  const { data: usersData, isLoading, refetch, isRefetching } = useUsers(
    1,
    50,
    activeRoleTab,
    search.trim() || undefined
  );

  const toggleStatusMutation = useToggleUserStatus();
  const deleteUserMutation = useDeleteUser();

  const users = usersData?.items ?? [];

  const handleToggleStatus = (user: User) => {
    const newStatus = !user.isActive;
    RNAlert.alert(
      "Confirm Action",
      `Are you sure you want to ${newStatus ? "Activate" : "Block"} user "${user.fullName}"?`,
      [
        { text: t("modals.cancel", "Cancel"), style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              await toggleStatusMutation.mutateAsync({ id: user._id, isActive: newStatus });
              RNAlert.alert(t("modals.successTitle", "Success"), `User status updated.`);
            } catch (err: any) {
              const msg = err.response?.data?.message || err.message || "Failed to update status.";
              RNAlert.alert("Error", msg);
            }
          },
        },
      ]
    );
  };

  const handleDeleteUser = (user: User) => {
    RNAlert.alert(
      "Delete User",
      `Are you sure you want to permanently delete "${user.fullName}"? This action cannot be undone.`,
      [
        { text: t("modals.cancel", "Cancel"), style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteUserMutation.mutateAsync(user._id);
              RNAlert.alert("Deleted", "User deleted successfully.");
            } catch (err: any) {
              const msg = err.response?.data?.message || err.message || "Failed to delete user.";
              RNAlert.alert("Error", msg);
            }
          },
        },
      ]
    );
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const roleColor =
      item.role === "ADMIN" ? (isDark ? "#A78BFA" : "#7C3AED") : item.role === "OFFICER" ? (isDark ? "#38BDF8" : "#0284C7") : (isDark ? "#4ADE80" : "#16A34A");

    return (
      <GlassCard style={styles.userCard}>
        <View style={styles.userInfoRow}>
          <View style={[styles.avatarBox, { backgroundColor: isDark ? "rgba(124, 58, 237, 0.2)" : "#F3E8FF" }]}>
            <Text style={[styles.avatarText, { color: isDark ? "#A78BFA" : "#7C3AED" }]}>
              {item.fullName ? item.fullName.charAt(0).toUpperCase() : "U"}
            </Text>
          </View>

          <View style={styles.userDetails}>
            <View style={styles.nameRoleRow}>
              <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                {item.fullName}
              </Text>
              <Badge title={item.role} color={roleColor} style={styles.roleBadge} />
            </View>
            <Text style={[styles.userEmail, { color: colors.textMuted }]} numberOfLines={1}>
              {item.email}
            </Text>
            {item.phone ? <Text style={[styles.userPhone, { color: colors.textMuted }]}>{item.phone}</Text> : null}
          </View>
        </View>

        <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

        <View style={styles.userActionsRow}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: item.isActive ? (isDark ? "rgba(220, 38, 38, 0.2)" : "#FEE2E2") : (isDark ? "rgba(22, 163, 74, 0.2)" : "#DCFCE7") },
            ]}
            onPress={() => handleToggleStatus(item)}
            disabled={toggleStatusMutation.isPending}
          >
            {item.isActive ? (
              <Ban size={14} color={isDark ? "#FCA5A5" : "#DC2626"} />
            ) : (
              <CheckCircle size={14} color={isDark ? "#86EFAC" : "#16A34A"} />
            )}
            <Text style={[styles.actionBtnText, { color: item.isActive ? (isDark ? "#FCA5A5" : "#DC2626") : (isDark ? "#86EFAC" : "#16A34A") }]}>
              {item.isActive ? "Block" : "Activate"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: isDark ? "rgba(124, 58, 237, 0.2)" : "#F3E8FF" }]}
            onPress={() => setSelectedUserForRole(item)}
          >
            <Shield size={14} color={isDark ? "#A78BFA" : "#7C3AED"} />
            <Text style={[styles.actionBtnText, { color: isDark ? "#A78BFA" : "#7C3AED" }]}>Role</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2" }]}
            onPress={() => handleDeleteUser(item)}
            disabled={deleteUserMutation.isPending}
          >
            <Trash2 size={14} color="#EF4444" />
            <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Sticky Header */}
      <View style={[styles.stickyHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTextRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t("admin.userManagementTitle", "User Management")}</Text>
            <Text style={[styles.headerSub, { color: colors.textMuted }]} numberOfLines={1}>
              {t("admin.userManagementSub", "Manage user accounts and roles.")}
            </Text>
          </View>
          <TouchableOpacity style={styles.addUserBtn} onPress={() => setUserModalOpen(true)}>
            <UserPlus size={16} color="#FFFFFF" />
            <Text style={styles.addUserText}>{t("admin.addUser", "Add User")}</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <Input
          placeholder={t("admin.searchUserPlaceholder", "Search users by name or email...")}
          value={search}
          onChangeText={setSearch}
          icon={<Search size={18} color={colors.textMuted} />}
          style={styles.searchInput}
        />

        {/* Role Filter Tabs */}
        <View style={styles.roleTabsRow}>
          {ROLES.map((tab) => {
            const isSelected = activeRoleTab === tab.value;
            return (
              <TouchableOpacity
                key={tab.value}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: isSelected ? (isDark ? "rgba(124, 58, 237, 0.3)" : "#F3E8FF") : colors.background,
                    borderColor: isSelected ? "#7C3AED" : colors.border,
                  },
                ]}
                onPress={() => setActiveRoleTab(tab.value)}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    { color: isSelected ? "#7C3AED" : colors.textMuted },
                  ]}
                >
                  {t(tab.labelKey, tab.fallbackLabel)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* User List */}
      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        renderItem={renderUserItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading || isRefetching} onRefresh={refetch} tintColor="#7C3AED" />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <UserX size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No user accounts found matching query.</Text>
            </View>
          ) : null
        }
      />

      <UserFormModal visible={isUserModalOpen} onClose={() => setUserModalOpen(false)} />
      <RolePickerModal
        visible={Boolean(selectedUserForRole)}
        user={selectedUserForRole}
        onClose={() => setSelectedUserForRole(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  stickyHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  headerTextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  headerSub: { fontSize: 13, marginTop: 2 },
  addUserBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#7C3AED",
  },
  addUserText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  searchInput: { marginBottom: 10 },
  roleTabsRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 4,
  },
  tabChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  tabChipText: { fontSize: 12, fontWeight: "700" },
  listContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 },
  userCard: { marginBottom: 12, padding: 16, borderRadius: 20 },
  userInfoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "800" },
  userDetails: { flex: 1 },
  nameRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  userName: { fontSize: 15, fontWeight: "800", flex: 1 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  userEmail: { fontSize: 13, marginBottom: 2 },
  userPhone: { fontSize: 12 },
  cardDivider: { height: 1, marginVertical: 12 },
  userActionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  actionBtnText: { fontSize: 12, fontWeight: "700" },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 14 },
});


