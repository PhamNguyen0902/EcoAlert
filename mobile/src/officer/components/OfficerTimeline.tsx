import React from "react";
import { Text, View } from "react-native";
import { Check, Clock3 } from "lucide-react-native";
import type { Alert } from "../../shared/types";
import { useCivicTheme } from "../../shared/theme/useCivicTheme";
import { officerTimeline, officerDate } from "../utils/officerPresentation";
import { OfficerCard, officerStyles as s } from "./OfficerUI";
export function OfficerTimeline({ task }: { task: Alert }) {
  const { colors } = useCivicTheme();
  const steps = officerTimeline(task);
  return (
    <OfficerCard>
      <Text style={[s.technical, { color: colors.cyan }]}>
        TIẾN TRÌNH TÁC NGHIỆP · {steps.filter((step) => step.done).length}/
        {steps.length}
      </Text>
      {steps.map((step, index) => (
        <View
          key={step.label}
          style={[s.row, { alignItems: "flex-start", gap: 12 }]}
        >
          <View style={{ alignItems: "center", width: 26 }}>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: step.done ? colors.primary : colors.elevated,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {step.done ? (
                <Check size={14} color="#07101F" />
              ) : (
                <Clock3 size={13} color={colors.textMuted} />
              )}
            </View>
            {index < steps.length - 1 && (
              <View
                style={{
                  width: 1,
                  minHeight: 24,
                  backgroundColor: colors.borderStrong,
                }}
              />
            )}
          </View>
          <View style={s.grow}>
            <Text
              style={[
                s.body,
                {
                  color: step.done ? colors.text : colors.textMuted,
                  fontWeight: "700",
                },
              ]}
            >
              {index + 1}. {step.label}
            </Text>
            <Text
              style={[
                s.meta,
                { color: step.done ? colors.primary : colors.textMuted },
              ]}
            >
              {officerDate(step.at)}
            </Text>
          </View>
        </View>
      ))}
    </OfficerCard>
  );
}
