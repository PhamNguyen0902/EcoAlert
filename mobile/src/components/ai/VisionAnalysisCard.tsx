import React, { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Eye, Image as ImageIcon, ScanSearch } from "lucide-react-native";
import { Alert } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { Card } from "../ui/Card";

const humanize = (value?: string) => value
  ? value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  : "Not determined";
const percentage = (value: number | null | undefined) =>
  value === null || value === undefined ? "N/A" : `${Math.round(value * 100)}%`;

export const VisionAnalysisCard: React.FC<{ alert: Alert }> = ({ alert }) => {
  const { colors, isDark } = useTheme();
  const [showAnnotation, setShowAnnotation] = useState(false);
  const vision = alert.aiVision;
  const fusion = alert.aiFusion;
  if (!vision && !fusion) return null;

  return (
    <Card style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <ScanSearch size={18} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Vision evidence</Text>
        </View>
        <Text style={[styles.mode, { color: colors.textMuted, borderColor: colors.border }]}>
          {humanize(fusion?.mode || vision?.status)}
        </Text>
      </View>

      <View style={styles.grid}>
        <Metric label="Waste type" value={humanize(fusion?.wasteType)} colors={colors} />
        <Metric label="Objects" value={String(vision?.totalDetectedObjects ?? 0)} colors={colors} />
        <Metric label="Coverage" value={percentage(vision?.visibleWasteCoverage)} colors={colors} />
        <Metric label="Severity score" value={fusion ? `${fusion.severityScore}/100` : "N/A"} colors={colors} />
      </View>

      {vision?.objectCounts.length ? (
        <Text style={[styles.counts, { color: colors.textMuted }]}>
          {vision.objectCounts.slice(0, 4).map((item) => `${item.label}: ${item.count}`).join(" · ")}
        </Text>
      ) : null}

      {fusion ? (
        <View style={[styles.confidenceRow, { borderColor: colors.border, backgroundColor: isDark ? "rgba(15,23,42,0.4)" : colors.background }]}>
          <Metric label="Semantic" value={percentage(fusion.semanticConfidence)} colors={colors} compact />
          <Metric label="Detector" value={percentage(fusion.visionConfidence)} colors={colors} compact />
          <Metric label="Fusion" value={percentage(fusion.fusionConfidence)} colors={colors} compact />
        </View>
      ) : null}

      {fusion?.explanations[0] ? <Text style={[styles.explanation, { color: colors.textMuted }]}>{fusion.explanations[0]}</Text> : null}

      {vision?.annotatedImageUrl ? (
        <>
          <TouchableOpacity
            style={[styles.imageButton, { borderColor: colors.border }]}
            onPress={() => setShowAnnotation((value) => !value)}
            accessibilityRole="button"
          >
            {showAnnotation ? <Eye size={16} color={colors.primary} /> : <ImageIcon size={16} color={colors.primary} />}
            <Text style={[styles.imageButtonText, { color: colors.primary }]}>{showAnnotation ? "Hide AI image" : "View AI image"}</Text>
          </TouchableOpacity>
          {showAnnotation ? (
            <Image source={{ uri: vision.annotatedImageUrl }} style={styles.annotation} resizeMode="contain" accessibilityLabel="AI annotated incident image" />
          ) : null}
        </>
      ) : null}

      <Text style={[styles.disclaimer, { color: colors.textMuted }]}>Triage evidence only. Verify against the original image.</Text>
    </Card>
  );
};

const Metric = ({ label, value, colors, compact = false }: { label: string; value: string; colors: any; compact?: boolean }) => (
  <View style={compact ? styles.compactMetric : styles.metric}>
    <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
    <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 20, borderWidth: 1, borderRadius: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontWeight: "800" },
  mode: { fontSize: 9, fontWeight: "700", borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 14, rowGap: 12 },
  metric: { width: "50%", paddingRight: 8 },
  compactMetric: { flex: 1, alignItems: "center" },
  label: { fontSize: 10, fontWeight: "600" },
  value: { fontSize: 12, fontWeight: "800", marginTop: 3 },
  counts: { fontSize: 11, lineHeight: 17, marginTop: 12 },
  confidenceRow: { flexDirection: "row", borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 12 },
  explanation: { fontSize: 11, lineHeight: 17, marginTop: 12 },
  imageButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderRadius: 10, padding: 9, marginTop: 12 },
  imageButtonText: { fontSize: 12, fontWeight: "700" },
  annotation: { width: "100%", height: 220, borderRadius: 12, marginTop: 10 },
  disclaimer: { fontSize: 10, lineHeight: 15, marginTop: 12 },
});
