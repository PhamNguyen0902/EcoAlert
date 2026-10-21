import React from "react";
import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  Bell,
  CheckCircle2,
  ClipboardList,
  MapPinned,
  UserCheck,
} from "lucide-react-native";
import { OfficerTasksScreen } from "../../officer/screens/OfficerTasksScreen";
import { OfficerMapScreen } from "../../officer/screens/OfficerMapScreen";
import { OfficerHistoryScreen } from "../../officer/screens/OfficerHistoryScreen";
import { OfficerAlertDetailScreen } from "../../officer/screens/OfficerAlertDetailScreen";
import { AlertDetailScreen } from "../../shared/screens/AlertDetailScreen";
import { useCivicTheme } from "../../shared/theme/useCivicTheme";
import { useLanguage } from "../../shared/context/LanguageContext";
import { useOfficerTasks } from "../../shared/hooks/useAlerts";
import { useUnreadNotificationCount } from "../../shared/hooks/useNotifications";
import { filterOfficerTasks } from "../../officer/utils/officerWorkflow";
import { unreadBadgeLabel } from "../../shared/utils/notificationNavigation";

import { OfficerProfileScreen } from "../../officer/screens/OfficerProfileScreen";
import { OfficerResolutionScreen } from "../../officer/screens/OfficerResolutionScreen";
import { OfficerTaskListScreen } from "../../officer/screens/OfficerTaskListScreen";
import { OfficerGpsCheckInScreen } from "../../officer/screens/OfficerGpsCheckInScreen";
import { OfficerResolutionSubmittedScreen } from "../../officer/screens/OfficerResolutionSubmittedScreen";
import { OfficerNotificationsScreen } from "../../officer/screens/OfficerNotificationsScreen";
import type { OfficerTabParamList, OfficerStackParamList } from "./types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Tab = createBottomTabNavigator<OfficerTabParamList>();
const Stack = createNativeStackNavigator<OfficerStackParamList>();

const OfficerTabs = () => {
  const { colors } = useCivicTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();

  const tasksQuery = useOfficerTasks(1, 100, undefined, { allPages: true });
  const unreadQuery = useUnreadNotificationCount();

  const allWasteTasks = filterOfficerTasks(tasksQuery.data?.items || [], "ALL");
  const pendingTasksCount = allWasteTasks.filter((t) =>
    ["ASSIGNED", "IN_PROGRESS"].includes(t.status.toUpperCase()),
  ).length;
  const unreadCount = unreadQuery.data || 0;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarLabelPosition: "below-icon",
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 58 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 6,
          elevation: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: -0.1,
          marginTop: 2,
        },
        tabBarBadgeStyle: {
          backgroundColor: colors.primary,
          color: "#07101F",
          fontSize: 10,
          fontWeight: "800",
          minWidth: 18,
          height: 18,
          lineHeight: 14,
          borderRadius: 9,
        },
        tabBarIcon: ({ color }) => {
          const iconSize = 22;
          if (route.name === "OfficerTasksTab")
            return <ClipboardList color={color} size={iconSize} />;
          if (route.name === "OfficerMapTab")
            return <MapPinned color={color} size={iconSize} />;
          if (route.name === "OfficerHistoryTab")
            return <CheckCircle2 color={color} size={iconSize} />;
          if (route.name === "OfficerNotificationsTab")
            return <Bell color={color} size={iconSize} />;
          if (route.name === "OfficerProfileTab")
            return <UserCheck color={color} size={iconSize} />;
          return null;
        },
      })}
    >
      {/* Tab 1: Nhiệm vụ cần làm (ASSIGNED, IN_PROGRESS) */}
      <Tab.Screen
        name="OfficerTasksTab"
        component={OfficerTasksScreen}
        options={{
          tabBarLabel: language === "vi" ? "Nhiệm vụ" : "Tasks",
          tabBarBadge:
            pendingTasksCount > 0
              ? (unreadBadgeLabel(pendingTasksCount) ?? undefined)
              : undefined,
        }}
      />
      {/* Tab 2: Bản đồ tác chiến, vùng phụ trách và dẫn đường OSRM */}
      <Tab.Screen
        name="OfficerMapTab"
        component={OfficerMapScreen}
        options={{ tabBarLabel: language === "vi" ? "Bản đồ" : "Map" }}
      />
      {/* Tab 3: Lịch sử sự cố đã xử lý hoàn tất (RESOLVED, CLOSED) */}
      <Tab.Screen
        name="OfficerHistoryTab"
        component={OfficerHistoryScreen}
        options={{ tabBarLabel: language === "vi" ? "Lịch sử" : "History" }}
      />
      {/* Tab 4: Thông báo công vụ kèm badge chưa đọc */}
      <Tab.Screen
        name="OfficerNotificationsTab"
        component={OfficerNotificationsScreen}
        options={{
          tabBarLabel: language === "vi" ? "Thông báo" : "Alerts",
          tabBarBadge:
            unreadCount > 0
              ? (unreadBadgeLabel(unreadCount) ?? undefined)
              : undefined,
        }}
      />
      {/* Tab 5: Ca trực, khu vực phụ trách, chẩn đoán GPS và tài khoản */}
      <Tab.Screen
        name="OfficerProfileTab"
        component={OfficerProfileScreen}
        options={{ tabBarLabel: language === "vi" ? "Ca trực" : "Shift" }}
      />
    </Tab.Navigator>
  );
};

export const OfficerTabNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    {/* thanh điều hướng chính 5 tabs theo chuẩn Apple HIG */}
    <Stack.Screen name="OfficerTabs" component={OfficerTabs} />
    {/* xem chi tiết sự cố, bấm bắt đầu xử lý, chỉ đường và thêm ghi chú */}
    <Stack.Screen
      name="OfficerAlertDetail"
      component={OfficerAlertDetailScreen}
      getId={({ params }) => params.id}
    />
    {/* màn hình chi tiết dự phòng khi mở từ bản đồ admin hoặc thông báo đẩy */}
    <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
    {/* lập biên bản kết quả dọn dẹp, đính kèm ảnh sau xử lý và gửi duyệt */}
    <Stack.Screen
      name="OfficerResolution"
      component={OfficerResolutionScreen}
      getId={({ params }) => params.id}
    />
    {/* danh sách đầy đủ tất cả nhiệm vụ được giao kèm ô tìm kiếm và bộ lọc */}
    <Stack.Screen name="OfficerTaskList" component={OfficerTaskListScreen} />
    {/* điểm danh xác nhận cán bộ đã có mặt trực tiếp tại điểm rác */}
    <Stack.Screen
      name="OfficerGpsCheckIn"
      component={OfficerGpsCheckInScreen}
      getId={({ params }) => params.id}
    />
    {/* thông báo cán bộ đã nộp kết quả thành công và chờ quản trị viên nghiệm thu */}
    <Stack.Screen
      name="OfficerResolutionSubmitted"
      component={OfficerResolutionSubmittedScreen}
      getId={({ params }) => params.id}
    />
    {/* danh sách thông báo công vụ về nhiệm vụ mới và cập nhật tiến độ */}
    <Stack.Screen
      name="OfficerNotifications"
      component={OfficerNotificationsScreen}
    />
  </Stack.Navigator>
);
