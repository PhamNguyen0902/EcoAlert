import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Search, MapPin } from "lucide-react-native";
import { Pressable } from "react-native";
import { OfficerEntrance } from "../../components/officer/OfficerEntrance";
import { useOfficerTasks } from "../../hooks/useAlerts";
import { useCivicTheme } from "../../theme/useCivicTheme";
import {
  OfficerHeader,
  OfficerCard,
  OfficerMetric,
  officerStyles as s,
} from "../../components/officer/OfficerUI";
import { OfficerTaskCard } from "../../components/officer/OfficerTaskCard";
import { OfficerTaskFilters } from "../../components/officer/OfficerTaskFilters";
import {
  filterOfficerTasks,
  type OfficerTaskFilter,
} from "../../utils/officerWorkflow";
import { searchOfficerTasks } from "../../utils/officerPresentation";
import type { OfficerStackParamList } from "../../navigation/types";
export function OfficerTaskListScreen({
  navigation,
}: NativeStackScreenProps<OfficerStackParamList, "OfficerTaskList">) {
  const { colors } = useCivicTheme();
  const insets = useSafeAreaInsets();
  const query = useOfficerTasks(1, 100, undefined, { allPages: true });
  const [filter, setFilter] = useState<OfficerTaskFilter>("ALL");
  const [search, setSearch] = useState("");
  const tasks = filterOfficerTasks(query.data?.items || [], "ALL");
  const visible = searchOfficerTasks(filterOfficerTasks(tasks, filter), search);
  return (
    <View
      style={[
        s.screen,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <OfficerHeader title="Danh sách nhiệm vụ" back={navigation.goBack} />
      <FlatList
        data={visible}
        keyExtractor={(task) => task._id}
        contentContainerStyle={[
          s.content,
          { paddingBottom: insets.bottom + 92 },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <Text style={[s.technical, { color: colors.primary }]}>
              CÁC NHIỆM VỤ ĐƯỢC PHÂN CÔNG
            </Text>
            <View
              style={[
                s.row,
                {
                  backgroundColor: colors.elevated,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                },
              ]}
            >
              <Search size={18} color={colors.textMuted} />
              <TextInput
                accessibilityLabel="Tìm trong nhiệm vụ được phân công"
                placeholder="Tìm theo địa chỉ, mã sự cố..."
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
                style={[
                  s.grow,
                  { color: colors.text, minHeight: 48, fontSize: 13 },
                ]}
                clearButtonMode="while-editing"
              />
            </View>
            <OfficerTaskFilters
              tasks={tasks}
              value={filter}
              onChange={setFilter}
            />
            <Text style={[s.meta, { color: colors.textMuted }]}>
              Tìm trong {query.data ? tasks.length : "—"} nhiệm vụ được tải từ
              tài khoản của bạn.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <OfficerEntrance delay={index * 35}>
            <OfficerTaskCard
              task={item}
              onPress={() =>
                navigation.navigate("OfficerAlertDetail", { id: item._id })
              }
            />
          </OfficerEntrance>
        )}
        ListEmptyComponent={
          <OfficerCard>
            {query.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[s.body, { color: colors.textMuted }]}>
                {query.isError
                  ? "Không tải được nhiệm vụ. Kéo xuống để thử lại."
                  : "Không tìm thấy nhiệm vụ phù hợp."}
              </Text>
            )}
          </OfficerCard>
        }
        ListFooterComponent={
          <View style={[s.row, { marginTop: 6 }]}>
            <OfficerMetric
              label="Được phân công"
              value={query.data ? tasks.length : "—"}
              tone={colors.cyan}
            />
            <OfficerMetric
              label="Đã xử lý / đóng"
              value={
                query.data ? filterOfficerTasks(tasks, "COMPLETED").length : "—"
              }
              tone={colors.primary}
            />
          </View>
        }
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Xem bản đồ nhiệm vụ"
        onPress={() =>
          navigation.navigate("OfficerTabs", { screen: "OfficerMapTab" })
        }
        style={{
          position: "absolute",
          right: 18,
          bottom: Math.max(18, insets.bottom),
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 4,
          borderColor: colors.greenSoft,
        }}
      >
        <MapPin size={23} color="#07101F" />
      </Pressable>
    </View>
  );
}
