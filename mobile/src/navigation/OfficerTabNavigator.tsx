import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LayoutDashboard, ShieldAlert, MapPin, User as UserIcon, CheckSquare } from "lucide-react-native";
import { OfficerDashboardScreen } from "../screens/officer/OfficerDashboardScreen";
import { OfficerAlertDetailScreen } from "../screens/officer/OfficerAlertDetailScreen";
import { OfficerMapScreen } from "../screens/officer/OfficerMapScreen";
import { CitizenDashboardScreen } from "../screens/citizen/CitizenDashboardScreen";
import { AlertDetailScreen } from "../screens/citizen/AlertDetailScreen";
import { useProfile, useLogout } from "../hooks/useAuth";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";
import { COLORS } from "../utils/constants";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function formatProfileName(fullName?: string): string {
  if (!fullName) return "EcoAlert Officer";
  const name = fullName.trim();
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts[0];
  }
  return name;
}

const OfficerProfileScreen: React.FC = () => {
  const { data: profile } = useProfile();
  const logoutMutation = useLogout();

  return (
    <View style={styles.profileContainer}>
      <GlassCard style={styles.profileCard}>
        <View style={styles.profileContent}>
          <View style={styles.avatarBox}>
            <ShieldAlert size={40} color={COLORS.secondary} />
          </View>
          <Text style={styles.profileName}>{formatProfileName(profile?.fullName)}</Text>
          <Text style={styles.profileEmail}>{profile?.email || "officer@ecoalert.org"}</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleText}>ENVIRONMENTAL OFFICER</Text>
          </View>

          <Button
            title="Sign Out"
            variant="destructive"
            onPress={() => logoutMutation.mutate()}
            loading={logoutMutation.isPending}
            style={styles.logoutBtn}
          />
        </View>
      </GlassCard>
    </View>
  );
};

const OfficerTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.secondary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, size }) => {
          if (route.name === "OfficerDashboardTab") {
            return <LayoutDashboard color={color} size={size} />;
          } else if (route.name === "OfficerTasksTab") {
            return <CheckSquare color={color} size={size} />;
          } else if (route.name === "OfficerMapTab") {
            return <MapPin color={color} size={size} />;
          } else if (route.name === "OfficerProfileTab") {
            return <UserIcon color={color} size={size} />;
          }
          return null;
        },
      })}
    >
      <Tab.Screen
        name="OfficerDashboardTab"
        component={OfficerDashboardScreen}
        options={{ tabBarLabel: "Dashboard" }}
      />
      <Tab.Screen
        name="OfficerTasksTab"
        component={CitizenDashboardScreen}
        options={{ tabBarLabel: "All Alerts" }}
      />
      <Tab.Screen
        name="OfficerMapTab"
        component={OfficerMapScreen}
        options={{ tabBarLabel: "Map View" }}
      />
      <Tab.Screen
        name="OfficerProfileTab"
        component={OfficerProfileScreen}
        options={{ tabBarLabel: "Profile" }}
      />
    </Tab.Navigator>
  );
};

export const OfficerTabNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OfficerTabs" component={OfficerTabs} />
      <Stack.Screen name="OfficerAlertDetail" component={OfficerAlertDetailScreen} />
      <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  profileContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  profileCard: {
    width: "100%",
    borderRadius: 24,
  },
  profileContent: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  avatarBox: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
    alignSelf: "center",
  },
  profileEmail: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: "center",
    alignSelf: "center",
  },
  roleTag: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 6,
    backgroundColor: "#DBEAFE",
    borderRadius: 20,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  roleText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.secondary,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  logoutBtn: {
    marginTop: 28,
    paddingHorizontal: 36,
    minWidth: 180,
    alignSelf: "center",
    borderRadius: 16,
  },
});
