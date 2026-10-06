import React, { useRef } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Leaf, LogOut, Mail, ShieldCheck } from "lucide-react-native";
import { useProfile, useLogout } from "../../hooks/useAuth";
import { useLanguage } from "../../context/LanguageContext";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { InlineBanner } from "../../components/ui/InlineBanner";
import {
  civicRadius as radius,
  civicSpace as space,
  civicStyles,
  civicType,
} from "../../theme/civicDesign";

export const OfficerProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useCivicTheme();
  const { language } = useLanguage();
  const { data: profile } = useProfile();
  const logout = useLogout();
  const confirmationOpen = useRef(false);

  const copy = language === "vi" ? {
    title: "Thông tin cán bộ",
    subtitle: "Quản lý tài khoản và phiên đăng nhập EcoAlert.",
    account: "Tài khoản đang đăng nhập",
    roleLabel: "Vai trò",
    role: "Cán bộ",
    logout: "Đăng xuất",
    loggingOut: "Đang đăng xuất...",
    dialogTitle: "Đăng xuất khỏi EcoAlert?",
    dialogBody: "Bạn sẽ cần đăng nhập lại để tiếp tục xử lý nhiệm vụ.",
    cancel: "Hủy",
    error: "Không thể đăng xuất. Vui lòng thử lại.",
  } : {
    title: "Officer profile",
    subtitle: "Manage your EcoAlert account and sign-in session.",
    account: "Signed-in account",
    roleLabel: "Role",
    role: "Officer",
    logout: "Sign out",
    loggingOut: "Signing out...",
    dialogTitle: "Sign out of EcoAlert?",
    dialogBody: "You will need to sign in again to continue handling tasks.",
    cancel: "Cancel",
    error: "Unable to sign out. Please try again.",
  };

  const confirmLogout = () => {
    if (logout.isPending || confirmationOpen.current) return;
    confirmationOpen.current = true;
    Alert.alert(copy.dialogTitle, copy.dialogBody, [
      {
        text: copy.cancel,
        style: "cancel",
        onPress: () => { confirmationOpen.current = false; },
      },
      {
        text: copy.logout,
        style: "destructive",
        onPress: () => {
          confirmationOpen.current = false;
          logout.mutate();
        },
      },
    ], {
      cancelable: true,
      onDismiss: () => { confirmationOpen.current = false; },
    });
  };

  const fullName: string = profile?.fullName?.trim() || profile?.email || "—";
  const initials = fullName === "—" ? "EA" : fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .filter((_, index, letters) => index === 0 || index === letters.length - 1)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={[
      styles.container,
      { backgroundColor: colors.background, paddingTop: insets.top },
    ]}>
      <View style={[
        styles.header,
        { backgroundColor: colors.surface, borderBottomColor: colors.divider },
      ]}>
        <Leaf size={22} color={colors.primary} />
        <Text style={[civicType.section, { color: colors.text }]}>EcoAlert</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={[civicType.title, { color: colors.text }]}>
            {copy.title}
          </Text>
          <Text style={[civicType.body, { color: colors.textMuted }]}>
            {copy.subtitle}
          </Text>
        </View>

        <Card appearance="civic" style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: colors.greenSoft }]}>
            <Text style={[styles.initials, { color: colors.primary }]}>{initials}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={[civicType.eyebrow, { color: colors.textMuted }]}>{copy.account}</Text>
            <Text style={[civicType.section, { color: colors.text }]}>{fullName}</Text>
            <Text style={[civicType.body, { color: colors.textMuted }]}>{profile?.email || "—"}</Text>
          </View>
        </Card>

        <Card appearance="civic" style={styles.details}>
          <View style={styles.detailRow}>
            <Mail size={18} color={colors.primary} />
            <View style={styles.detailCopy}>
              <Text style={[civicType.meta, { color: colors.textMuted }]}>Email</Text>
              <Text style={[civicType.cardTitle, { color: colors.text }]}>{profile?.email || "—"}</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />
          <View style={styles.detailRow}>
            <ShieldCheck size={18} color={colors.primary} />
            <View style={styles.detailCopy}>
              <Text style={[civicType.meta, { color: colors.textMuted }]}>{copy.roleLabel}</Text>
              <Text style={[civicType.cardTitle, { color: colors.text }]}>{copy.role}</Text>
            </View>
          </View>
        </Card>

        {logout.isError && <InlineBanner message={copy.error} type="error" />}
        <Button
          appearance="civic"
          variant="destructive"
          title={logout.isPending ? copy.loggingOut : copy.logout}
          loading={logout.isPending}
          disabled={logout.isPending}
          onPress={confirmLogout}
          accessibilityLabel={copy.logout}
          accessibilityState={{ disabled: logout.isPending, busy: logout.isPending }}
          icon={<LogOut size={18} color="#F8FAFC" />}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 58,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  content: civicStyles.content,
  heading: { gap: space.sm },
  profileCard: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { fontSize: 22, fontWeight: "800" },
  profileCopy: { flex: 1, minWidth: 0, gap: space.xs },
  details: { gap: space.lg },
  detailRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  detailCopy: { flex: 1, minWidth: 0, gap: space.xs },
  divider: { height: StyleSheet.hairlineWidth },
});
