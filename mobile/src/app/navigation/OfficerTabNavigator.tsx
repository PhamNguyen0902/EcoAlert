import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CheckSquare, MapPin, UserCircle2 } from "lucide-react-native";
import { OfficerTasksScreen } from "../../officer/screens/OfficerTasksScreen";
import { OfficerMapScreen } from "../../officer/screens/OfficerMapScreen";
import { OfficerAlertDetailScreen } from "../../officer/screens/OfficerAlertDetailScreen";
import { AlertDetailScreen } from "../../shared/screens/AlertDetailScreen";
import { useCivicTheme } from "../../shared/theme/useCivicTheme";
import { useLanguage } from "../../shared/context/LanguageContext";

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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarIcon: ({ color, size }) => {
          if (route.name === "OfficerTasksTab")
            return <CheckSquare color={color} size={size} />;
          if (route.name === "OfficerMapTab")
            return <MapPin color={color} size={size} />;
          if (route.name === "OfficerProfileTab")
            return <UserCircle2 color={color} size={size} />;
          return null;
        },
      })}
    >
      {/* danh sách các tab */}
      <Tab.Screen
        name="OfficerTasksTab"
        component={OfficerTasksScreen}
        options={{ tabBarLabel: language === "vi" ? "Nhiệm vụ" : "Tasks" }}
      />
      <Tab.Screen
        name="OfficerMapTab"
        component={OfficerMapScreen}
        options={{ tabBarLabel: language === "vi" ? "Bản đồ" : "Map" }}
      />

      <Tab.Screen
        name="OfficerProfileTab"
        component={OfficerProfileScreen}
        options={{ tabBarLabel: language === "vi" ? "Cá nhân" : "Profile" }}
      />
    </Tab.Navigator>
  );
};
export const OfficerTabNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    {/* thanh điều hướng chính gồm nhiệm vụ, bản đồ và cá nhân */}
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
