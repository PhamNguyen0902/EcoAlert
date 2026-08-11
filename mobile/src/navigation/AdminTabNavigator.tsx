import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LayoutDashboard, ShieldCheck, User as UserIcon, FileText, Map, UsersRound, MoreHorizontal, Edit2, KeyRound } from "lucide-react-native";
import { AdminDashboardScreen } from "../screens/admin/AdminDashboardScreen";
import { AdminIncidentsScreen } from "../screens/admin/AdminIncidentsScreen";
import { AdminGisScreen } from "../screens/admin/AdminGisScreen";
import { AdminOfficerAvailabilityScreen } from "../screens/admin/AdminOfficerAvailabilityScreen";
import { AdminMoreScreen } from "../screens/admin/AdminMoreScreen";
import { UserManagementScreen } from "../screens/admin/UserManagementScreen";
import { CategoryManagementScreen } from "../screens/admin/CategoryManagementScreen";
import { AuditLogsScreen } from "../screens/admin/AuditLogsScreen";
import { AlertDetailScreen } from "../screens/citizen/AlertDetailScreen";
import { AssistantScreen } from "../screens/citizen/AssistantScreen";
import { NotificationsScreen } from "../screens/citizen/NotificationsScreen";
import { useProfile, useLogout } from "../hooks/useAuth";
import { EditProfileModal } from "../components/modals/EditProfileModal";
import { ChangePasswordModal } from "../components/modals/ChangePasswordModal";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";
import { SettingsSection } from "../components/ui/SettingsSection";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";

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
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [isEditProfileOpen, setEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setChangePasswordOpen] = useState(false);

  return (
    <ScrollView
      style={[styles.scrollContainer, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.profileContainer}
      showsVerticalScrollIndicator={false}
    >
      <GlassCard style={styles.profileCard}>
        <View style={styles.profileContent}>
          <View style={[styles.avatarBox, { backgroundColor: colors.isDark ? "#3B0764" : "#F3E8FF" }]}>
            <ShieldCheck size={40} color="#7C3AED" />
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>
            {formatProfileName(profile?.fullName)}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
            {profile?.email || "admin@ecoalert.org"}
          </Text>
          <View style={[styles.roleTag, { backgroundColor: colors.isDark ? "#3B0764" : "#F3E8FF" }]}>
            <Text style={[styles.roleText, { color: "#7C3AED" }]}>
              {t("profile.adminRole", "SUPER ADMIN")}
            </Text>
          </View>

          <View style={styles.profileActions}>
            <Button
              title={t("profile.editProfile", "Edit Profile")}
              variant="outline"
              onPress={() => setEditProfileOpen(true)}
              style={styles.profileActionBtn}
              icon={<Edit2 size={16} color="#7C3AED" style={{ marginRight: 6 }} />}
            />
            <Button
              title={t("profile.changePassword", "Change Password")}
              variant="outline"
              onPress={() => setChangePasswordOpen(true)}
              style={styles.profileActionBtn}
              icon={<KeyRound size={16} color="#7C3AED" style={{ marginRight: 6 }} />}
            />
          </View>
        </View>
      </GlassCard>

      <SettingsSection />

      <Button
        title={t("profile.signOut", "Sign Out")}
        variant="destructive"
        onPress={() => logoutMutation.mutate()}
        loading={logoutMutation.isPending}
        style={styles.logoutBtn}
      />

      <EditProfileModal
        visible={isEditProfileOpen}
        user={profile || null}
        onClose={() => setEditProfileOpen(false)}
      />
      <ChangePasswordModal
        visible={isChangePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </ScrollView>
  );
};

const AdminTabs = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#7C3AED",
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
          if (route.name === "AdminDashboardTab") {
            return <LayoutDashboard color={color} size={size} />;
          } else if (route.name === "AdminIncidentsTab") {
            return <FileText color={color} size={size} />;
          } else if (route.name === "AdminGisTab") {
            return <Map color={color} size={size} />;
          } else if (route.name === "AdminOfficersTab") {
            return <UsersRound color={color} size={size} />;
          } else if (route.name === "AdminMoreTab") {
            return <MoreHorizontal color={color} size={size} />;
          }
          return null;
        },
      })}
    >
      <Tab.Screen
        name="AdminDashboardTab"
        component={AdminDashboardScreen}
        options={{ tabBarLabel: t("tabs.dashboard", "Dashboard") }}
      />
      <Tab.Screen
        name="AdminIncidentsTab"
        component={AdminIncidentsScreen}
        options={{ tabBarLabel: t("tabs.incidents", "Incidents") }}
      />
      <Tab.Screen
        name="AdminGisTab"
        component={AdminGisScreen}
        options={{ tabBarLabel: t("tabs.gis", "GIS") }}
      />
      <Tab.Screen
        name="AdminOfficersTab"
        component={AdminOfficerAvailabilityScreen}
        options={{ tabBarLabel: t("tabs.officers", "Officers") }}
      />
      <Tab.Screen
        name="AdminMoreTab"
        component={AdminMoreScreen}
        options={{ tabBarLabel: t("tabs.more", "More") }}
      />
    </Tab.Navigator>
  );
};

export const AdminTabNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminTabs" component={AdminTabs} />
      <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
      <Stack.Screen name="AdminUsers" component={UserManagementScreen} />
      <Stack.Screen name="AdminCategories" component={CategoryManagementScreen} />
      <Stack.Screen name="AdminAudit" component={AuditLogsScreen} />
      <Stack.Screen name="AdminAssistant" component={AssistantScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="AdminProfile" component={AdminProfileScreen} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  tabBar: {
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
    elevation: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  profileContainer: {
    padding: 20,
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 40,
  },
  profileCard: {
    width: "100%",
    borderRadius: 24,
  },
  profileContent: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  avatarBox: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  profileEmail: {
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },
  roleTag: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "center",
  },
  roleText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  profileActions: {
    width: "100%",
    marginTop: 20,
    gap: 10,
  },
  profileActionBtn: {
    width: "100%",
    borderRadius: 14,
  },
  logoutBtn: {
    marginTop: 12,
    width: "100%",
    borderRadius: 16,
  },
});
