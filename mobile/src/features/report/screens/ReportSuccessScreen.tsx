import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Check,
  ChevronRight,
  Clock3,
  Copy,
  FileText,
  Home,
  Leaf,
  MapPin,
  WifiOff,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import type {
  CitizenStackParamList,
  ReportFlowParamList,
} from "../../../navigation/types";
import { useAlert } from "../../../hooks/useAlerts";
import { getWorkflowStatusLabel } from "../../../utils/aiAnalysis";
import { reportTime } from "../../../utils/citizenPresentation";
import { useFieldReport } from "../FieldReportContext";
import { formatAlertReference } from "../utils";
import { FieldEntrance, FieldNotice } from "../components/stitch/FieldUI";
import { FieldProcessingTimeline } from "../components/stitch/FieldProcessingTimeline";
import { readableFieldAddress } from "../components/stitch/fieldPresentation";
import {
  fieldColors as c,
  fieldStyles as s,
} from "../components/stitch/fieldDesign";

type Props = NativeStackScreenProps<ReportFlowParamList, "ReportSuccess">;

export const ReportSuccessScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { draft, resetDraft } = useFieldReport();
  const queued = route.params?.queued === true;
  const candidateId = route.params?.alertId || draft.createdAlert?._id || "";
  const alertId =
    !queued && /^[a-f0-9]{24}$/i.test(candidateId) ? candidateId : "";
  const alertQuery = useAlert(alertId);
  const alert = alertId
    ? (alertQuery.data ??
      (draft.createdAlert?._id === alertId ? draft.createdAlert : undefined))
    : undefined;
  const confirmed = Boolean(alert);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<CitizenStackParamList>>();
  const goHome = () => {
    resetDraft();
    rootNavigation?.navigate("CitizenTabs", { screen: "DashboardTab" });
  };
  const viewProgress = () => {
    resetDraft();
    if (alertId) rootNavigation?.navigate("AlertDetail", { id: alertId });
    else rootNavigation?.navigate("CitizenTabs", { screen: "MyReportsTab" });
  };
  const copyReference = async () => {
    if (!alertId) return;
    try {
      await Clipboard.setStringAsync(formatAlertReference(alertId));
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  };
  const color = queued || !confirmed ? c.amber : c.primary;
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <FieldEntrance style={styles.hero}>
          <LinearGradient
            colors={[
              queued || !confirmed
                ? "rgba(245,158,11,0.14)"
                : "rgba(34,197,94,0.18)",
              "transparent",
            ]}
            style={styles.halo}
          >
            <View
              style={[
                styles.emblem,
                { borderColor: color, shadowColor: color },
              ]}
            >
              {queued ? (
                <WifiOff size={38} color={color} />
              ) : confirmed ? (
                <Check size={42} color={color} strokeWidth={3} />
              ) : (
                <Clock3 size={38} color={color} />
              )}
            </View>
            <View style={[styles.spark, { backgroundColor: color }]} />
          </LinearGradient>
          <Text style={styles.title}>
            {queued
              ? "Báo cáo đã được lưu trên thiết bị"
              : confirmed
                ? "Báo cáo đã gửi thành công!"
                : "Đang kiểm tra hồ sơ báo cáo"}
          </Text>
          <Text style={styles.description}>
            {queued
              ? "Báo cáo sẽ được đồng bộ khi thiết bị có kết nối mạng."
              : confirmed
                ? "Cảm ơn bạn đã chung tay bảo vệ môi trường và xây dựng đô thị văn minh, sạch đẹp."
                : "Vui lòng kiểm tra trong mục Của tôi nếu chưa tải được hồ sơ."}
          </Text>
        </FieldEntrance>
        <View style={styles.contribution}>
          <View style={styles.leaf}>
            <Leaf size={20} color={color} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[s.title, { fontSize: 14 }]}>
              Cảm ơn đóng góp của bạn
            </Text>
            <Text style={s.meta}>
              Mỗi báo cáo chính xác đều góp phần cải thiện môi trường sống.
            </Text>
          </View>
        </View>
        <FieldEntrance style={s.card}>
          <View style={s.row}>
            <FileText size={15} color={c.cyan} />
            <Text style={[s.eyebrow, { color: c.cyan, flex: 1 }]}>
              HỒ SƠ ĐIỆN TỬ
            </Text>
            <Text style={[s.eyebrow, { color }]}>
              {queued
                ? "CHỜ ĐỒNG BỘ"
                : alert
                  ? getWorkflowStatusLabel(alert.status, "vi")
                  : "CHỜ TẢI HỒ SƠ"}
            </Text>
          </View>
          {alertId ? (
            <View style={styles.referenceRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.meta}>MÃ THAM CHIẾU</Text>
                <Text style={styles.reference}>
                  {formatAlertReference(alertId)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sao chép mã báo cáo"
                onPress={() => void copyReference()}
                style={styles.copyButton}
              >
                <Copy size={13} color={c.cyan} />
                <Text style={[s.meta, { color: c.text }]}>
                  {copyState === "copied" ? "Đã sao chép" : "Sao chép"}
                </Text>
              </Pressable>
            </View>
          ) : null}
          {copyState === "error" ? (
            <Text
              style={[s.meta, { color: c.amber }]}
              accessibilityRole="alert"
            >
              Không thể sao chép. Vui lòng thử lại.
            </Text>
          ) : null}
          <View style={{ gap: 4 }}>
            <Text style={s.meta}>
              {queued ? "THỜI GIAN CHỤP" : "THỜI GIAN GỬI"}
            </Text>
            <Text style={[s.body, { fontWeight: "700", color: c.text }]}>
              {reportTime(
                queued ? draft.capture?.capturedAt : alert?.createdAt,
              )}
            </Text>
          </View>
          <View style={[s.row, { alignItems: "flex-start" }]}>
            <MapPin size={15} color={c.primary} />
            <Text style={[s.body, { flex: 1 }]}>
              {readableFieldAddress(alert?.address || draft.location?.address)}
            </Text>
          </View>
        </FieldEntrance>
        <FieldProcessingTimeline alert={alert} queued={queued} />
        <FieldNotice tone={queued || !confirmed ? "amber" : "green"}>
          {queued
            ? "Ảnh gốc và ảnh minh chứng vẫn được giữ trên thiết bị để đồng bộ. Đây chưa phải báo cáo đã được máy chủ tiếp nhận."
            : confirmed
              ? "Hệ thống đã ghi nhận đóng góp của bạn cho môi trường. Bạn có thể theo dõi tiến độ trong mục Của tôi."
              : "Trạng thái chỉ hiển thị khi có hồ sơ từ hệ thống. Hãy kiểm tra kết nối hoặc mở mục Của tôi."}
        </FieldNotice>
        <Pressable
          onPress={viewProgress}
          style={s.button}
          accessibilityRole="button"
        >
          <Text style={s.buttonText}>
            {queued ? "XEM BÁO CÁO NGOẠI TUYẾN" : "XEM BÁO CÁO CỦA TÔI"}
          </Text>
          <ChevronRight size={18} color={c.background} />
        </Pressable>
        <Pressable
          onPress={goHome}
          style={styles.homeButton}
          accessibilityRole="button"
        >
          <Home size={16} color={c.text} />
          <Text style={[s.buttonText, { color: c.text }]}>VỀ TRANG CHỦ</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 16 },
  hero: { alignItems: "center", paddingTop: 12, gap: 8 },
  halo: {
    width: 126,
    height: 112,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 60,
  },
  emblem: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    backgroundColor: "#0D2E26",
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  spark: {
    position: "absolute",
    right: 24,
    top: 14,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  title: {
    color: c.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "800",
    textAlign: "center",
  },
  description: { ...s.body, textAlign: "center", maxWidth: 350 },
  contribution: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(34,197,94,0.09)",
    borderRadius: 12,
    padding: 12,
  },
  leaf: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  referenceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  reference: {
    color: c.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  copyButton: {
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#233449",
  },
  homeButton: {
    ...s.button,
    backgroundColor: c.elevated,
    borderWidth: 1,
    borderColor: c.border,
  },
});
