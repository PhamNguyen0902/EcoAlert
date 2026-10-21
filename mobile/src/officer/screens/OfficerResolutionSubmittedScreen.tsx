import React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Check, CheckCircle2, Clock3 } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAlert } from "../../shared/hooks/useAlerts";
import { useProfile } from "../../auth/hooks/useAuth";
import { useCivicTheme } from "../../shared/theme/useCivicTheme";
import {
  OfficerHeader,
  OfficerCard,
  OfficerBadge,
  OfficerStepProgressBar,
  officerStyles as s,
} from "../components/OfficerUI";
import { OfficerEvidenceComparison } from "../components/OfficerEvidenceComparison";
import { OfficerEntrance } from "../components/OfficerEntrance";
import { Button } from "../../shared/components/ui/Button";
import {
  ownsOfficerTask,
  officerDate,
  officerImage,
  officerReference,
} from "../utils/officerPresentation";
import type { OfficerStackParamList } from "../../app/navigation/types";
// hiển thị xác nhận đã nộp kết quả kèm ảnh trước và sau khi xử lý
export function OfficerResolutionSubmittedScreen({
  route,
  navigation,
}: NativeStackScreenProps<
  OfficerStackParamList,
  "OfficerResolutionSubmitted"
>) {
  const { colors } = useCivicTheme();
  const insets = useSafeAreaInsets();
  const query = useAlert(route.params.id);
  const { data: profile } = useProfile();
  const task = query.data;
  const confirmed =
    ownsOfficerTask(task, profile) &&
    task &&
    ["RESOLVED", "CLOSED"].includes(task.status.toUpperCase());
  const closed = task?.status.toUpperCase() === "CLOSED";
  return (
    <View
      style={[
        s.screen,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <OfficerHeader
        title="Nghiệm thu xử lý"
        back={() =>
          navigation.navigate("OfficerTabs", { screen: "OfficerTasksTab" })
        }
      />
      <OfficerStepProgressBar
        task={task || { status: "RESOLVED" }}
        step={3}
      />
      <ScrollView
        contentContainerStyle={[
          s.content,
          { paddingBottom: 24 },
        ]}
      >
        {!confirmed || !task ? (
          <OfficerCard>
            {query.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[s.body, { color: colors.textMuted }]}>
                Chưa có kết quả xử lý được hệ thống xác nhận cho nhiệm vụ này.
              </Text>
            )}
          </OfficerCard>
        ) : (
          <>
            <OfficerEntrance>
              <View
                style={{ alignItems: "center", paddingVertical: 20, gap: 14 }}
              >
                <View
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: 52,
                    backgroundColor: colors.greenSoft,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 10,
                    borderColor: colors.greenSoft,
                  }}
                >
                  <View
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: 35,
                      backgroundColor: colors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={36} color="#07101F" />
                  </View>
                </View>
                <Text
                  accessibilityRole="header"
                  style={[s.title, { color: colors.text, textAlign: "center" }]}
                >
                  Hoàn tất cả 3 bước xử lý!
                </Text>
                <Text
                  style={[
                    s.body,
                    { color: colors.textMuted, textAlign: "center" },
                  ]}
                >
                  Báo cáo kết quả và minh chứng hiện trường đã được gửi đến Quản
                  trị viên để kiểm tra và nghiệm thu.
                </Text>
              </View>
            </OfficerEntrance>
            <OfficerCard>
              <View style={s.row}>
                <Text style={[s.technical, { color: colors.cyan }]}>
                  HỒ SƠ ĐIỆN TỬ
                </Text>
                <OfficerBadge
                  label={closed ? "ĐÃ NGHIỆM THU" : "CHỜ NGHIỆM THU"}
                  color={closed ? colors.primary : colors.cyan}
                />
              </View>
              <Text style={[s.title, { color: colors.text }]}>
                {officerReference(task)}
              </Text>
              <Text style={[s.heading, { color: colors.text }]}>
                {task.title}
              </Text>
              <Text style={[s.meta, { color: colors.textMuted }]}>
                Gửi kết quả: {officerDate(task.resolvedAt)}
              </Text>
              <Text style={[s.body, { color: colors.textSecondary }]}>
                {task.address || "Đã ghi nhận vị trí định vị"}
              </Text>
              <Text style={[s.meta, { color: colors.cyan }]}>
                Cán bộ:{" "}
                {profile?.fullName || profile?.email || "Chưa có thông tin"}
              </Text>
            </OfficerCard>
            <OfficerEvidenceComparison
              beforeUri={officerImage(task)}
              beforeFallback={task.fieldEvidence?.[0]?.originalUrl}
              afterUri={task.resolutionEvidence?.[0]?.url}
              beforeAt={task.fieldEvidence?.[0]?.capturedAt}
              afterAt={task.resolutionEvidence?.[0]?.capturedAt}
            />
            <OfficerCard>
              <Text style={[s.heading, { color: colors.cyan }]}>
                Quy trình nghiệm thu tiếp theo
              </Text>
              {[
                {
                  label: "Đã gửi hồ sơ minh chứng hiện trường",
                  done: true,
                  hint: officerDate(task.resolvedAt),
                },
                {
                  label: "Quản trị viên kiểm tra kết quả",
                  done: Boolean(closed && task.closedAt),
                  hint: closed
                    ? officerDate(task.closedAt)
                    : "Đang chờ kiểm tra và nghiệm thu",
                },
                {
                  label: "Đóng báo cáo sau nghiệm thu",
                  done: Boolean(closed && task.closedAt),
                  hint: closed
                    ? officerDate(task.closedAt)
                    : "Quản trị viên xác nhận đóng báo cáo",
                },
              ].map((step, index) => (
                <View
                  key={step.label}
                  style={[s.row, { alignItems: "flex-start" }]}
                >
                  {step.done ? (
                    <CheckCircle2 size={22} color={colors.primary} />
                  ) : (
                    <Clock3 size={22} color={colors.textMuted} />
                  )}
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
                    <Text style={[s.meta, { color: colors.textMuted }]}>
                      {step.hint}
                    </Text>
                  </View>
                </View>
              ))}
            </OfficerCard>
          </>
        )}
      </ScrollView>
      <View
        style={{
          padding: 12,
          paddingBottom: Math.max(12, insets.bottom),
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Button
          appearance="civic"
          title="Về danh sách nhiệm vụ"
          onPress={() =>
            navigation.reset({
              index: 1,
              routes: [{ name: "OfficerTabs" }, { name: "OfficerTaskList" }],
            })
          }
        />
      </View>
    </View>
  );
}
