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
import { COLORS } from "../../utils/constants";
import { AuditLog } from "../../types";
import { format } from "date-fns";

export const AuditLogsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
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
          <Text style={styles.actionText}>{item.action}</Text>
          <Text style={styles.dateText}>
            {item.createdAt ? format(new Date(item.createdAt), "MMM d, HH:mm") : ""}
          </Text>
        </View>

        <Text style={styles.userText}>Performed by: {userDisplay}</Text>
        {item.entity ? <Text style={styles.entityText}>Target Entity: {item.entity}</Text> : null}
        {item.ipAddress ? <Text style={styles.ipText}>IP: {item.ipAddress}</Text> : null}
      </GlassCard>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Activity size={24} color="#7C3AED" />
          <Text style={styles.headerTitle}>System Audit Logs</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Input
          placeholder="Search audit actions, users..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={18} color={COLORS.textMuted} />}
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
              <ShieldAlert size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No audit logs matching query.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  searchContainer: { paddingHorizontal: 20, paddingTop: 12 },
  searchInput: { marginBottom: 0 },
  listContent: { padding: 20, paddingBottom: 40 },
  card: { marginBottom: 12, padding: 16, borderRadius: 18 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  actionText: { fontSize: 15, fontWeight: "800", color: "#7C3AED" },
  dateText: { fontSize: 12, color: COLORS.textMuted },
  userText: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginTop: 2 },
  entityText: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  ipText: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 14, color: COLORS.textMuted },
});
