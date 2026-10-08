import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CheckSquare, MapPin, Bot, UserCircle2 } from "lucide-react-native";
import { OfficerTasksScreen } from "../screens/officer/OfficerTasksScreen";
import { OfficerMapScreen } from "../screens/officer/OfficerMapScreen";
import { OfficerAlertDetailScreen } from "../screens/officer/OfficerAlertDetailScreen";
import { AlertDetailScreen } from "../screens/citizen/AlertDetailScreen";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";

import { OfficerProfileScreen } from "../screens/officer/OfficerProfileScreen";
import { OfficerResolutionScreen } from "../screens/officer/OfficerResolutionScreen";
import type { OfficerTabParamList, OfficerStackParamList } from "./types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
const Tab = createBottomTabNavigator<OfficerTabParamList>();
const Stack = createNativeStackNavigator<OfficerStackParamList>();
const OfficerTabs = () => {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.secondary,
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
    />
    <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
    <Stack.Screen name="OfficerResolution" component={OfficerResolutionScreen} />
  </Stack.Navigator>
);
