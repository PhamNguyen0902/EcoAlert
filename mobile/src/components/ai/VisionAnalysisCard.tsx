import React, { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Eye, Image as ImageIcon, ScanSearch } from "lucide-react-native";
import { Alert } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { Card } from "../ui/Card";
import { getAnalysisModeDisplay, getVisionObjectDisplay, getVisionSupportDisplay } from "../../utils/domainI18n";

const percentage = (value: number | null | undefined, unavailable: string) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? unavailable
    : `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

export const VisionAnalysisCard: React.FC<{ alert: Alert }> = ({ alert }) => {
  const { colors, isDark } = useTheme();
  const { language, t } = useLanguage();
  const [showAnnotation, setShowAnnotation] = useState(false);
  const vision = alert.aiVision;
  const fusion = alert.aiFusion;
  if (!vision && !fusion) return null;
  const visionSucceeded = vision?.status === "COMPLETED";
  const detections = Array.isArray(vision?.detections) ? vision.detections : [];
  const objectCounts = Array.isArray(vision?.objectCounts) ? vision.objectCounts : [];
  const detectorStatus = !visionSucceeded
    ? t("aiCard.unavailable")
    : vision?.detectorConfidence === null || vision?.detectorConfidence === undefined
      ? t("aiCard.unavailable")
      : percentage(vision.detectorConfidence, t("aiCard.unavailable"));

  return (
    <Card style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <ScanSearch size={18} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>{t("aiCard.visionTitle")}</Text>
        </View>
        <Text style={[styles.mode, { color: colors.textMuted, borderColor: colors.border }]}>
          {getAnalysisModeDisplay(language, fusion?.mode || vision?.status)}
        </Text>
      </View>

      <View style={styles.grid}>
        <Metric label={t("aiCard.objectType")} value={getVisionObjectDisplay(language, fusion?.wasteType)} colors={colors} />
        <Metric label={t("aiCard.objectCount")} value={visionSucceeded ? String(vision.totalDetectedObjects) : t("aiCard.unavailable")} colors={colors} />
        <Metric label={t("aiCard.detectorConfidence")} value={detectorStatus} colors={colors} />
        <Metric label={t("aiCard.visionSupportLevel")} value={getVisionSupportDisplay(language, fusion?.visionSupport)} colors={colors} />
      </View>

      {objectCounts.length ? (
        <Text style={[styles.counts, { color: colors.textMuted }]}>
          {t("aiCard.counts")}: {objectCounts.slice(0, 6).map((item) => `${getVisionObjectDisplay(language, item.label)}: ${item.count}`).join(" · ")}
        </Text>
      ) : null}

      {visionSucceeded && detections.length ? (
        <View style={styles.detectionList} accessibilityLabel={t("aiCard.visionTitle")}>
          {detections.slice(0, 6).map((detection, index) => (
            <View key={`${detection.label}-${index}`} style={[styles.detectionRow, { borderColor: colors.border }]}>
              <Text style={[styles.detectionLabel, { color: colors.text }]}>{getVisionObjectDisplay(language, detection.label)}</Text>
              <Text style={[styles.detectionConfidence, { color: colors.textMuted }]}>{percentage(detection.confidence, t("aiCard.unavailable"))}</Text>
            </View>
          ))}
        </View>
      ) : visionSucceeded ? (
        <Text style={[styles.noDetections, { color: colors.textMuted }]}>{t("aiCard.noSupportedObjects")}</Text>
      ) : vision ? (
        <Text style={[styles.noDetections, { color: colors.textMuted }]}>{t("aiCard.detectorUnavailable")}</Text>
      ) : null}

      {fusion ? (
        <View style={[styles.confidenceRow, { borderColor: colors.border, backgroundColor: isDark ? "rgba(15,23,42,0.4)" : colors.background }]}>
          <Metric label={t("aiCard.semantic")} value={percentage(fusion.semanticConfidence, t("aiCard.unavailable"))} colors={colors} compact />
          <Metric label={t("aiCard.detector")} value={detectorStatus} colors={colors} compact />
          <Metric label={t("aiCard.fusion")} value={percentage(fusion.fusionConfidence, t("aiCard.unavailable"))} colors={colors} compact />
        </View>
      ) : null}

      {/* Fusion explanations are not persisted as bilingual public text, so they are intentionally not rendered. */}

      {vision?.annotatedImageUrl ? (
        <>
          <TouchableOpacity
            style={[styles.imageButton, { borderColor: colors.border }]}
            onPress={() => setShowAnnotation((value) => !value)}
            accessibilityRole="button"
          >
            {showAnnotation ? <Eye size={16} color={colors.primary} /> : <ImageIcon size={16} color={colors.primary} />}
            <Text style={[styles.imageButtonText, { color: colors.primary }]}>{showAnnotation ? t("aiCard.hideAiImage") : t("aiCard.viewAiImage")}</Text>
          </TouchableOpacity>
          {showAnnotation ? (
            <Image source={{ uri: vision.annotatedImageUrl }} style={styles.annotation} resizeMode="contain" accessibilityLabel={t("aiCard.annotatedImage")} />
          ) : null}
        </>
      ) : null}

      <Text style={[styles.disclaimer, { color: colors.textMuted }]}>{t("aiCard.visionDisclaimer")}</Text>
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
  detectionList: { gap: 6, marginTop: 12 },
  detectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 },
  detectionLabel: { fontSize: 11, fontWeight: "700" },
  detectionConfidence: { fontSize: 11, fontWeight: "600" },
  noDetections: { fontSize: 11, lineHeight: 17, marginTop: 12 },
  confidenceRow: { flexDirection: "row", borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 12 },
  explanation: { fontSize: 11, lineHeight: 17, marginTop: 12 },
  imageButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderRadius: 10, padding: 9, marginTop: 12 },
  imageButtonText: { fontSize: 12, fontWeight: "700" },
  annotation: { width: "100%", height: 220, borderRadius: 12, marginTop: 10 },
  disclaimer: { fontSize: 10, lineHeight: 15, marginTop: 12 },
});
