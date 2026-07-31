import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LayoutDashboard, ShieldAlert, MapPin, User as UserIcon, CheckSquare, Edit2, KeyRound } from "lucide-react-native";
import { OfficerDashboardScreen } from "../screens/officer/OfficerDashboardScreen";
import { OfficerTasksScreen } from "../screens/officer/OfficerTasksScreen";
import { OfficerAlertDetailScreen } from "../screens/officer/OfficerAlertDetailScreen";
import { OfficerMapScreen } from "../screens/officer/OfficerMapScreen";
import { AlertDetailScreen } from "../screens/citizen/AlertDetailScreen";
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
          <View style={[styles.avatarBox, { backgroundColor: colors.isDark ? "#1E3A8A" : "#DBEAFE" }]}>
            <ShieldAlert size={40} color={colors.secondary} />
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>
            {formatProfileName(profile?.fullName)}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
            {profile?.email || "officer@ecoalert.org"}
          </Text>
          <View style={[styles.roleTag, { backgroundColor: colors.isDark ? "#1E3A8A" : "#DBEAFE" }]}>
            <Text style={[styles.roleText, { color: colors.secondary }]}>
              {t("profile.officerRole", "ENVIRONMENTAL OFFICER")}
            </Text>
          </View>

          <View style={styles.profileActions}>
            <Button
              title={t("profile.editProfile", "Edit Profile")}
              variant="outline"
              onPress={() => setEditProfileOpen(true)}
              style={styles.profileActionBtn}
              icon={<Edit2 size={16} color={colors.secondary} style={{ marginRight: 6 }} />}
            />
            <Button
              title={t("profile.changePassword", "Change Password")}
              variant="outline"
              onPress={() => setChangePasswordOpen(true)}
              style={styles.profileActionBtn}
              icon={<KeyRound size={16} color={colors.secondary} style={{ marginRight: 6 }} />}
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

const OfficerTabs = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.secondary,
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
        options={{ tabBarLabel: t("tabs.dashboard", "Dashboard") }}
      />
      <Tab.Screen
        name="OfficerTasksTab"
        component={OfficerTasksScreen}
        options={{ tabBarLabel: t("tabs.assignedTasks", "Assigned Tasks") }}
      />
      <Tab.Screen
        name="OfficerMapTab"
        component={OfficerMapScreen}
        options={{ tabBarLabel: t("tabs.mapView", "Map View") }}
      />
      <Tab.Screen
        name="OfficerProfileTab"
        component={OfficerProfileScreen}
        options={{ tabBarLabel: t("tabs.profile", "Profile") }}
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
    fontSize: 12,
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
