import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  FileText,
  LayoutDashboard,
  Plus,
  UserCircle2,
} from "lucide-react-native";
import { CitizenDashboardScreen } from "../screens/citizen/CitizenDashboardScreen";
import { MyReportsScreen } from "../screens/citizen/MyReportsScreen";
import { CitizenProfileScreen } from "../screens/citizen/CitizenProfileScreen";
import { AlertDetailScreen } from "../screens/citizen/AlertDetailScreen";
import { LocationPickerScreen } from "../screens/LocationPickerScreen";
import { useCivicTheme } from "../theme/useCivicTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../context/LanguageContext";
import type { CitizenStackParamList, CitizenTabParamList } from "./types";
import { ReportFlowNavigator } from "../features/report/ReportFlowNavigator";
import { ReportTabLauncherScreen } from "../features/report/ReportTabLauncherScreen";

const Tab = createBottomTabNavigator<CitizenTabParamList>();
const Stack = createNativeStackNavigator<CitizenStackParamList>();

const CitizenTabs = () => {
  const { colors } = useCivicTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
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
            <LayoutDashboard color={color} size={size} />
          ) : route.name === "ReportTab" ? (
            <Plus color="#07101F" size={size + 5} strokeWidth={3} />
          ) : route.name === "ProfileTab" ? (
            <UserCircle2 color={color} size={size} />
          ) : (
            <FileText color={color} size={size} />
          ),
      })}
    >
      <Tab.Screen
        name="DashboardTab"
        component={CitizenDashboardScreen}
        options={{ tabBarLabel: t("tabs.home") }}
      />
      <Tab.Screen
        name="ReportTab"
        component={ReportTabLauncherScreen}
        options={{
          tabBarLabel: t("tabs.reportIncident"),
          tabBarIconStyle: {
            width: 44,
            height: 44,
            marginTop: -8,
            borderRadius: 999,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          },
        }}
      />
      <Tab.Screen
        name="MyReportsTab"
        component={MyReportsScreen}
        options={{ tabBarLabel: t("tabs.myReports", "My Reports") }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={CitizenProfileScreen}
        options={{ tabBarLabel: t("tabs.profile", "Cá nhân") }}
      />
    </Tab.Navigator>
  );
};

export const CitizenTabNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CitizenTabs" component={CitizenTabs} />
    <Stack.Screen name="ReportFlow" component={ReportFlowNavigator} />
    <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
    {/* Kept for legacy/admin-compatible navigation. Field reporting no longer exposes manual relocation. */}
    <Stack.Screen name="LocationPicker" component={LocationPickerScreen} />
  </Stack.Navigator>
);
