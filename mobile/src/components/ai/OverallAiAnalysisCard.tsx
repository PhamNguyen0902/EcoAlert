import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AlertCircle, BrainCircuit, Sparkles } from "lucide-react-native";
import type { Alert } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { Card } from "../ui/Card";

const percentage = (value?: number | null) => value === null || value === undefined ? "N/A" : `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
const humanize = (value?: string | null) => value ? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Chưa phân loại";

export const OverallAiAnalysisCard: React.FC<{ alert: Alert }> = ({ alert }) => {
  const { colors, isDark } = useTheme();
  const analysis = alert.aiOverallAnalysis;
  if (!analysis) {
    if (alert.aiAnalysisMode !== "VISION_ONLY") return null;
    return (
      <Card style={[styles.card, { borderColor: colors.primary, backgroundColor: isDark ? "rgba(22,101,52,0.16)" : "#F0FDF4" }]}>
        <View style={styles.header}><BrainCircuit size={18} color={colors.primary} /><View style={styles.headerText}><Text style={[styles.title, { color: colors.text }]}>AI phân tích tổng quan</Text></View></View>
        <Text style={[styles.summary, { color: colors.textMuted }]}>Phân tích ngữ nghĩa hiện không khả dụng. Vision vẫn đã nhận diện được các vật thể trong ảnh.</Text>
      </Card>
    );
  }
  const unclassified = analysis.classificationStatus === "UNCLASSIFIED";
  return (
    <Card style={[styles.card, { borderColor: colors.primary, backgroundColor: isDark ? "rgba(22,101,52,0.16)" : "#F0FDF4" }]}>
      <View style={styles.header}><BrainCircuit size={18} color={colors.primary} /><View style={styles.headerText}><Text style={[styles.title, { color: colors.text }]}>AI phân tích tổng quan</Text><Text style={[styles.subtitle, { color: colors.textMuted }]}>Gợi ý cần con người xác nhận</Text></View><Text style={[styles.tier, { color: colors.textMuted, borderColor: colors.border }]}>{analysis.confidenceTier === "HIGH_CONFIDENCE" ? "Độ tin cậy cao" : unclassified ? "Chưa phân loại" : "Cần xác nhận"}</Text></View>
      <Text style={[styles.summary, { color: colors.text }]}>{analysis.overallSummary}</Text>
      <Text style={[styles.reason, { color: colors.textMuted }]}>Lý do ngắn: {analysis.shortReason}</Text>
      <View style={[styles.metrics, { borderColor: colors.border, backgroundColor: colors.surface }]}><Metric label="Danh mục AI" value={humanize(analysis.categorySuggestion)} colors={colors} /><Metric label="Tin cậy" value={percentage(analysis.categoryConfidence)} colors={colors} /><Metric label="Mức độ" value={humanize(analysis.severity)} colors={colors} /><Metric label="Sự cố" value={analysis.isIncident ? "Có khả năng" : "Chưa đủ bằng chứng"} colors={colors} /></View>
      {analysis.visionEvidenceUsed.length ? <View style={styles.evidence}><Sparkles size={14} color={colors.primary} /><Text style={[styles.evidenceText, { color: colors.textMuted }]}>Vision hỗ trợ: {analysis.visionEvidenceUsed.join(" · ")}</Text></View> : <View style={styles.evidence}><AlertCircle size={14} color={colors.textMuted} /><Text style={[styles.evidenceText, { color: colors.textMuted }]}>Không có đối tượng rác EcoAlert được dùng làm bằng chứng; điều này không tự động phủ nhận sự cố.</Text></View>}
    </Card>
  );
};

const Metric = ({ label, value, colors }: { label: string; value: string; colors: any }) => <View style={styles.metric}><Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text><Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text></View>;
const styles = StyleSheet.create({ card: { padding: 16, marginBottom: 14, borderWidth: 1, borderRadius: 18 }, header: { flexDirection: "row", alignItems: "flex-start", gap: 8 }, headerText: { flex: 1 }, title: { fontSize: 15, fontWeight: "800" }, subtitle: { fontSize: 10, marginTop: 2 }, tier: { fontSize: 9, fontWeight: "700", borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 }, summary: { fontSize: 13, lineHeight: 20, marginTop: 14 }, reason: { fontSize: 11, lineHeight: 17, marginTop: 8 }, metrics: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 12, rowGap: 10 }, metric: { width: "50%", paddingRight: 8 }, metricLabel: { fontSize: 10, fontWeight: "600" }, metricValue: { fontSize: 11, fontWeight: "800", marginTop: 3 }, evidence: { flexDirection: "row", gap: 7, alignItems: "flex-start", marginTop: 12 }, evidenceText: { flex: 1, fontSize: 10, lineHeight: 15 } });
