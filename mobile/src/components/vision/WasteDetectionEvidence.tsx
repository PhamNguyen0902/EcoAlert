import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { VisionEvidence } from "../../types";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { civicType, civicStyles, civicSpace } from "../../theme/civicDesign";
import { WasteDetectionImage } from "./WasteDetectionImage";
import { WasteDetectionResults } from "./WasteDetectionResults";

/** Kept separate from the citizen's display/watermarked evidence gallery. */
export function WasteDetectionEvidence({
  evidence,
}: {
  evidence: VisionEvidence;
}) {
  const { colors } = useCivicTheme();
  const detections = evidence.status === "ok" ? evidence.detections : [];
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.heading, { color: colors.text }]}>
        Nhận diện từ hình ảnh
      </Text>
      <WasteDetectionImage
        imageUri={evidence.imageUrl}
        detections={detections}
        height={260}
        emptyMessage={
          evidence.status === "no_detection" ||
          (evidence.status === "ok" && !detections.length)
            ? "Ảnh chưa có vùng rác được nhận diện."
            : undefined
        }
      />
      {evidence.status === "error" ? (
        <Text
          style={[styles.body, { color: colors.textMuted }]}
          accessibilityRole="alert"
        >
          Không thể hiển thị kết quả nhận diện.
        </Text>
      ) : null}
      {evidence.status === "skipped_not_applicable" ? (
        <Text style={[styles.body, { color: colors.textMuted }]}>
          Ảnh này không áp dụng nhận diện rác thải.
        </Text>
      ) : null}
      {detections.length ? (
        <>
          <Text style={[styles.body, { color: colors.text }]}>
            {detections.length} vùng được phát hiện
          </Text>
          <WasteDetectionResults detections={detections} />
        </>
      ) : null}
      {evidence.requiresManualReview ? (
        <Text style={styles.warning}>Cần kiểm tra thêm</Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { ...civicStyles.card, gap: civicSpace.md },
  heading: civicType.section,
  body: civicType.body,
  warning: {
    color: "#F59E0B",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
});
