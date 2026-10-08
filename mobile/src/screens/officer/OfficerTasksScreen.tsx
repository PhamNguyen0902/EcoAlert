import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapPin } from "lucide-react-native";
import { useOfficerTasks } from "../../hooks/useAlerts";
import { Card } from "../../components/ui/Card";
import { EvidenceImageFrame } from "../../components/media/EvidenceImageFrame";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { civicStyles, civicType } from "../../theme/civicDesign";
import {
  getCategoryLabel,
  getSeverityLabel,
} from "../../utils/incidentPresentation";
import { getAlertDisplaySeverity } from "../../utils/aiAnalysis";
import {
  filterOfficerTasks,
  getOfficerTaskState,
  type OfficerTaskFilter,
} from "../../utils/officerWorkflow";
import type { OfficerStackParamList } from "../../navigation/types";

const filters: { value: OfficerTaskFilter; label: string; empty: string }[] = [
  {
    value: "ALL",
    label: "Tất cả",
    empty: "Bạn chưa có nhiệm vụ được phân công.",
  },
  { value: "NEW", label: "Mới", empty: "Không có nhiệm vụ mới." },
  {
    value: "ACTIVE",
    label: "Đang xử lý",
    empty: "Bạn chưa có nhiệm vụ đang xử lý.",
  },
  {
    value: "COMPLETED",
    label: "Hoàn thành",
    empty: "Chưa có nhiệm vụ hoàn thành.",
  },
];
export const OfficerTasksScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<OfficerStackParamList>>();
  const insets = useSafeAreaInsets();
  const { colors } = useCivicTheme();
  const [filter, setFilter] = useState<OfficerTaskFilter>("ALL");
  const query = useOfficerTasks(1, 100, undefined, { allPages: true });
  const tasks = query.data?.items ?? [];
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <View style={styles.header}>
        <Text style={[civicType.title, { color: colors.text }]}>
          Nhiệm vụ của tôi
        </Text>
        <Text style={[civicType.body, { color: colors.textMuted }]}>
          Các điểm rác được phân công cho bạn
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filters}
        contentContainerStyle={styles.filterContent}
      >
        {filters.map((tab) => (
          <Pressable
            key={tab.value}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === tab.value }}
            onPress={() => setFilter(tab.value)}
            style={[
              styles.chip,
              {
                backgroundColor:
                  filter === tab.value ? colors.cyanSoft : colors.surface,
                borderColor: filter === tab.value ? colors.cyan : colors.border,
              },
            ]}
          >
            <Text style={[civicType.meta, { color: colors.text }]}>
              {tab.label} {filterOfficerTasks(tasks, tab.value).length}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        data={filterOfficerTasks(tasks, filter)}
        keyExtractor={(item) => item._id}
        contentContainerStyle={civicStyles.content}
        refreshControl={
          <RefreshControl
            refreshing={query.isLoading || query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.cyan}
          />
        }
        renderItem={({ item }) => {
          const state = getOfficerTaskState(item);
          const image = item.fieldEvidence?.[0];
          const uri =
            image?.displayUrl || image?.originalUrl || item.mediaUrls?.[0];
          const severity = getAlertDisplaySeverity(item);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Xem nhiệm vụ ${item.title}`}
              onPress={() =>
                navigation.navigate("OfficerAlertDetail", { id: item._id })
              }
            >
              <Card appearance="civic" style={styles.task}>
                {uri ? (
                  <EvidenceImageFrame
                    imageUri={uri}
                    fallbackUri={image?.originalUrl}
                    style={styles.thumbnail}
                    accessibilityLabel="Ảnh điểm rác"
                  />
                ) : null}
                <View style={styles.row}>
                  <Text style={[civicType.eyebrow, { color: state.color }]}>
                    {state.label}
                  </Text>
                  {severity ? (
                    <Text
                      style={[
                        civicType.meta,
                        {
                          color:
                            severity.toLowerCase() === "high" ||
                            severity.toLowerCase() === "critical"
                              ? colors.danger
                              : colors.warning,
                        },
                      ]}
                    >
                      {getSeverityLabel(severity)}
                    </Text>
                  ) : null}
                </View>
                <Text style={[civicType.cardTitle, { color: colors.text }]}>
                  {item.title}
                </Text>
                <Text style={[civicType.meta, { color: colors.cyan }]}>
                  {getCategoryLabel(item.category)}
                </Text>
                <View style={styles.row}>
                  <MapPin size={14} color={colors.cyan} />
                  <Text
                    style={[
                      civicType.body,
                      styles.address,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {item.address || "Đã ghi nhận vị trí GPS"}
                  </Text>
                </View>
                <Text style={[civicType.meta, { color: colors.textMuted }]}>
                  {new Date(item.assignedAt || item.createdAt).toLocaleString(
                    "vi-VN",
                  )}
                </Text>
              </Card>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !query.isLoading ? (
            <Text
              accessibilityRole={query.isError ? "alert" : undefined}
              style={[
                civicType.body,
                styles.empty,
                { color: colors.textMuted },
              ]}
            >
              {query.isError
                ? "Không thể tải nhiệm vụ. Kéo xuống để thử lại."
                : filters.find((tab) => tab.value === filter)?.empty}
            </Text>
          ) : null
        }
      />
    </View>
  );
};
const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { padding: 16, gap: 6 },
  filters: { flexGrow: 0 },
  filterContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  chip: { padding: 10, borderRadius: 8, borderWidth: 1 },
  task: { gap: 10 },
  thumbnail: {
    width: "100%",
    maxWidth: "100%",
    height: 150,
    aspectRatio: undefined,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
  },
  address: { flex: 1 },
  empty: { paddingVertical: 32, textAlign: "center" },
});
