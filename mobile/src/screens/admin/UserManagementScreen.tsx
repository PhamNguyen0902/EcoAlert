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
import { COLORS } from "../../utils/constants";
import { User, UserRole } from "../../types";

const ROLES: { label: string; value: string }[] = [
  { label: "ALL", value: "ALL" },
  { label: "CITIZEN", value: "CITIZEN" },
  { label: "OFFICER", value: "OFFICER" },
  { label: "ADMIN", value: "ADMIN" },
];

export const UserManagementScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
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
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              await toggleStatusMutation.mutateAsync({ id: user._id, isActive: newStatus });
              RNAlert.alert("Success", `User status updated.`);
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
        { text: "Cancel", style: "cancel" },
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
      item.role === "ADMIN" ? "#7C3AED" : item.role === "OFFICER" ? "#0284C7" : "#16A34A";

    return (
      <GlassCard style={styles.userCard}>
        <View style={styles.userCardHeader}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.fullName}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
            {item.phone ? <Text style={styles.userPhone}>📞 {item.phone}</Text> : null}
          </View>
          <View style={styles.userBadges}>
            <View style={[styles.roleBadge, { backgroundColor: `${roleColor}15` }]}>
              <Text style={[styles.roleBadgeText, { color: roleColor }]}>{item.role}</Text>
            </View>
            <Badge
              label={item.isActive ? "ACTIVE" : "BLOCKED"}
              type="custom"
              bgColor={item.isActive ? "#DCFCE7" : "#FEE2E2"}
              textColor={item.isActive ? "#16A34A" : "#DC2626"}
            />
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setSelectedUserForRole(item)}
          >
            <Shield size={16} color="#7C3AED" />
            <Text style={[styles.actionBtnText, { color: "#7C3AED" }]}>Change Role</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleToggleStatus(item)}
          >
            {item.isActive ? <Ban size={16} color="#EA580C" /> : <CheckCircle size={16} color="#16A34A" />}
            <Text style={[styles.actionBtnText, { color: item.isActive ? "#EA580C" : "#16A34A" }]}>
              {item.isActive ? "Block" : "Activate"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleDeleteUser(item)}
          >
            <Trash2 size={16} color="#DC2626" />
            <Text style={[styles.actionBtnText, { color: "#DC2626" }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Sticky Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Users size={24} color="#7C3AED" />
          <Text style={styles.headerTitle}>User Management</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setUserModalOpen(true)}>
          <UserPlus size={18} color="#FFF" />
          <Text style={styles.addBtnText}>Add User</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search users by name or email..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={18} color={COLORS.textMuted} />}
          style={styles.searchInput}
        />
      </View>

      {/* Role Tabs */}
      <View style={styles.tabsRow}>
        {ROLES.map((tab) => (
          <TouchableOpacity
            key={tab.value}
            style={[styles.tabChip, activeRoleTab === tab.value && styles.tabChipActive]}
            onPress={() => setActiveRoleTab(tab.value)}
          >
            <Text style={[styles.tabChipText, activeRoleTab === tab.value && styles.tabChipTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
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
              <UserX size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No user accounts found matching query.</Text>
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
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#7C3AED",
  },
  addBtnText: { fontSize: 13, fontWeight: "700", color: "#FFF" },
  searchContainer: { paddingHorizontal: 20, paddingTop: 12 },
  searchInput: { marginBottom: 0 },
  tabsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  tabChipActive: { borderColor: "#7C3AED", backgroundColor: "#F3E8FF" },
  tabChipText: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted },
  tabChipTextActive: { color: "#7C3AED" },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  userCard: { marginBottom: 12, padding: 16, borderRadius: 20 },
  userCardHeader: { flexDirection: "row", justifyContent: "space-between" },
  userInfo: { flex: 1, marginRight: 10 },
  userName: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  userEmail: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  userPhone: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  userBadges: { alignItems: "flex-end", gap: 6 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  roleBadgeText: { fontSize: 10, fontWeight: "800" },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  actionBtnText: { fontSize: 12, fontWeight: "700" },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 14, color: COLORS.textMuted },
});
