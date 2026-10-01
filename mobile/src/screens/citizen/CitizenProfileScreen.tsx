import React from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogIn, LogOut, Mail, ShieldCheck, UserCircle2 } from "lucide-react-native";
import { useProfile, useLogout } from "../../hooks/useAuth";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";

export const CitizenProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const { data: profile } = useProfile();
  const logout = useLogout();

  const copy = language === "vi"
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
        logoutBody: "You will need to sign in again to submit and track reports.",
        cancel: "Cancel",
      };

  const openLogin = () => {
    navigation.getParent?.()?.getParent?.()?.navigate("Login");
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
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{copy.subtitle}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: isDark ? "#14532D" : "#DCFCE7" }]}>
            {profile ? <Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text> : <UserCircle2 size={38} color={colors.primary} />}
          </View>
          <View style={styles.profileCopy}>
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>{profile ? copy.signedInAs : copy.guest}</Text>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{fullName}</Text>
            {profile?.email ? <Text style={[styles.email, { color: colors.textMuted }]} numberOfLines={1}>{profile.email}</Text> : null}
          </View>
        </Card>

        {profile ? (
          <Card style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Mail size={18} color={colors.primary} />
              <View style={styles.detailCopy}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Email</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{profile.email || "—"}</Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.detailRow}>
              <ShieldCheck size={18} color={colors.primary} />
              <View style={styles.detailCopy}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Vai trò</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{copy.role}</Text>
              </View>
            </View>
          </Card>
        ) : (
          <Card style={styles.detailCard}>
            <Text style={[styles.guestBody, { color: colors.textMuted }]}>{copy.guestBody}</Text>
          </Card>
        )}

        <Button
          title={profile ? copy.logout : copy.signIn}
          variant={profile ? "destructive" : "primary"}
          loading={logout.isPending}
          onPress={profile ? confirmLogout : openLogin}
          icon={profile ? <LogOut size={18} color="#FFF" /> : <LogIn size={18} color="#FFF" />}
          style={styles.actionButton}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: 1 },
  title: { fontSize: 23, fontWeight: "900" },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  profileCard: { padding: 18, flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 25, fontWeight: "900" },
  profileCopy: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 },
  name: { fontSize: 18, fontWeight: "900", marginTop: 3 },
  email: { fontSize: 12, marginTop: 3 },
  detailCard: { padding: 16 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  detailCopy: { flex: 1 },
  detailLabel: { fontSize: 11, fontWeight: "700" },
  detailValue: { fontSize: 14, fontWeight: "800", marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  guestBody: { fontSize: 13, lineHeight: 20 },
  actionButton: { marginTop: 2 },
});
