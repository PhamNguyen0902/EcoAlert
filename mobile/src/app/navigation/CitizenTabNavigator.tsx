import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  ClipboardList,
  House,
  MapPin,
  Plus,
  Settings,
} from "lucide-react-native";
import { CitizenDashboardScreen } from "../../features/citizen/home/CitizenDashboardScreen";
import { CitizenMapScreen } from "../../features/citizen/nearby/CitizenMapScreen";
import { CitizenNotificationsScreen } from "../../features/citizen/notifications/CitizenNotificationsScreen";
import { MyReportsScreen } from "../../features/citizen/my-reports/MyReportsScreen";
import { CitizenProfileScreen } from "../../features/citizen/profile/CitizenProfileScreen";
import { CitizenSettingsScreen } from "../../features/citizen/settings/CitizenSettingsScreen";
import { AlertDetailScreen } from "../../features/incidents/screens/AlertDetailScreen";
import { LocationPickerScreen } from "../../features/report/legacy/LocationPickerScreen";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../i18n/LanguageContext";
import type { CitizenStackParamList, CitizenTabParamList } from "../../navigation/types";
import { ReportFlowNavigator } from "../../features/report/navigation/ReportFlowNavigator";
import { ReportTabLauncherScreen } from "../../features/report/navigation/ReportTabLauncherScreen";

const Tab = createBottomTabNavigator<CitizenTabParamList>();
const Stack = createNativeStackNavigator<CitizenStackParamList>();

const CitizenTabs = () => {
  const { colors } = useCivicTheme();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();

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
          borderTopColor: colors.divider,
          borderTopWidth: 1,
          height: 68 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          elevation: 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0,
          shadowRadius: 10,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: 4 },
        tabBarIcon: ({ color, size }) =>
          route.name === "DashboardTab" ? (
            <House color={color} size={size} />
          ) : route.name === "MapTab" ? (
            <MapPin color={color} size={size} />
          ) : route.name === "ReportTab" ? (
            <Plus color="#07101F" size={30} strokeWidth={2.5} />
          ) : route.name === "SettingsTab" ? (
            <Settings color={color} size={size} />
          ) : (
            <ClipboardList color={color} size={size} />
          ),
      })}
    >
      <Tab.Screen
        name="DashboardTab"
        component={CitizenDashboardScreen}
        options={{ tabBarLabel: language === "vi" ? "Trang chủ" : "Home" }}
      />
      <Tab.Screen
        name="MapTab"
        component={CitizenMapScreen}
        options={{ tabBarLabel: language === "vi" ? "Gần tôi" : "Nearby" }}
      />
      <Tab.Screen
        name="ReportTab"
        component={ReportTabLauncherScreen}
        options={{
          tabBarLabel: "",
          tabBarAccessibilityLabel: "Tạo báo cáo mới",
          tabBarIconStyle: {
            width: 60,
            height: 60,
            marginTop: -20,
            borderRadius: 999,
            backgroundColor: "#22C55E",
            borderWidth: 5,
            borderColor: colors.greenSoft,
            alignItems: "center",
            justifyContent: "center",
          },
        }}
      />
      <Tab.Screen
        name="MyReportsTab"
        component={MyReportsScreen}
        options={{ tabBarLabel: language === "vi" ? "Của tôi" : "My reports" }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={CitizenSettingsScreen}
        options={{ tabBarLabel: language === "vi" ? "Cài đặt" : "Settings" }}
      />
    </Tab.Navigator>
  );
};

export const CitizenTabNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CitizenTabs" component={CitizenTabs} />
    <Stack.Screen name="ReportFlow" component={ReportFlowNavigator} />
    <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
    <Stack.Screen name="Profile" component={CitizenProfileScreen} />
    <Stack.Screen name="Notifications" component={CitizenNotificationsScreen} />
    {/* giữ lại để tương thích điều hướng cũ hoặc quản trị viên, luồng báo cáo hiện trường không cho phép tự chọn lại vị trí thủ công */}
    <Stack.Screen name="LocationPicker" component={LocationPickerScreen} />
  </Stack.Navigator>
);
