import React from "react";
import { Text, View } from "react-native";
import { Camera } from "lucide-react-native";
import { EvidenceImageFrame } from "../media/EvidenceImageFrame";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { officerDate } from "../../utils/officerPresentation";
import { OfficerBadge, OfficerCard, officerStyles as s } from "./OfficerUI";
export function OfficerEvidenceComparison({
  beforeUri,
  beforeFallback,
  afterUri,
  beforeAt,
  afterAt,
}: {
  beforeUri?: string;
  beforeFallback?: string;
  afterUri?: string;
  beforeAt?: string;
  afterAt?: string;
}) {
  const { colors } = useCivicTheme();
  return (
    <OfficerCard>
      <Text style={[s.heading, { color: colors.text }]}>
        Đối chiếu hiện trường
      </Text>
      <View style={[s.row, { alignItems: "flex-start" }]}>
        {[
          {
            label: "TRƯỚC XỬ LÝ",
            uri: beforeUri,
            fallback: beforeFallback,
            tone: colors.danger,
            at: beforeAt,
          },
          {
            label: "SAU XỬ LÝ",
            uri: afterUri,
            fallback: undefined,
            tone: colors.primary,
            at: afterAt,
          },
        ].map((image) => (
          <View key={image.label} style={[s.grow, { gap: 8 }]}>
            <OfficerBadge label={image.label} color={image.tone} />
            {image.uri ? (
              <EvidenceImageFrame
                imageUri={image.uri}
                fallbackUri={image.fallback}
                style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: 10 }}
                accessibilityLabel={`Minh chứng ${image.label.toLowerCase()}`}
              />
            ) : (
              <View
                style={{
                  aspectRatio: 3 / 4,
                  backgroundColor: colors.elevated,
                  borderRadius: 10,
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 8,
                  padding: 10,
                }}
              >
                <Camera size={22} color={colors.textMuted} />
                <Text
                  style={[
                    s.meta,
                    { color: colors.textMuted, textAlign: "center" },
                  ]}
                >
                  {image.label === "SAU XỬ LÝ"
                    ? "Chưa chụp minh chứng"
                    : "Không có ảnh trước xử lý"}
                </Text>
              </View>
            )}
            {image.at && (
              <Text style={[s.meta, { color: colors.textMuted }]}>
                {officerDate(image.at)}
              </Text>
            )}
          </View>
        ))}
      </View>
      <Text style={[s.meta, { color: colors.textMuted }]}>
        Chạm ảnh để xem lớn. Ảnh đối chiếu lấy từ hồ sơ thực tế.
      </Text>
    </OfficerCard>
  );
}
