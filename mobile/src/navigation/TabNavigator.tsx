import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { LayoutDashboard, PlusCircle, User as UserIcon, LogOut } from "lucide-react-native";
import { DashboardScreen } from "../screens/DashboardScreen";
import { ReportIncidentScreen } from "../screens/ReportIncidentScreen";
import { useProfile, useLogout } from "../hooks/useAuth";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";
import { COLORS } from "../utils/constants";

const Tab = createBottomTabNavigator();

const ProfileScreen: React.FC<{ navigation?: any }> = () => {
  const { data: profile, isLoading } = useProfile();
  const logoutMutation = useLogout();

  return (
    <View style={styles.profileContainer}>
      <GlassCard style={styles.profileCard}>
        <View style={styles.avatarBox}>
          <UserIcon size={36} color={COLORS.primary} />
        </View>
        <Text style={styles.profileName}>{profile?.fullName || "EcoAlert Citizen"}</Text>
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
          icon={<LogOut size={18} color="#FFF" style={{ marginRight: 8 }} />}
        />
      </GlassCard>
    </View>
  );
};

export const TabNavigator = () => {
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
          } else if (route.name === "ProfileTab") {
            return <UserIcon color={color} size={size} />;
          }
          return null;
        },
      })}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{ tabBarLabel: "Dashboard" }}
      />
      <Tab.Screen
        name="ReportTab"
        component={ReportIncidentScreen}
        options={{ tabBarLabel: "Report Alert" }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: "Profile" }}
      />
    </Tab.Navigator>
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
  },
  profileCard: {
    padding: 24,
    alignItems: "center",
    borderRadius: 24,
  },
  avatarBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
  },
  profileEmail: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  roleTag: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 20,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  logoutBtn: {
    marginTop: 28,
    width: "100%",
  },
});
