import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Clock3, MapPin, ShieldCheck } from "lucide-react-native";
import { EvidenceImageFrame } from "../../../../components/media/EvidenceImageFrame";
import { formatCaptureTimestamp } from "../../../../utils/watermark";
import type {
  FieldReportCaptureDraft,
  FieldReportLocationDraft,
} from "../../types";
import { fieldIntegrity, readableFieldAddress } from "./fieldPresentation";
import { fieldColors as c, fieldStyles as s } from "./fieldDesign";

export function FieldReportSummary({
  capture,
  location,
  onPress,
}: {
  capture: FieldReportCaptureDraft;
  location: FieldReportLocationDraft;
  onPress: (uri: string) => void;
}) {
  const integrity = fieldIntegrity(capture, location);
  return (
    <View style={s.card}>
      <View style={s.row}>
        <ShieldCheck size={14} color={c.primary} />
        <Text style={[s.eyebrow, { color: c.primary, flex: 1 }]}>
          MINH CHỨNG HIỆN TRƯỜNG
        </Text>
        <Text style={[s.eyebrow, { color: c.cyan }]}>
          ±{Math.round(location.accuracyMeters)}m
        </Text>
      </View>
      <View style={styles.row}>
        <EvidenceImageFrame
          imageUri={capture.displayLocalUri || capture.originalLocalUri}
          fallbackUri={capture.originalLocalUri}
          style={styles.thumbnail}
          onPress={onPress}
          showExpandIcon={false}
          accessibilityLabel="Phóng to ảnh minh chứng"
        />
        <View style={styles.copy}>
          <Text style={[s.body, { fontWeight: "800", color: c.text }]}>
            {readableFieldAddress(location.address)}
          </Text>
          <View style={s.row}>
            <MapPin size={11} color={c.cyan} />
            <Text style={[s.meta, { flex: 1, fontVariant: ["tabular-nums"] }]}>
              {location.latitude.toFixed(6)}°, {location.longitude.toFixed(6)}°
            </Text>
          </View>
          <View style={s.row}>
            <Clock3 size={11} color={c.cyan} />
            <Text style={[s.meta, { flex: 1 }]}>
              {integrity.time
                ? formatCaptureTimestamp(new Date(capture.capturedAt))
                : "Chưa có thời gian chụp"}
            </Text>
          </View>
          <Text
            style={[s.eyebrow, { color: integrity.gps ? c.primary : c.amber }]}
          >
            {integrity.gps ? "● GPS THIẾT BỊ ĐÃ GHI NHẬN" : "CẦN KIỂM TRA GPS"}
          </Text>
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  thumbnail: {
    width: 82,
    maxWidth: 82,
    aspectRatio: 3 / 4,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  copy: { flex: 1, minWidth: 0, gap: 6 },
});
