import React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Check, CheckCircle2, Clock3 } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAlert } from "../../hooks/useAlerts";
import { useProfile } from "../../features/auth/hooks/useAuth";
import { useCivicTheme } from "../../theme/useCivicTheme";
import {
  OfficerHeader,
  OfficerCard,
  OfficerBadge,
  officerStyles as s,
} from "../../components/officer/OfficerUI";
import { OfficerEvidenceComparison } from "../../components/officer/OfficerEvidenceComparison";
import { OfficerEntrance } from "../../components/officer/OfficerEntrance";
import { Button } from "../../components/ui/Button";
import {
  ownsOfficerTask,
  officerDate,
  officerImage,
  officerReference,
} from "../../utils/officerPresentation";
import type { OfficerStackParamList } from "../../navigation/types";
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
      <ScrollView
        contentContainerStyle={[
          s.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {!confirmed || !task ? (
          <OfficerCard>
            {query.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[s.body, { color: colors.textMuted }]}>
                Chưa có kết quả xử lý được server xác nhận cho nhiệm vụ này.
              </Text>
            )}
            <Button
              appearance="civic"
              title="THỬ LẠI"
              onPress={() => void query.refetch()}
            />
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
                  Đã gửi kết quả xử lý thành công!
                </Text>
                <Text
                  style={[
                    s.body,
                    { color: colors.textMuted, textAlign: "center" },
                  ]}
                >
                  Minh chứng hiện trường đã được gửi đến Quản trị viên để kiểm
                  tra và nghiệm thu.
                </Text>
              </View>
            </OfficerEntrance>
            <OfficerCard>
              <View style={s.row}>
                <Text style={[s.technical, { color: colors.cyan }]}>
                  HỒ SƠ ĐIỆN TỬ
                </Text>
                <OfficerBadge
                  label={closed ? "ADMIN ĐÃ ĐÓNG" : "CHỜ NGHIỆM THU"}
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
                {task.address || "Đã ghi nhận vị trí GPS"}
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
                Quy trình tiếp theo
              </Text>
              {[
                {
                  label: "Đã gửi hồ sơ minh chứng",
                  done: true,
                  hint: officerDate(task.resolvedAt),
                },
                {
                  label: "Quản trị viên kiểm tra",
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
                    : "Chỉ Admin có thể xác nhận đóng báo cáo",
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
        <Button
          appearance="civic"
          title="VỀ DANH SÁCH NHIỆM VỤ"
          onPress={() =>
            navigation.reset({
              index: 1,
              routes: [{ name: "OfficerTabs" }, { name: "OfficerTaskList" }],
            })
          }
        />
        <Button
          appearance="civic"
          variant="outline"
          title="XEM CHI TIẾT HỒ SƠ"
          onPress={() =>
            navigation.replace("OfficerAlertDetail", { id: route.params.id })
          }
        />
      </ScrollView>
    </View>
  );
}
