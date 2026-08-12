import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { LayoutDashboard, PlusCircle, User as UserIcon, LogOut } from "lucide-react-native";
import { CitizenDashboardScreen } from "../screens/citizen/CitizenDashboardScreen";
import { ReportIncidentScreen } from "../screens/citizen/ReportIncidentScreen";
import { useProfile, useLogout } from "../hooks/useAuth";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";
import { useTheme } from "../context/ThemeContext";
import type { AppTabParamList } from "./types";

const Tab = createBottomTabNavigator<AppTabParamList>();

const ProfileScreen: React.FC<{ navigation?: any }> = () => {
  const { colors, isDark } = useTheme();
  const { data: profile } = useProfile();
  const logoutMutation = useLogout();

  return (
    <View style={[styles.profileContainer, { backgroundColor: colors.background }]}>
      <GlassCard style={styles.profileCard}>
        <View style={[styles.avatarBox, { backgroundColor: isDark ? "rgba(34, 197, 94, 0.25)" : colors.primaryLight }]}>
          <UserIcon size={36} color={colors.primary} />
        </View>
        <Text style={[styles.profileName, { color: colors.text }]}>{profile?.fullName || "Công dân EcoAlert"}</Text>
        <Text style={[styles.profileEmail, { color: colors.textMuted }]}>{profile?.email || "citizen@ecoalert.org"}</Text>
        <View style={[styles.roleTag, { backgroundColor: isDark ? "rgba(34, 197, 94, 0.25)" : colors.primaryLight }]}>
          <Text style={[styles.roleText, { color: isDark ? "#4ADE80" : colors.primaryDark }]}>{profile?.role || "CÔNG DÂN"}</Text>
        </View>

        <Button
          title="Đăng xuất"
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
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ],
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
        component={CitizenDashboardScreen}
        options={{ tabBarLabel: "Trang chủ" }}
      />
      <Tab.Screen
        name="ReportTab"
        component={ReportIncidentScreen}
        options={{ tabBarLabel: "Báo cáo" }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: "Hồ sơ" }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    elevation: 8,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  profileContainer: {
    flex: 1,
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
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
  },
  profileEmail: {
    fontSize: 14,
    marginTop: 4,
  },
  roleTag: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  logoutBtn: {
    marginTop: 28,
    width: "100%",
  },
});

