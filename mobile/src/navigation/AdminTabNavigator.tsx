import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LayoutDashboard, ShieldCheck, MapPin, User as UserIcon, FileText } from "lucide-react-native";
import { AdminDashboardScreen } from "../screens/admin/AdminDashboardScreen";
import { CitizenDashboardScreen } from "../screens/citizen/CitizenDashboardScreen";
import { OfficerMapScreen } from "../screens/officer/OfficerMapScreen";
import { AlertDetailScreen } from "../screens/citizen/AlertDetailScreen";
import { useProfile, useLogout } from "../hooks/useAuth";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";
import { COLORS } from "../utils/constants";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function formatProfileName(fullName?: string): string {
  if (!fullName) return "Super Admin";
  const name = fullName.trim();
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts[0];
  }
  return name;
}

const AdminProfileScreen: React.FC = () => {
  const { data: profile } = useProfile();
  const logoutMutation = useLogout();

  return (
    <View style={styles.profileContainer}>
      <GlassCard style={styles.profileCard}>
        <View style={styles.profileContent}>
          <View style={styles.avatarBox}>
            <ShieldCheck size={40} color="#7C3AED" />
          </View>
          <Text style={styles.profileName}>{formatProfileName(profile?.fullName)}</Text>
          <Text style={styles.profileEmail}>{profile?.email || "admin@ecoalert.org"}</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleText}>SUPER ADMIN</Text>
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

const AdminTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#7C3AED",
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, size }) => {
          if (route.name === "AdminDashboardTab") {
            return <LayoutDashboard color={color} size={size} />;
          } else if (route.name === "AdminAlertsTab") {
            return <FileText color={color} size={size} />;
          } else if (route.name === "AdminMapTab") {
            return <MapPin color={color} size={size} />;
          } else if (route.name === "AdminProfileTab") {
            return <UserIcon color={color} size={size} />;
          }
          return null;
        },
      })}
    >
      <Tab.Screen
        name="AdminDashboardTab"
        component={AdminDashboardScreen}
        options={{ tabBarLabel: "Dashboard" }}
      />
      <Tab.Screen
        name="AdminAlertsTab"
        component={CitizenDashboardScreen}
        options={{ tabBarLabel: "System Alerts" }}
      />
      <Tab.Screen
        name="AdminMapTab"
        component={OfficerMapScreen}
        options={{ tabBarLabel: "City Map" }}
      />
      <Tab.Screen
        name="AdminProfileTab"
        component={AdminProfileScreen}
        options={{ tabBarLabel: "Profile" }}
      />
    </Tab.Navigator>
  );
};

export const AdminTabNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminTabs" component={AdminTabs} />
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
    backgroundColor: "#F3E8FF",
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
    backgroundColor: "#F3E8FF",
    borderRadius: 20,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  roleText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7C3AED",
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
