import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckSquare, AlertCircle, MapPin } from "lucide-react-native";
import { useOfficerTasks } from "../../hooks/useAlerts";
import { GlassCard } from "../../components/ui/GlassCard";
import { Badge } from "../../components/ui/Badge";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { SEVERITY_COLORS } from "../../utils/constants";
import { Alert } from "../../types";
import { getCategoryLabel, getSeverityLabel, getStatusLabel } from "../../utils/incidentPresentation";

const STATUS_TABS = [
  { value: undefined }, { value: "PENDING" }, { value: "IN_PROGRESS" }, { value: "RESOLVED" },
];

export const OfficerTasksScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);

  const { data: tasksData, isLoading, refetch, isRefetching } = useOfficerTasks(
    1,
    50,
    selectedStatus
  );

  const tasks = tasksData?.items ?? [];

  const renderTaskItem = ({ item }: { item: Alert }) => {
    const sevColor = SEVERITY_COLORS[item.severity ?? "low"] || { bg: "#F1F5F9", text: "#475569" };

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate("OfficerAlertDetail", { id: item._id })}
      >
        <GlassCard style={styles.taskCard}>
          <View style={styles.cardHeader}>
            <Badge
              label={getCategoryLabel(item.category, language)}
              type="custom"
              bgColor={isDark ? "rgba(59, 130, 246, 0.25)" : "#DBEAFE"}
              textColor={isDark ? "#60A5FA" : colors.secondary}
            />
            <View style={[styles.sevBadge, { backgroundColor: sevColor.bg }]}>
              <Text style={[styles.sevBadgeText, { color: sevColor.text }]}>
                {getSeverityLabel(item.severity, language)}
              </Text>
            </View>
            <Badge label={getStatusLabel(item.status, language)} statusValue={item.status} type="status" />
          </View>

          <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>

          <Text style={[styles.taskDesc, { color: colors.textMuted }]} numberOfLines={2}>
            {item.description}
          </Text>

          <View style={styles.locationRow}>
            <MapPin size={14} color={isDark ? "#60A5FA" : colors.secondary} />
            <Text style={[styles.locationText, { color: isDark ? "#60A5FA" : colors.secondary }]} numberOfLines={1}>
              {item.address || (language === "vi" ? "Vị trí GPS chưa có địa chỉ" : "GPS geotag location")}
            </Text>
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleRow}>
          <CheckSquare size={24} color={isDark ? "#60A5FA" : colors.secondary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Các tác vụ sự cố được giao</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {STATUS_TABS.map((tab) => {
          const isActive = selectedStatus === tab.value;
          return (
            <TouchableOpacity
              key={tab.value || "ALL"}
              style={[
                styles.tabChip,
                { borderColor: isActive ? colors.secondary : colors.border, backgroundColor: isActive ? (isDark ? "rgba(59, 130, 246, 0.3)" : "#DBEAFE") : colors.surface },
              ]}
              onPress={() => setSelectedStatus(tab.value)}
            >
              <Text style={[styles.tabChipText, { color: isActive ? (isDark ? "#93C5FD" : colors.secondary) : colors.textMuted }]}>
                {tab.value ? getStatusLabel(tab.value, language) : language === "vi" ? "Tất cả" : "All"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item._id}
        renderItem={renderTaskItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading || isRefetching} onRefresh={refetch} tintColor={colors.secondary} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <AlertCircle size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Không có tác vụ được giao</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Hiện không có báo cáo sự cố nào được giao cho tài khoản Cán bộ của bạn. Khi Quản trị viên giao báo cáo cho bạn, nó sẽ xuất hiện ở đây.
              </Text>
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
  tabsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabChipText: { fontSize: 11, fontWeight: "700" },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  taskCard: { marginBottom: 14, padding: 16, borderRadius: 20 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" },
  sevBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  sevBadgeText: { fontSize: 9, fontWeight: "800" },
  taskTitle: { fontSize: 16, fontWeight: "800", marginBottom: 4 },
  taskDesc: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationText: { fontSize: 12, flex: 1, fontWeight: "600" },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 12 },
  emptyText: { marginTop: 6, fontSize: 13, textAlign: "center", lineHeight: 18 },
});

