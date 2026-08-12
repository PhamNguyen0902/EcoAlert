import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Activity, Search, ShieldAlert } from "lucide-react-native";
import { useAuditLogs } from "../../hooks/useUsers";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { useTheme } from "../../context/ThemeContext";
import { AuditLog } from "../../types";
import { format } from "date-fns";

export const AuditLogsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [search, setSearch] = useState("");

  const { data: auditData, isLoading, refetch, isRefetching } = useAuditLogs(
    1,
    50,
    search.trim() || undefined
  );

  const auditLogs = auditData?.items ?? [];

  const renderAuditItem = ({ item }: { item: AuditLog }) => {
    const userDisplay = typeof item.userId === "object" ? item.userId.fullName : item.userId || "System";

    return (
      <GlassCard style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={[styles.actionText, { color: isDark ? "#A78BFA" : "#7C3AED" }]}>{item.action}</Text>
          <Text style={[styles.dateText, { color: colors.textMuted }]}>
            {item.createdAt ? format(new Date(item.createdAt), "MMM d, HH:mm") : ""}
          </Text>
        </View>

        <Text style={[styles.userText, { color: colors.text }]}>Thực hiện bởi: {userDisplay}</Text>
        {item.entity ? <Text style={[styles.entityText, { color: colors.textMuted }]}>Đối tượng mục tiêu: {item.entity}</Text> : null}
        {item.ipAddress ? <Text style={[styles.ipText, { color: colors.textMuted }]}>IP: {item.ipAddress}</Text> : null}
      </GlassCard>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleRow}>
          <Activity size={24} color={isDark ? "#A78BFA" : "#7C3AED"} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Nhật ký kiểm toán hệ thống</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Input
          placeholder="Tìm kiếm thao tác kiểm toán, người dùng..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={18} color={colors.textMuted} />}
          style={styles.searchInput}
        />
      </View>

      <FlatList
        data={auditLogs}
        keyExtractor={(item) => item._id}
        renderItem={renderAuditItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading || isRefetching} onRefresh={refetch} tintColor="#7C3AED" />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <ShieldAlert size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Không có nhật ký kiểm toán phù hợp.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  searchContainer: { paddingHorizontal: 20, paddingTop: 12 },
  searchInput: { marginBottom: 0 },
  listContent: { padding: 20, paddingBottom: 40 },
  card: { marginBottom: 12, padding: 16, borderRadius: 18 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  actionText: { fontSize: 15, fontWeight: "800" },
  dateText: { fontSize: 12 },
  userText: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  entityText: { fontSize: 12, marginTop: 2 },
  ipText: { fontSize: 11, marginTop: 4 },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 14 },
});

