import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowLeft, Bell, Navigation } from "lucide-react-native";
import { useTheme } from "../../../context/ThemeContext";

interface Props { onBack: () => void; avatarLabel?: string; }

export const ReportHeader = ({ onBack, avatarLabel = "EA" }: Props) => {
  const { colors, isDark } = useTheme();
  return <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
    <TouchableOpacity onPress={onBack} style={styles.touchButton} accessibilityRole="button" accessibilityLabel="Quay lại"><ArrowLeft size={21} color={colors.text} /></TouchableOpacity>
    <View style={styles.brand}><View style={[styles.brandMark, { backgroundColor: isDark ? "rgba(34,197,94,0.14)" : colors.primaryLight }]}><Navigation size={16} color={colors.primary} fill={colors.primary} /></View><View><Text style={[styles.brandName, { color: colors.text }]}>Báo Cáo</Text><Text style={[styles.brandTag, { color: colors.primary }]}>ECOALERT</Text></View></View>
    <View style={styles.actions}><TouchableOpacity disabled style={styles.touchButton} accessibilityRole="button" accessibilityLabel="Thông báo"><Bell size={19} color={colors.textMuted} /></TouchableOpacity><View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}><Text style={[styles.avatarText, { color: colors.primary }]}>{avatarLabel.slice(0, 2).toUpperCase()}</Text></View></View>
  </View>;
};

const styles = StyleSheet.create({ header: { height: 58, borderBottomWidth: 1, paddingHorizontal: 8, flexDirection: "row", alignItems: "center" }, touchButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, brand: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }, brandMark: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" }, brandName: { fontSize: 14, fontWeight: "900" }, brandTag: { fontSize: 8, fontWeight: "900", letterSpacing: 1 }, actions: { flexDirection: "row", alignItems: "center" }, avatar: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 6 }, avatarText: { fontSize: 10, fontWeight: "900" } });
