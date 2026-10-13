import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CheckSquare, MapPin, UserCircle2 } from "lucide-react-native";
import { OfficerTasksScreen } from "../features/officer/dashboard/OfficerTasksScreen";
import { OfficerMapScreen } from "../features/officer/map/OfficerMapScreen";
import { OfficerAlertDetailScreen } from "../features/officer/tasks/OfficerAlertDetailScreen";
import { AlertDetailScreen } from "../screens/citizen/AlertDetailScreen";
import { useCivicTheme } from "../theme/useCivicTheme";
import { useLanguage } from "../i18n/LanguageContext";

import { OfficerProfileScreen } from "../features/officer/profile/OfficerProfileScreen";
import { OfficerResolutionScreen } from "../features/officer/resolution/OfficerResolutionScreen";
import { OfficerTaskListScreen } from "../features/officer/tasks/OfficerTaskListScreen";
import { OfficerGpsCheckInScreen } from "../features/officer/check-in/OfficerGpsCheckInScreen";
import { OfficerResolutionSubmittedScreen } from "../features/officer/resolution/OfficerResolutionSubmittedScreen";
import { OfficerNotificationsScreen } from "../features/officer/notifications/OfficerNotificationsScreen";
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
    <Stack.Screen name="OfficerTabs" component={OfficerTabs} />
    <Stack.Screen
      name="OfficerAlertDetail"
      component={OfficerAlertDetailScreen}
      getId={({ params }) => params.id}
    />
    <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
    <Stack.Screen
      name="OfficerResolution"
      component={OfficerResolutionScreen}
      getId={({ params }) => params.id}
    />
    <Stack.Screen name="OfficerTaskList" component={OfficerTaskListScreen} />
    <Stack.Screen
      name="OfficerGpsCheckIn"
      component={OfficerGpsCheckInScreen}
      getId={({ params }) => params.id}
    />
    <Stack.Screen
      name="OfficerResolutionSubmitted"
      component={OfficerResolutionSubmittedScreen}
      getId={({ params }) => params.id}
    />
    <Stack.Screen
      name="OfficerNotifications"
      component={OfficerNotificationsScreen}
    />
  </Stack.Navigator>
);
