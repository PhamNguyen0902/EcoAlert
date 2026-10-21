import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import type { Alert } from "../../shared/types";
import { useReducedMotion } from "../../shared/hooks/useReducedMotion";
import { useCivicTheme } from "../../shared/theme/useCivicTheme";
import { officerTimeline, officerDate } from "../utils/officerPresentation";
import { officerStyles as s } from "./OfficerUI";

// Hiển thị dòng thời gian các mốc xử lý sự cố từ lúc nhận việc đến khi hoàn thành
export function OfficerTimeline({ task }: { task: Alert }) {
  const { colors } = useCivicTheme();
  const reducedMotion = useReducedMotion();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const steps = officerTimeline(task);
  const completedCount = steps.filter((step) => step.done).length;
  const activeIndex = steps.findIndex((step) => !step.done);

  useEffect(() => {
    if (reducedMotion || activeIndex === -1) {
      pulseAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim, reducedMotion, activeIndex]);

  return (
    <View style={styles.glassCard}>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Text style={[s.technical, { color: colors.cyan }]}>
          NHẬT KÝ TIẾN TRÌNH XỬ LÝ
        </Text>
        <Text style={[s.technical, { color: colors.primary }]}>
          {completedCount}/{steps.length} MỐC HOÀN TẤT
        </Text>
      </View>

      <View style={{ gap: 0 }}>
        {steps.map((step, index) => {
          const isCompleted = step.done;
          const isActive = index === activeIndex;
          const circleBg = isCompleted
            ? "#10B981"
            : isActive
              ? "#0EA5E9"
              : "#0F172A";
          const circleBorder = isCompleted
            ? "#10B981"
            : isActive
              ? "#38BDF8"
              : "#334155";

          return (
            <View
              key={step.label}
              style={[s.row, { alignItems: "flex-start", gap: 12 }]}
            >
              <View style={{ alignItems: "center", width: 28 }}>
                <View style={styles.circleWrap}>
                  {isActive && (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.activeHalo,
                        {
                          opacity: reducedMotion
                            ? 0.35
                            : pulseAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.5, 0.12],
                              }),
                          transform: [
                            {
                              scale: reducedMotion
                                ? 1.15
                                : pulseAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1.04, 1.32],
                                  }),
                            },
                          ],
                        },
                      ]}
                    />
                  )}
                  <View
                    style={[
                      styles.circle,
                      {
                        backgroundColor: circleBg,
                        borderColor: circleBorder,
                      },
                    ]}
                  >
                    {isCompleted ? (
                      <Check size={14} color="#FFFFFF" strokeWidth={3} />
                    ) : (
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "800",
                          color: isActive ? "#07101F" : "#64748B",
                        }}
                      >
                        {index + 1}
                      </Text>
                    )}
                  </View>
                </View>

                {index < steps.length - 1 && (
                  <View
                    style={{
                      width: 2.5,
                      minHeight: 24,
                      borderRadius: 999,
                      backgroundColor: isCompleted ? "#10B981" : "#1E293B",
                    }}
                  />
                )}
              </View>

              <View
                style={[
                  s.grow,
                  { paddingBottom: index < steps.length - 1 ? 12 : 0 },
                ]}
              >
                <Text
                  style={[
                    s.body,
                    {
                      color: isCompleted
                        ? colors.text
                        : isActive
                          ? "#38BDF8"
                          : "#64748B",
                      fontWeight: isCompleted || isActive ? "800" : "600",
                    },
                  ]}
                >
                  {index + 1}. {step.label}
                </Text>
                <Text
                  style={[
                    s.meta,
                    {
                      color: isCompleted
                        ? "#10B981"
                        : isActive
                          ? colors.textSecondary
                          : "#64748B",
                    },
                  ]}
                >
                  {officerDate(step.at)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glassCard: {
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.16)",
    padding: 14,
    gap: 12,
  },
  circleWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  activeHalo: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#38BDF8",
    backgroundColor: "rgba(14, 165, 233, 0.2)",
  },
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
