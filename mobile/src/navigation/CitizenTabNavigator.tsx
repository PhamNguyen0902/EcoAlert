import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Bot, LayoutDashboard, PlusCircle, FileText, User as UserIcon, Edit2, KeyRound } from "lucide-react-native";
import { CitizenDashboardScreen } from "../screens/citizen/CitizenDashboardScreen";
import { ReportIncidentScreen } from "../screens/citizen/ReportIncidentScreen";
import { MyReportsScreen } from "../screens/citizen/MyReportsScreen";
import { AlertDetailScreen } from "../screens/citizen/AlertDetailScreen";
import { AssistantScreen } from "../screens/citizen/AssistantScreen";
import { NotificationsScreen } from "../screens/citizen/NotificationsScreen";
import { WeatherDetailsScreen } from "../screens/citizen/WeatherDetailsScreen";
import { useProfile, useLogout } from "../hooks/useAuth";
import { EditProfileModal } from "../components/modals/EditProfileModal";
import { ChangePasswordModal } from "../components/modals/ChangePasswordModal";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";
import { SettingsSection } from "../components/ui/SettingsSection";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { LocationPickerScreen } from "../screens/LocationPickerScreen";
import type { CitizenStackParamList, CitizenTabParamList } from "./types";

const Tab = createBottomTabNavigator<CitizenTabParamList>();
const Stack = createNativeStackNavigator<CitizenStackParamList>();

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
          <View style={[styles.avatarBox, { backgroundColor: colors.primaryLight }]}>
            <UserIcon size={40} color={colors.primary} />
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>
            {formatProfileName(profile?.fullName)}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
            {profile?.email || "citizen@ecoalert.org"}
          </Text>
          <View style={[styles.roleTag, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.roleText, { color: colors.primaryDark }]}>
              {profile?.role ? t(`profile.${profile.role.toLowerCase()}Role`, profile.role) : t("profile.citizenRole")}
            </Text>
          </View>

          <View style={styles.profileActions}>
            <Button
              title={t("profile.editProfile", "Edit Profile")}
              variant="outline"
              onPress={() => setEditProfileOpen(true)}
              style={styles.profileActionBtn}
              icon={<Edit2 size={16} color={colors.primary} style={{ marginRight: 6 }} />}
            />
            <Button
              title={t("profile.changePassword", "Change Password")}
              variant="outline"
              onPress={() => setChangePasswordOpen(true)}
              style={styles.profileActionBtn}
              icon={<KeyRound size={16} color={colors.primary} style={{ marginRight: 6 }} />}
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

const CitizenTabs = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();

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
          } else if (route.name === "MyReportsTab") {
            return <FileText color={color} size={size} />;
          } else if (route.name === "AssistantTab") {
            return <Bot color={color} size={size} />;
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
        options={{ tabBarLabel: t("tabs.dashboard", "Dashboard") }}
      />
      <Tab.Screen
        name="ReportTab"
        component={ReportIncidentScreen}
        options={{ tabBarLabel: t("tabs.reportAlert", "Report Alert") }}
      />
      <Tab.Screen
        name="MyReportsTab"
        component={MyReportsScreen}
        options={{ tabBarLabel: t("tabs.myReports", "My Reports") }}
      />
      <Tab.Screen
        name="AssistantTab"
        component={AssistantScreen}
        options={{ tabBarLabel: t("tabs.assistant", "Assistant") }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: t("tabs.profile", "Profile") }}
      />
    </Tab.Navigator>
  );
};

export const CitizenTabNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CitizenTabs" component={CitizenTabs} />
      <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
      <Stack.Screen name="LocationPicker" component={LocationPickerScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="WeatherDetails" component={WeatherDetailsScreen} />
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
    fontSize: 10,
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
