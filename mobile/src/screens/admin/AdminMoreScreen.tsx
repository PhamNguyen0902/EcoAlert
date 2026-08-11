import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Activity, Bot, ChevronRight, FileCog, Settings2, ShieldCheck, Tag, UserRound, Users, Bell } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfile } from "../../hooks/useAuth";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { Card } from "../../components/ui/Card";
import { SettingsSection } from "../../components/ui/SettingsSection";

export const AdminMoreScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const { data: profile } = useProfile();
  const copy = language === "vi" ? { title: "Thêm", subtitle: "Công cụ quản trị và cài đặt", account: "Tài khoản", users: "Quản lý người dùng", usersSub: "Vai trò, trạng thái và tài khoản", categories: "Danh mục", categoriesSub: "Danh mục và mức độ mặc định", audit: "Nhật ký hoạt động", auditSub: "Lịch sử thao tác hệ thống", assistant: "EcoAlert AI", assistantSub: "Hướng dẫn vận hành được phân quyền", notifications: "Thông báo", notificationsSub: "Cập nhật hệ thống và sự cố", profile: "Hồ sơ & bảo mật", profileSub: "Thông tin cá nhân, mật khẩu", settings: "Cài đặt ứng dụng" } : { title: "More", subtitle: "Administrative tools and settings", account: "Account", users: "User management", usersSub: "Roles, status, and accounts", categories: "Categories", categoriesSub: "Categories and default severity", audit: "Activity logs", auditSub: "System action history", assistant: "EcoAlert AI", assistantSub: "Authorized operational guidance", notifications: "Notifications", notificationsSub: "System and incident updates", profile: "Profile & security", profileSub: "Personal details and password", settings: "App settings" };
  const items = [
    { label: copy.users, subtitle: copy.usersSub, icon: Users, screen: "AdminUsers" },
    { label: copy.categories, subtitle: copy.categoriesSub, icon: Tag, screen: "AdminCategories" },
    { label: copy.audit, subtitle: copy.auditSub, icon: Activity, screen: "AdminAudit" },
    { label: copy.assistant, subtitle: copy.assistantSub, icon: Bot, screen: "AdminAssistant" },
    { label: copy.notifications, subtitle: copy.notificationsSub, icon: Bell, screen: "Notifications" },
    { label: copy.profile, subtitle: copy.profileSub, icon: UserRound, screen: "AdminProfile" },
  ];
  return <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]}><Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text><Text style={[styles.subtitle, { color: colors.textMuted }]}>{copy.subtitle}</Text><Card style={styles.identity}><View style={[styles.identityIcon, { backgroundColor: isDark ? "rgba(124,58,237,0.32)" : "#F3E8FF" }]}><ShieldCheck size={25} color="#7C3AED" /></View><View style={{ flex: 1 }}><Text style={[styles.name, { color: colors.text }]}>{profile?.fullName || "EcoAlert Admin"}</Text><Text style={[styles.email, { color: colors.textMuted }]}>{profile?.email}</Text></View></Card><Text style={[styles.sectionTitle, { color: colors.text }]}>{copy.account}</Text>{items.map((item) => { const Icon = item.icon; return <TouchableOpacity key={item.screen} onPress={() => navigation.getParent?.()?.navigate(item.screen)} accessibilityRole="button" accessibilityLabel={item.label}><Card style={styles.item}><View style={[styles.itemIcon, { backgroundColor: isDark ? "rgba(124,58,237,0.25)" : "#F3E8FF" }]}><Icon size={20} color="#7C3AED" /></View><View style={styles.itemCopy}><Text style={[styles.itemTitle, { color: colors.text }]}>{item.label}</Text><Text style={[styles.itemSub, { color: colors.textMuted }]}>{item.subtitle}</Text></View><ChevronRight size={18} color={colors.textMuted} /></Card></TouchableOpacity>; })}<Text style={[styles.sectionTitle, { color: colors.text }]}>{copy.settings}</Text><SettingsSection /></ScrollView>;
};

const styles = StyleSheet.create({ container: { flex: 1 }, content: { padding: 16, paddingBottom: 36 }, title: { fontSize: 24, fontWeight: "900" }, subtitle: { fontSize: 13, marginTop: 3 }, identity: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, borderRadius: 18, marginTop: 18, marginBottom: 22 }, identityIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" }, name: { fontSize: 16, fontWeight: "800" }, email: { fontSize: 11, marginTop: 3 }, sectionTitle: { fontSize: 14, fontWeight: "900", marginBottom: 9 }, item: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 16, marginBottom: 9 }, itemIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" }, itemCopy: { flex: 1 }, itemTitle: { fontSize: 14, fontWeight: "800" }, itemSub: { fontSize: 11, lineHeight: 16, marginTop: 2 } });
