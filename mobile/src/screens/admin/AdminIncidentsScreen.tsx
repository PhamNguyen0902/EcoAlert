import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AlertTriangle, ChevronRight, Filter, MapPin, ShieldCheck } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Alert as Incident } from "../../types";
import { useAlerts, useCategories } from "../../hooks/useAlerts";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { SEVERITY_COLORS, STATUS_COLORS } from "../../utils/constants";
import { getCategoryLabel, getSeverityLabel, getStatusLabel } from "../../utils/incidentPresentation";

const STATUS_FILTERS = ["ALL", "ACTIVE", "PENDING", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const SEVERITY_FILTERS = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const AdminIncidentsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [severity, setSeverity] = useState<(typeof SEVERITY_FILTERS)[number]>("ALL");
  const [category, setCategory] = useState("ALL");
  const [page, setPage] = useState(1);
  const categories = useCategories();
  const filters = useMemo<Record<string, string>>(() => ({
    ...(status !== "ALL" ? { status: status.toLowerCase() } : {}),
    ...(severity !== "ALL" ? { severity: severity.toLowerCase() } : {}),
    ...(category !== "ALL" ? { category } : {}),
  }), [category, severity, status]);
  const incidents = useAlerts(page, 20, filters);
  const rows = incidents.data?.items ?? [];
  const copy = language === "vi"
    ? {
        title: "Sự cố", subtitle: "Xem xét, phân loại và điều phối sự cố", filters: "Bộ lọc", all: "Tất cả",
        active: "Đang mở", loading: "Đang tải sự cố…", empty: "Không có sự cố phù hợp", retry: "Thử lại",
        loadMore: "Tải thêm", page: "Trang", location: "Chưa có địa chỉ", details: "Xem chi tiết",
      }
    : {
        title: "Incidents", subtitle: "Review, classify, and route incidents", filters: "Filters", all: "All",
        active: "Active", loading: "Loading incidents…", empty: "No incidents match these filters", retry: "Retry",
        loadMore: "Load more", page: "Page", location: "Address unavailable", details: "View details",
      };

  const selectStatus = (next: (typeof STATUS_FILTERS)[number]) => { setPage(1); setStatus(next); };
  const selectSeverity = (next: (typeof SEVERITY_FILTERS)[number]) => { setPage(1); setSeverity(next); };
  const selectCategory = (next: string) => { setPage(1); setCategory(next); };
  const labelForStatus = (value: string) => value === "ALL" ? copy.all : value === "ACTIVE" ? copy.active : getStatusLabel(value, language);

  const renderFilter = (label: string, selected: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, { borderColor: selected ? "#7C3AED" : colors.border, backgroundColor: selected ? (isDark ? "rgba(124,58,237,0.30)" : "#F3E8FF") : colors.surface }]}
    >
      <Text style={[styles.chipText, { color: selected ? (isDark ? "#DDD6FE" : "#6D28D9") : colors.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: Incident }) => {
    const normalizedStatus = item.status?.toUpperCase() || "PENDING";
    const statusColor = (isDark ? STATUS_COLORS : STATUS_COLORS)[normalizedStatus] ?? STATUS_COLORS.PENDING;
    const severityKey = item.severity?.toUpperCase() || "LOW";
    const severityColor = SEVERITY_COLORS[severityKey] ?? SEVERITY_COLORS.low;
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => navigation.getParent?.()?.navigate("AlertDetail", { id: item._id })}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${normalizedStatus}. ${copy.details}`}
      >
        <Card style={styles.incidentCard}>
          <View style={styles.cardTop}>
            <Badge label={getStatusLabel(normalizedStatus, language)} type="custom" bgColor={statusColor.bg} textColor={statusColor.text} />
            <Badge label={getSeverityLabel(severityKey, language)} type="custom" bgColor={severityColor.bg} textColor={severityColor.text} />
          </View>
          <Text style={[styles.incidentTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
          <Text style={[styles.incidentDescription, { color: colors.textMuted }]} numberOfLines={2}>{item.description}</Text>
          <View style={styles.metaRow}>
            <MapPin size={14} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>{item.address || copy.location}</Text>
            <ChevronRight size={17} color="#7C3AED" />
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{copy.subtitle}</Text>
        </View>
        <View style={[styles.filterIcon, { backgroundColor: isDark ? "rgba(124,58,237,0.30)" : "#F3E8FF" }]}><Filter size={19} color="#7C3AED" /></View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={incidents.isRefetching} onRefresh={() => incidents.refetch()} tintColor="#7C3AED" />}
        ListHeaderComponent={
          <View style={styles.filterGroups}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>{copy.filters}</Text>
            <FlatList horizontal data={[...STATUS_FILTERS]} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} renderItem={({ item }) => renderFilter(labelForStatus(item), status === item, () => selectStatus(item))} />
            <FlatList horizontal data={[...SEVERITY_FILTERS]} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} renderItem={({ item }) => renderFilter(item === "ALL" ? copy.all : getSeverityLabel(item, language), severity === item, () => selectSeverity(item))} />
            <FlatList horizontal data={["ALL", ...(categories.data ?? []).filter((item) => item.isActive).map((item) => item.code)]} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} renderItem={({ item }) => renderFilter(item === "ALL" ? copy.all : getCategoryLabel(item, language), category === item, () => selectCategory(item))} />
          </View>
        }
        ListEmptyComponent={
          incidents.isLoading ? <View style={styles.state}><ActivityIndicator color="#7C3AED" /><Text style={[styles.stateText, { color: colors.textMuted }]}>{copy.loading}</Text></View> :
            <View style={styles.state}><AlertTriangle size={38} color={colors.textMuted} /><Text style={[styles.stateText, { color: colors.text }]}>{incidents.isError ? copy.retry : copy.empty}</Text>{incidents.isError ? <TouchableOpacity onPress={() => incidents.refetch()}><Text style={{ color: "#7C3AED", fontWeight: "800" }}>{copy.retry}</Text></TouchableOpacity> : null}</View>
        }
        ListFooterComponent={incidents.data && page < incidents.data.totalPages ? <TouchableOpacity style={[styles.loadMore, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => setPage((value) => value + 1)}><Text style={{ color: "#7C3AED", fontWeight: "800" }}>{copy.loadMore} · {copy.page} {page + 1}</Text></TouchableOpacity> : null}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { minHeight: 76, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth }, headerCopy: { flex: 1 }, title: { fontSize: 22, fontWeight: "800" }, subtitle: { fontSize: 12, marginTop: 3 }, filterIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" }, content: { padding: 16, paddingBottom: 36, flexGrow: 1 }, filterGroups: { marginBottom: 10 }, filterLabel: { fontSize: 14, fontWeight: "800", marginBottom: 8 }, chipRow: { gap: 8, paddingBottom: 8, paddingRight: 16 }, chip: { minHeight: 36, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" }, chipText: { fontSize: 11, fontWeight: "800", textTransform: "capitalize" }, incidentCard: { borderRadius: 18, padding: 15, marginBottom: 11 }, cardTop: { flexDirection: "row", gap: 7, flexWrap: "wrap", marginBottom: 10 }, incidentTitle: { fontSize: 16, fontWeight: "800", lineHeight: 21 }, incidentDescription: { fontSize: 12, lineHeight: 18, marginTop: 5 }, metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 }, metaText: { flex: 1, fontSize: 11, fontWeight: "600" }, state: { minHeight: 320, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 28 }, stateText: { fontSize: 14, textAlign: "center", fontWeight: "700" }, loadMore: { minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 14, marginTop: 4 },
});
