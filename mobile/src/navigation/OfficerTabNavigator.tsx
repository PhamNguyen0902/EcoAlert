import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CheckSquare, MapPin, Bot } from "lucide-react-native";
import { OfficerTasksScreen } from "../screens/officer/OfficerTasksScreen";
import { OfficerMapScreen } from "../screens/officer/OfficerMapScreen";
import { OfficerAlertDetailScreen } from "../screens/officer/OfficerAlertDetailScreen";
import { AlertDetailScreen } from "../screens/citizen/AlertDetailScreen";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { OfficerAssistantScreen } from "../screens/officer/OfficerAssistantScreen";
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const OfficerTabs = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarIcon: ({ color, size }) => {
          if (route.name === "OfficerTasksTab")
            return <CheckSquare color={color} size={size} />;
          if (route.name === "OfficerMapTab")
            return <MapPin color={color} size={size} />;
          if (route.name === "OfficerAssistantTab")
            return <Bot color={color} size={size} />;
          return null;
        },
      })}
    >
      <Tab.Screen
        name="OfficerTasksTab"
        component={OfficerTasksScreen}
        options={{ tabBarLabel: t("tabs.assignedReports") }}
      />
      <Tab.Screen
        name="OfficerMapTab"
        component={OfficerMapScreen}
        options={{ tabBarLabel: t("tabs.monitoringMap") }}
      />
      <Tab.Screen
        name="OfficerAssistantTab"
        component={OfficerAssistantScreen}
        options={{ tabBarLabel: "Trợ lý AI" }}
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
  </Stack.Navigator>
);
