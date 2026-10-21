import React from "react";
import { Text, View } from "react-native";
import { Camera } from "lucide-react-native";
import { EvidenceImageFrame } from "../../shared/components/media/EvidenceImageFrame";
import { useCivicTheme } from "../../shared/theme/useCivicTheme";
import { officerDate } from "../utils/officerPresentation";
import { OfficerBadge, OfficerCard, officerStyles as s } from "./OfficerUI";

// Hiển thị trực quan 2 ảnh đặt cạnh nhau: "Ảnh sự cố ban đầu (Trước)" và "Ảnh kết quả dọn dẹp (Sau)"
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
        Đối chiếu ảnh Trước & Sau xử lý
      </Text>
      <View style={[s.row, { alignItems: "flex-start" }]}>
        {[
          {
            label: "Ảnh sự cố ban đầu (Trước)",
            uri: beforeUri,
            fallback: beforeFallback,
            tone: colors.danger,
            at: beforeAt,
            emptyText: "Không có ảnh sự cố ban đầu",
          },
          {
            label: "Ảnh kết quả dọn dẹp (Sau)",
            uri: afterUri,
            fallback: undefined,
            tone: colors.primary,
            at: afterAt,
            emptyText: "Chưa chụp ảnh kết quả dọn dẹp",
          },
        ].map((image) => (
          <View key={image.label} style={[s.grow, { gap: 8 }]}>
            <OfficerBadge label={image.label} color={image.tone} />
            {image.uri ? (
              <EvidenceImageFrame
                imageUri={image.uri}
                fallbackUri={image.fallback}
                style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: 10 }}
                accessibilityLabel={image.label}
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
                  {image.emptyText}
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
        Chạm vào ảnh để phóng to kiểm tra góc chụp và cảnh quan hiện trường.
      </Text>
    </OfficerCard>
  );
}
