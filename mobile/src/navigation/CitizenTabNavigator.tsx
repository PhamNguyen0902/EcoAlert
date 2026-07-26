import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LayoutDashboard, PlusCircle, FileText, User as UserIcon } from "lucide-react-native";
import { CitizenDashboardScreen } from "../screens/citizen/CitizenDashboardScreen";
import { ReportIncidentScreen } from "../screens/citizen/ReportIncidentScreen";
import { MyReportsScreen } from "../screens/citizen/MyReportsScreen";
import { AlertDetailScreen } from "../screens/citizen/AlertDetailScreen";
import { useProfile, useLogout } from "../hooks/useAuth";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";
import { COLORS } from "../utils/constants";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function formatProfileName(fullName?: string): string {
  if (!fullName) return "EcoAlert Citizen";
  const name = fullName.trim();
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts[0];
  }
  return name;
}

const ProfileScreen: React.FC = () => {
  const { data: profile } = useProfile();
  const logoutMutation = useLogout();

  return (
    <View style={styles.profileContainer}>
      <GlassCard style={styles.profileCard}>
        <View style={styles.profileContent}>
          <View style={styles.avatarBox}>
            <UserIcon size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.profileName}>{formatProfileName(profile?.fullName)}</Text>
          <Text style={styles.profileEmail}>{profile?.email || "citizen@ecoalert.org"}</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleText}>{profile?.role || "CITIZEN"}</Text>
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

const CitizenTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, size }) => {
          if (route.name === "DashboardTab") {
            return <LayoutDashboard color={color} size={size} />;
          } else if (route.name === "ReportTab") {
            return <PlusCircle color={color} size={size + 4} />;
          } else if (route.name === "MyReportsTab") {
            return <FileText color={color} size={size} />;
          } else if (route.name === "ProfileTab") {
            return <UserIcon color={color} size={size} />;
          }
          return null;
        },
      })}
    >
      <Tab.Screen
        name="DashboardTab"
        component={CitizenDashboardScreen}
        options={{ tabBarLabel: "Dashboard" }}
      />
      <Tab.Screen
        name="ReportTab"
        component={ReportIncidentScreen}
        options={{ tabBarLabel: "Report Alert" }}
      />
      <Tab.Screen
        name="MyReportsTab"
        component={MyReportsScreen}
        options={{ tabBarLabel: "My Reports" }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: "Profile" }}
      />
    </Tab.Navigator>
  );
};

export const CitizenTabNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CitizenTabs" component={CitizenTabs} />
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
    backgroundColor: COLORS.primaryLight,
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
    backgroundColor: COLORS.primaryLight,
    borderRadius: 20,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  roleText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primaryDark,
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
