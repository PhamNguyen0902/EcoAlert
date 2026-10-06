import React from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  UserCircle2,
} from "lucide-react-native";
import { useProfile, useLogout } from "../../hooks/useAuth";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useCivicTheme } from "../../theme/useCivicTheme";
import {
  civicSpace as space,
  civicRadius as radius,
  civicType,
  civicStyles,
} from "../../theme/civicDesign";
import { CitizenHeader } from "../../components/citizen/CitizenHeader";
import { useLanguage } from "../../context/LanguageContext";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import type {
  CitizenStackParamList,
  RootStackParamList,
} from "../../navigation/types";

export const CitizenProfileScreen: React.FC<
  NativeStackScreenProps<CitizenStackParamList, "Profile">
> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useCivicTheme();
  const { language } = useLanguage();
  const { data: profile } = useProfile();
  const logout = useLogout();

  const copy =
    language === "vi"
      ? {
          title: "Thông tin cá nhân",
          subtitle: "Quản lý phiên đăng nhập EcoAlert của bạn.",
          signedInAs: "Tài khoản đang đăng nhập",
          guest: "Bạn chưa đăng nhập",
          guestBody: "Đăng nhập để theo dõi và quản lý các báo cáo của bạn.",
          role: "Công dân",
          signIn: "Đăng nhập",
          logout: "Đăng xuất",
          logoutTitle: "Đăng xuất khỏi EcoAlert?",
          logoutBody: "Bạn sẽ cần đăng nhập lại để gửi và theo dõi báo cáo.",
          cancel: "Hủy",
        }
      : {
          title: "Profile",
          subtitle: "Manage your EcoAlert sign-in session.",
          signedInAs: "Signed-in account",
          guest: "You are not signed in",
          guestBody: "Sign in to track and manage your reports.",
          role: "Citizen",
          signIn: "Sign in",
          logout: "Sign out",
          logoutTitle: "Sign out of EcoAlert?",
          logoutBody:
            "You will need to sign in again to submit and track reports.",
          cancel: "Cancel",
        };

  const openLogin = () => {
    navigation
      .getParent<NativeStackNavigationProp<RootStackParamList>>()
      ?.navigate("Login");
  };

  const confirmLogout = () => {
    Alert.alert(copy.logoutTitle, copy.logoutBody, [
      { text: copy.cancel, style: "cancel" },
      {
        text: copy.logout,
        style: "destructive",
        onPress: () => logout.mutate(),
      },
    ]);
  };

  const fullName = profile?.fullName || profile?.email || "EcoAlert Citizen";
  const initial = fullName.trim().charAt(0).toUpperCase();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <CitizenHeader avatarLabel={initial} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: space.sm }}>
          <Text style={[civicType.title, { color: colors.text }]}>
            {copy.title}
          </Text>
          <Text style={[civicType.body, { color: colors.textMuted }]}>
            {copy.subtitle}
          </Text>
        </View>
        <Card appearance="civic" style={styles.profileCard}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: isDark ? "#14532D" : "#DCFCE7" },
            ]}
          >
            {profile ? (
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {initial}
              </Text>
            ) : (
              <UserCircle2 size={38} color={colors.primary} />
            )}
          </View>
          <View style={styles.profileCopy}>
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
              {profile ? copy.signedInAs : copy.guest}
            </Text>
            <Text
              style={[styles.name, { color: colors.text }]}
              numberOfLines={2}
            >
              {fullName}
            </Text>
            {profile?.email ? (
              <Text
                style={[styles.email, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {profile.email}
              </Text>
            ) : null}
          </View>
        </Card>

        {profile ? (
          <Card appearance="civic" style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Mail size={18} color={colors.primary} />
              <View style={styles.detailCopy}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  Email
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {profile.email || "—"}
                </Text>
              </View>
            </View>
            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />
            <View style={styles.detailRow}>
              <ShieldCheck size={18} color={colors.primary} />
              <View style={styles.detailCopy}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  Vai trò
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {copy.role}
                </Text>
              </View>
            </View>
          </Card>
        ) : (
          <Card appearance="civic" style={styles.detailCard}>
            <Text style={[styles.guestBody, { color: colors.textMuted }]}>
              {copy.guestBody}
            </Text>
          </Card>
        )}

        <Button
          appearance="civic"
          title={profile ? copy.logout : copy.signIn}
          variant={profile ? "destructive" : "primary"}
          loading={logout.isPending}
          onPress={profile ? confirmLogout : openLogin}
          icon={
            profile ? (
              <LogOut size={18} color="#FFF" />
            ) : (
              <LogIn size={18} color="#FFF" />
            )
          }
          style={styles.actionButton}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: civicStyles.content,
  profileCard: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 24, fontWeight: "800" },
  profileCopy: { flex: 1, minWidth: 0, gap: space.xs },
  eyebrow: civicType.eyebrow,
  name: civicType.section,
  email: civicType.meta,
  detailCard: { gap: space.lg },
  detailRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  detailCopy: { flex: 1, minWidth: 0, gap: space.xs },
  detailLabel: civicType.meta,
  detailValue: civicType.cardTitle,
  divider: { height: StyleSheet.hairlineWidth },
  guestBody: civicType.body,
  actionButton: {},
});
