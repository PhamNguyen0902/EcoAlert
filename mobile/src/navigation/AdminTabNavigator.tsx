import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  LayoutDashboard,
  ShieldCheck,
  User as UserIcon,
  Users,
  Tag,
  Activity,
  Edit2,
  KeyRound,
} from "lucide-react-native";
import { AdminDashboardScreen } from "../screens/admin/AdminDashboardScreen";
import { UserManagementScreen } from "../screens/admin/UserManagementScreen";
import { CategoryManagementScreen } from "../screens/admin/CategoryManagementScreen";
import { AuditLogsScreen } from "../screens/admin/AuditLogsScreen";
import { AlertDetailScreen } from "../screens/citizen/AlertDetailScreen";
import { useProfile, useLogout } from "../hooks/useAuth";
import { EditProfileModal } from "../components/modals/EditProfileModal";
import { ChangePasswordModal } from "../components/modals/ChangePasswordModal";
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
  const [isEditProfileOpen, setEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setChangePasswordOpen] = useState(false);

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

          <View style={styles.profileActions}>
            <Button
              title="Edit Profile"
              variant="outline"
              onPress={() => setEditProfileOpen(true)}
              style={styles.profileActionBtn}
              icon={<Edit2 size={16} color="#7C3AED" style={{ marginRight: 6 }} />}
            />
            <Button
              title="Change Password"
              variant="outline"
              onPress={() => setChangePasswordOpen(true)}
              style={styles.profileActionBtn}
              icon={<KeyRound size={16} color="#7C3AED" style={{ marginRight: 6 }} />}
            />
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

      <EditProfileModal
        visible={isEditProfileOpen}
        user={profile || null}
        onClose={() => setEditProfileOpen(false)}
      />
      <ChangePasswordModal
        visible={isChangePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
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
          } else if (route.name === "AdminUsersTab") {
            return <Users color={color} size={size} />;
          } else if (route.name === "AdminCategoriesTab") {
            return <Tag color={color} size={size} />;
          } else if (route.name === "AdminAuditTab") {
            return <Activity color={color} size={size} />;
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
        name="AdminUsersTab"
        component={UserManagementScreen}
        options={{ tabBarLabel: "Users" }}
      />
      <Tab.Screen
        name="AdminCategoriesTab"
        component={CategoryManagementScreen}
        options={{ tabBarLabel: "Categories" }}
      />
      <Tab.Screen
        name="AdminAuditTab"
        component={AuditLogsScreen}
        options={{ tabBarLabel: "Audit" }}
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
  },
  tabLabel: {
    fontSize: 11,
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
  },
  profileEmail: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
  roleTag: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 6,
    backgroundColor: "#F3E8FF",
    borderRadius: 20,
    alignSelf: "center",
  },
  roleText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7C3AED",
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
    marginTop: 16,
    paddingHorizontal: 36,
    minWidth: 180,
    alignSelf: "center",
    borderRadius: 16,
  },
});
