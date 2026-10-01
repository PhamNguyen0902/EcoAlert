import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Check, ChevronRight, Clock3, FileText, Home, MapPin, WifiOff } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CitizenStackParamList, ReportFlowParamList } from "../../../navigation/types";
import { useTheme } from "../../../context/ThemeContext";
import { useAlert } from "../../../hooks/useAlerts";
import { getCategoryLabel, getWorkflowStatusLabel } from "../../../utils/aiAnalysis";
import { useFieldReport } from "../FieldReportContext";
import { formatAlertReference } from "../utils";

type Props = NativeStackScreenProps<ReportFlowParamList, "ReportSuccess">;

export const ReportSuccessScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { draft, resetDraft } = useFieldReport();
  const queued = route.params?.queued === true;
  const alertId = route.params?.alertId || draft.createdAlert?._id || "";
  const alertQuery = useAlert(alertId);
  const alert = draft.createdAlert ?? alertQuery.data;
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<CitizenStackParamList>>();
  const verified = alert?.status?.toUpperCase() === "VERIFIED";
  const statusLabel = queued ? "ĐÃ LƯU NGOẠI TUYẾN" : verified ? "ĐÃ XÁC MINH" : "ĐÃ GHI NHẬN";

  const goHome = () => {
    resetDraft();
    rootNavigation?.navigate("CitizenTabs", { screen: "DashboardTab" });
  };
  const viewProgress = () => {
    if (!alertId) return;
    resetDraft();
    rootNavigation?.navigate("AlertDetail", { id: alertId });
  };

  return <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}><ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 18) + 18 }]} showsVerticalScrollIndicator={false}>
    <View style={styles.hero}><View style={[styles.glow, { backgroundColor: queued ? "rgba(245,158,11,0.10)" : "rgba(34,197,94,0.10)" }]}><View style={[styles.successIcon, { backgroundColor: queued ? colors.accent : colors.primary }]}>{queued ? <WifiOff size={31} color="#07101F" /> : <Check size={34} color="#07101F" strokeWidth={3} />}</View></View><Text style={[styles.statusChip, { color: queued ? colors.accent : colors.primary, borderColor: queued ? "rgba(245,158,11,0.3)" : "rgba(34,197,94,0.3)", backgroundColor: queued ? "rgba(245,158,11,0.08)" : "rgba(34,197,94,0.08)" }]}>{statusLabel}</Text><Text style={[styles.title, { color: colors.text }]}>{queued ? "Báo cáo đã được lưu!" : "Báo cáo đã được gửi!"}</Text>{alertId ? <Text style={[styles.reference, { color: colors.secondary }]}>{formatAlertReference(alertId)}</Text> : null}<Text style={[styles.description, { color: colors.textMuted }]}>{queued ? "EcoAlert sẽ tải ảnh và gửi báo cáo khi thiết bị kết nối mạng trở lại." : "EcoAlert đã ghi nhận báo cáo của bạn. Bạn sẽ nhận được thông báo khi trạng thái xử lý thay đổi."}</Text></View>
    <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.summaryHeader}><FileText size={17} color={colors.primary} /><Text style={[styles.technicalLabel, { color: colors.textMuted }]}>CHI TIẾT HỒ SƠ TIẾP NHẬN</Text></View><SummaryRow label="Loại sự cố" value={alert?.category ? getCategoryLabel(alert.category, "vi") : draft.imageValidation.suggestedCategory ? getCategoryLabel(draft.imageValidation.suggestedCategory, "vi") : "Rác thải cần kiểm tra"} colors={colors} /><SummaryRow label="Địa điểm" value={alert?.address || draft.location?.address || "Chưa xác định"} icon={<MapPin size={14} color={colors.secondary} />} colors={colors} /><SummaryRow label="Trạng thái" value={queued ? "Chờ kết nối để đồng bộ" : alert ? getWorkflowStatusLabel(alert.status, "vi") : "Đã ghi nhận"} icon={<Clock3 size={14} color={queued ? colors.accent : colors.primary} />} colors={colors} last /></View>
    {!queued && alertId ? <TouchableOpacity onPress={viewProgress} style={[styles.primaryButton, { backgroundColor: colors.primary }]} accessibilityRole="button"><Text style={styles.primaryText}>XEM TIẾN TRÌNH XỬ LÝ</Text><ChevronRight size={18} color="#07101F" /></TouchableOpacity> : null}<TouchableOpacity onPress={goHome} style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.surface }]} accessibilityRole="button"><Home size={17} color={colors.text} /><Text style={[styles.secondaryText, { color: colors.text }]}>Về trang chủ</Text></TouchableOpacity>
  </ScrollView></View>;
};

const SummaryRow = ({ label, value, icon, colors, last = false }: { label: string; value: string; icon?: React.ReactNode; colors: { text: string; textMuted: string; border: string }; last?: boolean }) => <View style={[styles.summaryRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}><View style={styles.summaryLabelRow}>{icon}<Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{label}</Text></View><Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text></View>;
const styles = StyleSheet.create({ container: { flex: 1 }, content: { flexGrow: 1, padding: 20, justifyContent: "center", gap: 16 }, hero: { alignItems: "center", paddingVertical: 10 }, glow: { width: 116, height: 116, borderRadius: 58, alignItems: "center", justifyContent: "center" }, successIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" }, statusChip: { overflow: "hidden", marginTop: 17, borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }, title: { marginTop: 13, fontSize: 24, lineHeight: 30, fontWeight: "900", textAlign: "center", letterSpacing: -0.5 }, reference: { marginTop: 6, fontSize: 14, fontWeight: "900", letterSpacing: 0.7 }, description: { marginTop: 10, maxWidth: 330, fontSize: 13, lineHeight: 20, textAlign: "center" }, summaryCard: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 }, summaryHeader: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 7 }, technicalLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.9 }, summaryRow: { paddingVertical: 13 }, summaryLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 }, summaryLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 }, summaryValue: { marginTop: 5, fontSize: 12, lineHeight: 18, fontWeight: "800" }, primaryButton: { minHeight: 52, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, primaryText: { color: "#07101F", fontSize: 11, fontWeight: "900", letterSpacing: 0.45 }, secondaryButton: { minHeight: 50, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, secondaryText: { fontSize: 11, fontWeight: "800" } });
