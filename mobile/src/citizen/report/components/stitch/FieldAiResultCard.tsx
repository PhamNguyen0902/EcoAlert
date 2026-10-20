import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import {
  Bot,
  ChartNoAxesColumnIncreasing,
  Scale,
  ScanLine,
} from "lucide-react-native";
import {
  getCategoryLabel,
  getSeverityLabel,
} from "../../../../shared/utils/aiAnalysis";
import type { FieldReportImageValidationDraft } from "../../types";
import { WasteDetectionChips } from "../WasteDetectionChips";
import { fieldConfidence } from "./fieldPresentation";
import { fieldColors as c, fieldStyles as s } from "./fieldDesign";
import { FieldEntrance, useFieldReducedMotion } from "./FieldUI";
import { isReportCategory, massPresentation } from "../../semanticResult";
import { aiStageLabels } from "../../reviewPolicy";

/** All displayed conclusions come from the existing draft/API, never visual fixtures. */
export function FieldAiResultCard({
  analysis,
  compact = false,
}: {
  analysis: FieldReportImageValidationDraft;
  compact?: boolean;
}) {
  const hasCategory = analysis.semanticState === "COMPLETE" && isReportCategory(analysis.suggestedCategory);
  const confidence = fieldConfidence(hasCategory ? analysis.categoryConfidence : analysis.detectedObjects.length ? analysis.yoloConfidence : null);
  const stages = aiStageLabels(analysis);
  const mass = massPresentation(analysis);
  const category =
    hasCategory && analysis.suggestedCategory
      ? getCategoryLabel(analysis.suggestedCategory, "vi")
      : "Chưa xác định được danh mục phù hợp";
  const manual = analysis.backendValidation?.decision === "UNCERTAIN";
  const severityColor =
    analysis.severity === "LOW"
      ? c.primary
      : analysis.severity === "CRITICAL"
        ? c.red
        : analysis.severity
          ? c.amber
          : c.muted;
  return (
    <FieldEntrance style={s.card}>
      <View style={s.row}>
        <Bot size={17} color={c.primary} />
        <Text style={[s.eyebrow, { color: c.text, flex: 1 }]}>
          Đánh giá tự động
        </Text>
      </View>
      <Text style={[s.eyebrow, { color: c.cyan }]}>
        Nhận diện vật thể: {stages.vision}
      </Text>
      <Text style={s.meta}>Phân loại AI: {stages.semantic}</Text>
      <View style={styles.classification}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.meta}>PHÂN LOẠI GỢI Ý</Text>
          <Text style={[s.title, compact && { fontSize: 14, lineHeight: 20 }]}>
            {category}
          </Text>
        </View>
        <Text
          style={[
            styles.badge,
            {
              color: manual ? c.amber : c.primary,
              backgroundColor: manual
                ? "rgba(245,158,11,0.12)"
                : "rgba(34,197,94,0.12)",
            },
          ]}
        >
          {hasCategory ? manual ? "GỢI Ý · CẦN XÁC NHẬN" : "ĐÃ CÓ GỢI Ý PHÂN LOẠI" : analysis.state === "UNAVAILABLE" || analysis.semanticState === "UNAVAILABLE" || analysis.semanticState === "TEXT_ONLY" ? "PHÂN TÍCH CHƯA KHẢ DỤNG" : analysis.detectedObjects.length ? "ĐÃ PHÁT HIỆN VẬT THỂ" : "CHƯA NHẬN DIỆN ĐƯỢC VẬT THỂ"}
        </Text>
      </View>
      {analysis.detectedObjects.length ? (
        <WasteDetectionChips detections={analysis.detectedObjects} showCount />
      ) : null}
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <View style={s.row}>
            <ChartNoAxesColumnIncreasing size={13} color={c.primary} />
            <Text style={[s.eyebrow, { color: c.primary, flexShrink: 1 }]}>
              {hasCategory ? "TIN CẬY PHÂN LOẠI AI" : "TIN CẬY YOLO"}
            </Text>
          </View>
          <Text style={styles.value}>
            {confidence === null
              ? "Chưa có dữ liệu"
              : `${(confidence * 100).toFixed(1)}%`}
          </Text>
          {confidence !== null ? <ConfidenceBar value={confidence} /> : null}
        </View>
        <View style={styles.metric}>
          <View style={s.row}>
            <Scale size={13} color={c.cyan} />
            <Text style={[s.eyebrow, { color: c.cyan, flexShrink: 1 }]}>
              KHỐI LƯỢNG
            </Text>
          </View>
          <Text style={styles.value}>{mass.value}</Text>
          <Text style={s.meta}>{mass.note}</Text>
        </View>
      </View>
      <View style={s.row}>
        <ScanLine size={14} color={c.amber} />
        <Text style={s.meta}>Mức độ: </Text>
        <Text
          style={[
            s.body,
            {
              color: severityColor,
              flex: 1,
              fontWeight: "700",
            },
          ]}
        >
          {analysis.severity
            ? getSeverityLabel(analysis.severity, "vi")
            : "Chưa có đánh giá"}
        </Text>
      </View>
      {!compact && analysis.summary ? (
        <View style={styles.context}>
          <Text style={[s.eyebrow, { color: c.amber }]}>TÓM TẮT ĐÁNH GIÁ TỰ ĐỘNG</Text>
          <Text style={s.body}>{analysis.summary}</Text>
        </View>
      ) : null}
      <Text style={s.meta}>Đây là đánh giá tự động để tham khảo, không phải kết luận cuối cùng của cán bộ.</Text>
      {!analysis.suggestedCategory ||
      analysis.suggestedCategory === "UNCLASSIFIED" ||
      !analysis.severity ? (
        <Text style={s.meta}>
          {analysis.semanticError || "Chưa đủ kết quả phân tích bối cảnh."} Cán bộ sẽ kiểm tra và xác nhận;
          đây không phải kết luận cuối cùng.
        </Text>
      ) : null}
    </FieldEntrance>
  );
}
function ConfidenceBar({ value }: { value: number }) {
  const reduced = useFieldReducedMotion();
  const progress = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    if (reduced) {
      progress.setValue(value);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: value,
      duration: 320,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, value]);
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel="Độ tin cậy AI"
      accessibilityValue={{ min: 0, max: 100, now: value * 100 }}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  classification: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  badge: {
    maxWidth: 108,
    borderRadius: 8,
    padding: 6,
    fontSize: 9,
    lineHeight: 14,
    fontWeight: "800",
    overflow: "hidden",
    textAlign: "center",
  },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: {
    flex: 1,
    minWidth: 120,
    padding: 10,
    gap: 6,
    borderRadius: 10,
    backgroundColor: c.surface,
  },
  value: { color: c.text, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#233449",
    overflow: "hidden",
  },
  fill: { height: 4, backgroundColor: c.primary },
  context: {
    padding: 12,
    gap: 6,
    borderRadius: 10,
    backgroundColor: "rgba(245,158,11,0.07)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.14)",
  },
});
