import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert as RNAlert,
  Pressable,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { usePreventRemove } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfile } from "../../hooks/useAuth";
import { ownsOfficerTask } from "../../utils/officerPresentation";
import {
  OfficerHeader,
  OfficerBadge,
} from "../../components/officer/OfficerUI";
import { OfficerEvidenceComparison } from "../../components/officer/OfficerEvidenceComparison";
import {
  useAlert,
  useResolveIncident,
  useUploadMedia,
} from "../../hooks/useAlerts";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { civicStyles, civicType } from "../../theme/civicDesign";
import { OfficerResolutionCamera } from "./OfficerResolutionCamera";
import {
  WASTE_TREATMENTS,
  WASTE_MATERIALS,
  createOfficerResolutionSubmitter,
  validateOfficerResolution,
  type OfficerPhoto,
} from "../../utils/officerResolution";
import {
  officerErrorMessage,
  isWasteOfficerTask,
} from "../../utils/officerWorkflow";
import type { OfficerStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<OfficerStackParamList, "OfficerResolution">;
export const OfficerResolutionScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useCivicTheme();
  const query = useAlert(route.params.id);
  const { data: profile } = useProfile();
  const upload = useUploadMedia();
  const resolve = useResolveIncident();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photo, setPhoto] = useState<OfficerPhoto>();
  const [photoConfirmed, setPhotoConfirmed] = useState(false);
  const [summary, setSummary] = useState("");
  const [treatment, setTreatment] = useState("");
  const [materials, setMaterials] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  usePreventRemove(submitting, () =>
    RNAlert.alert(
      "Đang gửi minh chứng",
      "Vui lòng chờ hoàn tất gửi kết quả trước khi rời trang.",
    ),
  );
  const submittingRef = useRef(false);
  useEffect(() => {
    // Release the navigation guard before replacing the completed form.
    if (submitted && !submitting)
      navigation.replace("OfficerResolutionSubmitted", { id: route.params.id });
  }, [submitted, submitting, navigation, route.params.id]);
  const submitter = useRef(
    createOfficerResolutionSubmitter({
      upload: (uri) =>
        upload.mutateAsync({
          fileUri: uri,
          fileName: `officer_after_${Date.now()}.jpg`,
          fileType: "image/jpeg",
        }),
      resolve: (data) => resolve.mutateAsync({ id: route.params.id, data }),
    }),
  ).current;
  const task = query.data;
  const allowed = Boolean(
    task &&
    ownsOfficerTask(task, profile) &&
    isWasteOfficerTask(task) &&
    task.status.toUpperCase() === "IN_PROGRESS" &&
    task.checkIn?.verified === true,
  );
  const draft = {
    photo,
    verifiedArrival: allowed,
    resolutionSummary: summary,
    treatmentMethod: treatment,
    materialsUsed: materials.join(", "),
    additionalNotes: notes,
  };
  const send = async () => {
    if (submittingRef.current) return;
    const validation = validateOfficerResolution(draft);
    if (validation || !photoConfirmed) {
      setError(validation || "Vui lòng xác nhận sử dụng ảnh này.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      if (await submitter(draft)) {
        setSubmitted(true);
      }
    } catch (failure: unknown) {
      setError(
        officerErrorMessage(
          failure,
          "Không thể tải ảnh hoặc gửi kết quả. Vui lòng kiểm tra mạng rồi thử lại.",
        ),
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  const before = task?.fieldEvidence?.[0];
  const beforeUri =
    before?.displayUrl || before?.originalUrl || task?.mediaUrls?.[0];
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <OfficerHeader
        title="Thu thập chứng cứ"
        back={navigation.goBack}
        disabled={submitting}
      />
      <ScrollView
        contentContainerStyle={[
          civicStyles.content,
          { paddingBottom: 24, gap: 16 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {query.isLoading ? (
          <ActivityIndicator color={colors.cyan} />
        ) : !allowed ? (
          <Text
            accessibilityRole="alert"
            style={[civicType.body, { color: colors.warning }]}
          >
            {query.isError
              ? "Không thể tải nhiệm vụ. Vui lòng quay lại và thử lại."
              : "Nhiệm vụ phải đang xử lý và đã xác nhận hiện trường trước khi gửi kết quả."}
          </Text>
        ) : null}
        <OfficerBadge
          label="BƯỚC 04 / 06 · GHI NHẬN KẾT QUẢ THỰC TẾ"
          color={colors.cyan}
        />
        <OfficerEvidenceComparison
          beforeUri={ownsOfficerTask(task, profile) ? beforeUri : undefined}
          beforeFallback={before?.originalUrl}
          afterUri={photo?.originalLocalUri}
          beforeAt={before?.capturedAt}
          afterAt={photo?.capturedAt}
        />
        <Card appearance="civic" style={styles.card}>
          <Text style={[civicType.section, { color: colors.primary }]}>
            SAU XỬ LÝ
          </Text>
          {photo ? (
            <>
              <Text style={[civicType.meta, { color: colors.cyan }]}>
                GPS ±{Math.round(photo.location.accuracyMeters)}m ·{" "}
                {new Date(photo.capturedAt).toLocaleString("vi-VN")}
              </Text>
              <Text style={[civicType.meta, { color: colors.textMuted }]}>
                {photo.location.latitude.toFixed(6)},{" "}
                {photo.location.longitude.toFixed(6)}
              </Text>
              <Button
                appearance="civic"
                variant="outline"
                title="CHỤP LẠI"
                disabled={!allowed || submitting}
                onPress={() => {
                  setPhotoConfirmed(false);
                  setCameraOpen(true);
                }}
              />
              {!photoConfirmed ? (
                <Button
                  appearance="civic"
                  title="SỬ DỤNG ẢNH NÀY"
                  disabled={!allowed || submitting}
                  onPress={() => setPhotoConfirmed(true)}
                />
              ) : (
                <Text style={{ color: colors.primary }}>
                  ✓ Đã chọn ảnh sau xử lý
                </Text>
              )}
            </>
          ) : (
            <Button
              appearance="civic"
              title="CHỤP ẢNH SAU XỬ LÝ"
              disabled={!allowed}
              onPress={() => setCameraOpen(true)}
            />
          )}
          <Text style={[civicType.meta, { color: colors.textMuted }]}>
            Chỉ chụp trực tiếp tại hiện trường. Không dùng ảnh thư viện.
          </Text>
        </Card>
        <Card appearance="civic" style={styles.card}>
          <Text style={[civicType.section, { color: colors.cyan }]}>
            Thông tin xử lý hiện trường
          </Text>
          <Input
            label="Tóm tắt xử lý *"
            multiline
            value={summary}
            maxLength={4000}
            editable={!submitting && allowed}
            onChangeText={setSummary}
            placeholder="Ghi rõ công việc đã hoàn thành tại điểm rác"
          />
          <Text style={[civicType.section, { color: colors.text }]}>
            Phương pháp xử lý *
          </Text>
          <View style={styles.options}>
            {[...WASTE_TREATMENTS, "Khác"].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{
                  selected: treatment === value,
                  disabled: submitting || !allowed,
                }}
                disabled={submitting || !allowed}
                onPress={() => setTreatment(value === "Khác" ? "" : value)}
                style={[
                  styles.option,
                  {
                    backgroundColor:
                      treatment === value ? colors.cyanSoft : colors.elevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[civicType.meta, { color: colors.text }]}>
                  {value}
                </Text>
              </Pressable>
            ))}
          </View>
          <Input
            label="Phương pháp đã chọn / nhập phương pháp khác"
            value={treatment}
            maxLength={4000}
            editable={!submitting && allowed}
            onChangeText={setTreatment}
          />
          <Text style={[civicType.section, { color: colors.text }]}>
            Vật tư / thiết bị
          </Text>
          <View style={styles.options}>
            {WASTE_MATERIALS.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: materials.includes(value) }}
                disabled={submitting || !allowed}
                onPress={() =>
                  setMaterials((current) =>
                    current.includes(value)
                      ? current.filter((item) => item !== value)
                      : [...current, value],
                  )
                }
                style={[
                  styles.option,
                  {
                    backgroundColor: materials.includes(value)
                      ? colors.greenSoft
                      : colors.elevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[civicType.meta, { color: colors.text }]}>
                  {materials.includes(value) ? "✓ " : ""}
                  {value}
                </Text>
              </Pressable>
            ))}
          </View>
          <Input
            label="Ghi chú kết quả (không bắt buộc)"
            multiline
            maxLength={4000}
            editable={!submitting && allowed}
            value={notes}
            onChangeText={setNotes}
          />
        </Card>
        {error ? (
          <Text
            accessibilityRole="alert"
            style={[civicType.body, { color: colors.danger }]}
          >
            {error}
          </Text>
        ) : null}
        <Text style={[civicType.meta, { color: colors.textMuted }]}>
          Ảnh xử lý được ghi nhận cùng thời gian và vị trí thực tế để phục vụ
          nghiệm thu. Gửi kết quả không tự động đóng báo cáo.
        </Text>
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
          title="GỬI KẾT QUẢ ĐỂ NGHIỆM THU"
          onPress={() => void send()}
          loading={submitting}
          disabled={!allowed || !photoConfirmed || submitted}
        />
      </View>
      <Modal
        visible={cameraOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setCameraOpen(false)}
      >
        {cameraOpen && allowed ? (
          <OfficerResolutionCamera
            onClose={() => setCameraOpen(false)}
            onCapture={(capture) => {
              setPhoto(capture);
              setPhotoConfirmed(false);
              setCameraOpen(false);
              setError(null);
            }}
          />
        ) : null}
      </Modal>
    </KeyboardAvoidingView>
  );
};
const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 8,
  },
  card: { gap: 12 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    padding: 10,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 1,
  },
});
