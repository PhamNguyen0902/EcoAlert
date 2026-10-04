import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { FileText, MapPin } from "lucide-react-native";
import { Card } from "../ui/Card";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { civicRadius, civicSpace, civicType } from "../../theme/civicDesign";
import { EvidenceImageFrame } from "../media/EvidenceImageFrame";

interface Props {
  title: string;
  address: string;
  time: string;
  status: React.ReactNode;
  imageUri?: string;
  compact?: boolean;
  children?: React.ReactNode;
}

export const CitizenReportCard: React.FC<Props> = ({
  title,
  address,
  time,
  status,
  imageUri,
  compact = false,
  children,
}) => {
  const { colors } = useCivicTheme();
  const image = imageUri ? (
    <EvidenceImageFrame
      imageUri={imageUri}
      showExpandIcon={!compact}
      style={[
        compact ? styles.smallImage : styles.image,
        { backgroundColor: colors.soft },
      ]}
      accessibilityLabel="Ảnh minh chứng báo cáo"
    />
  ) : compact ? (
    <View
      style={[
        styles.smallImage,
        styles.placeholder,
        { backgroundColor: colors.cyanSoft },
      ]}
    >
      <FileText size={20} color={colors.cyan} />
    </View>
  ) : null;
  return (
    <Card appearance="civic" style={styles.card}>
      {!compact && image}
      <View style={compact ? styles.row : styles.copy}>
        {compact && image}
        <View style={styles.copy}>
          <View style={styles.statusRow}>
            {status}
            <Text
              style={[civicType.meta, styles.time, { color: colors.textMuted }]}
            >
              {time}
            </Text>
          </View>
          <Text
            numberOfLines={2}
            style={[civicType.cardTitle, { color: colors.text }]}
          >
            {title}
          </Text>
          <View style={styles.addressRow}>
            <MapPin size={14} color={colors.textMuted} />
            <Text
              numberOfLines={2}
              style={[
                civicType.meta,
                styles.address,
                { color: colors.textMuted },
              ]}
            >
              {address}
            </Text>
          </View>
        </View>
      </View>
      {children}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { gap: civicSpace.md },
  row: { flexDirection: "row", gap: civicSpace.md, alignItems: "center" },
  copy: { flex: 1, minWidth: 0, gap: civicSpace.sm },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: civicSpace.sm,
  },
  time: { flexShrink: 1 },
  smallImage: {
    width: 64,
    height: 80,
    aspectRatio: undefined,
    borderRadius: civicRadius.chip,
  },
  placeholder: { justifyContent: "center", alignItems: "center" },
  image: {
    width: "100%",
    maxWidth: undefined,
    height: 180,
    aspectRatio: undefined,
    borderRadius: civicRadius.image,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: civicSpace.xs,
  },
  address: { flex: 1, minWidth: 0 },
});
