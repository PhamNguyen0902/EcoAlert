import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Check, Clock3, Route } from "lucide-react-native";
import type { Alert } from "../../../../shared/types";
import { reportTime } from "../../../utils/citizenPresentation";
import { fieldColors as c, fieldStyles as s } from "./fieldDesign";

export function FieldProcessingTimeline({
  alert,
  queued,
}: {
  alert?: Alert;
  queued: boolean;
}) {
  const steps = [
    {
      title: "Tiếp nhận báo cáo",
      timestamp: alert?.createdAt,
      note: queued
        ? "Chưa gửi lên hệ thống"
        : "Hồ sơ đang chờ kiểm tra và tiếp nhận",
    },
    {
      title: "Phân công hiện trường",
      timestamp: alert?.assignedAt,
      note: "Dự kiến sau khi báo cáo được xác minh",
    },
    {
      title: "Nghiệm thu & hoàn tất",
      timestamp: alert?.closedAt,
      note: alert?.resolvedAt
        ? "Cán bộ đã gửi kết quả, chờ nghiệm thu"
        : "Dự kiến sau khi xử lý tại hiện trường",
    },
  ];
  return (
    <View style={s.card}>
      <View style={s.row}>
        <Route size={16} color={c.primary} />
        <Text style={s.title}>Lộ trình giải quyết</Text>
      </View>
      {steps.map((step, index) => {
        const done =
          !queued &&
          Boolean(
            step.timestamp && Number.isFinite(Date.parse(step.timestamp)),
          );
        return (
          <View key={step.title} style={styles.row}>
            <View style={styles.rail}>
              {index < 2 ? <View style={styles.line} /> : null}
              <View
                style={[
                  styles.dot,
                  { backgroundColor: done ? c.primary : "#233449" },
                ]}
              >
                {done ? (
                  <Check size={12} color={c.background} />
                ) : (
                  <Clock3 size={10} color={c.muted} />
                )}
              </View>
            </View>
            <View style={styles.copy}>
              <Text
                style={[
                  s.body,
                  { fontWeight: "800", color: done ? c.primary : c.secondary },
                ]}
              >
                {step.title}
              </Text>
              <Text style={s.meta}>
                {done ? reportTime(step.timestamp) : step.note}
              </Text>
              <Text style={[s.eyebrow, { color: done ? c.primary : c.cyan }]}>
                {done
                  ? "ĐÃ GHI NHẬN"
                  : queued
                    ? "CHỜ ĐỒNG BỘ"
                    : "CHƯA HOÀN TẤT"}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  rail: { width: 20, alignItems: "center" },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  line: {
    position: "absolute",
    width: 1,
    top: 20,
    bottom: -16,
    backgroundColor: "#233449",
  },
  copy: { flex: 1, gap: 4, paddingBottom: 6 },
});
