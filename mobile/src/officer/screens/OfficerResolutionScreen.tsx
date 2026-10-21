import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert as RNAlert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { usePreventRemove } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  XCircle,
} from "lucide-react-native";
import { useProfile } from "../../auth/hooks/useAuth";
import { ownsOfficerTask } from "../utils/officerPresentation";
import {
  OfficerBadge,
  OfficerHeader,
  OfficerStepProgressBar,
  officerStyles as s,
} from "../components/OfficerUI";
import { OfficerEvidenceComparison } from "../components/OfficerEvidenceComparison";
import {
  useAlert,
  useResolveIncident,
  useUploadMedia,
} from "../../shared/hooks/useAlerts";
import { alertService } from "../../shared/api/alertService";
import { getGeoJsonMapCoordinates } from "../../shared/utils/maps";
import { Card } from "../../shared/components/ui/Card";
import { Input } from "../../shared/components/ui/Input";
import { Button } from "../../shared/components/ui/Button";
import { useCivicTheme } from "../../shared/theme/useCivicTheme";
import { civicStyles, civicType } from "../../shared/theme/civicDesign";
import { OfficerResolutionCamera } from "./OfficerResolutionCamera";
import {
  WASTE_MATERIALS,
  WASTE_TREATMENTS,
  createOfficerResolutionSubmitter,
  evaluateResolutionVerification,
  validateOfficerResolution,
  type OfficerPhoto,
  type VerificationStatus,
} from "../utils/officerResolution";
import {
  isWasteOfficerTask,
  officerErrorMessage,
} from "../utils/officerWorkflow";
import type { PreSubmitVisionResult } from "../../shared/types";
import type { OfficerStackParamList } from "../../app/navigation/types";

type Props = NativeStackScreenProps<OfficerStackParamList, "OfficerResolution">;

// Bước 3: Check-out (Hoàn thành) - Căn chỉnh góc chụp, Bảng kiểm tra nghiệm thu tự động 3 tiêu chí & Gửi kết quả
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

  // Mở Camera chụp ảnh kết quả khi vào Bước 3
  const [cameraOpen, setCameraOpen] = useState(true);
  const [photo, setPhoto] = useState<OfficerPhoto>();
  const [angleConfirmed, setAngleConfirmed] = useState(true);
  const [visionStatus, setVisionStatus] = useState<
    "IDLE" | "ANALYZING" | "VERIFIED" | "UNAVAILABLE"
  >("IDLE");
  const [visionResult, setVisionResult] =
    useState<PreSubmitVisionResult | null>(null);

  const [summary, setSummary] = useState("");
  const [treatment, setTreatment] = useState<string>(WASTE_TREATMENTS[0]);
  const [materials, setMaterials] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  usePreventRemove(submitting, () =>
    RNAlert.alert(
      "Đang gửi báo cáo hoàn thành",
      "Vui lòng chờ hệ thống lưu kết quả xử lý trước khi rời trang.",
    ),
  );

  const submittingRef = useRef(false);
  const analysisVersionRef = useRef(0);

  useEffect(() => {
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

  const incidentCoords = getGeoJsonMapCoordinates(task?.location?.coordinates);
  const before = task?.fieldEvidence?.[0];
  const beforeUri =
    before?.displayUrl || before?.originalUrl || task?.mediaUrls?.[0];

  // Khi cán bộ vừa chụp xong ảnh Sau xử lý: tự động tải lên & chạy kiểm tra AI/Vision để đánh giá hiện trường sạch sẽ
  const handleCapturedPhoto = async (captured: OfficerPhoto) => {
    const currentVersion = ++analysisVersionRef.current;
    setPhoto(captured);
    setAngleConfirmed(true);
    setCameraOpen(false);
    setError(null);
    setVisionResult(null);
    setVisionStatus("ANALYZING");

    try {
      const uploadedUrl = await upload.mutateAsync({
        fileUri: captured.originalLocalUri,
        fileName: `officer_after_${Date.now()}.jpg`,
        fileType: "image/jpeg",
      });
      if (analysisVersionRef.current !== currentVersion) return;

      if (uploadedUrl && /^https?:\/\//i.test(uploadedUrl)) {
        setPhoto((prev) =>
          prev?.originalLocalUri === captured.originalLocalUri
            ? { ...prev, uploadedUrl }
            : prev,
        );
        const vision = await alertService.analyzeUploadedImage(uploadedUrl);
        if (analysisVersionRef.current !== currentVersion) return;
        setVisionResult(vision);
        setVisionStatus("VERIFIED");
      } else {
        setVisionStatus("UNAVAILABLE");
      }
    } catch {
      if (analysisVersionRef.current !== currentVersion) return;
      setVisionStatus("UNAVAILABLE");
    }
  };

  // Đánh giá 3 tiêu chí nghiệm thu tự động (Verification Checklist)
  const checklist = evaluateResolutionVerification({
    photo,
    incidentLocation: incidentCoords,
    beforeDimensions: before
      ? { width: before.width, height: before.height }
      : null,
    angleConfirmed,
    visionStatus,
    visionResult,
  });

  const draft = {
    photo,
    verifiedArrival: allowed,
    resolutionSummary: summary,
    treatmentMethod: treatment,
    materialsUsed: materials.join(", "),
    additionalNotes: notes,
  };

  // Gửi kết quả nghiệm thu hoàn thành công việc
  const send = async () => {
    if (submittingRef.current) return;
    if (!checklist.isAcceptable) {
      setError(
        "Ảnh kết quả chưa đạt đủ tiêu chí đối chiếu vị trí hoặc góc chụp. Vui lòng kiểm tra bảng nghiệm thu và chụp lại.",
      );
      return;
    }
    const validation = validateOfficerResolution(draft);
    if (validation) {
      setError(validation);
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
          "Không thể tải ảnh hoặc gửi báo cáo hoàn thành. Vui lòng kiểm tra kết nối mạng rồi thử lại.",
        ),
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const renderStatusIcon = (status: VerificationStatus) => {
    if (status === "PASSED")
      return <CheckCircle2 size={20} color={colors.primary} />;
    if (status === "WARNING")
      return <AlertTriangle size={20} color={colors.warning} />;
    if (status === "FAILED")
      return <XCircle size={20} color={colors.danger} />;
    return <Clock3 size={20} color={colors.cyan} />;
  };

  const getStatusColor = (status: VerificationStatus) => {
    if (status === "PASSED") return colors.primary;
    if (status === "WARNING") return colors.warning;
    if (status === "FAILED") return colors.danger;
    return colors.cyan;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <OfficerHeader
        title="Check-out (Hoàn thành)"
        back={navigation.goBack}
        disabled={submitting}
      />
      <OfficerStepProgressBar
        task={
          submitted ? { status: "RESOLVED", checkIn: task?.checkIn } : task
        }
        step={3}
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
              : "Nhiệm vụ phải đang xử lý và đã điểm danh hiện trường trước khi hoàn thành."}
          </Text>
        ) : null}

        {/* Khung đối chiếu trực quan 2 ảnh đặt cạnh nhau: Trước & Sau */}
        <OfficerEvidenceComparison
          beforeUri={ownsOfficerTask(task, profile) ? beforeUri : undefined}
          beforeFallback={before?.originalUrl}
          afterUri={photo?.originalLocalUri}
          beforeAt={before?.capturedAt}
          afterAt={photo?.capturedAt}
        />

        {/* Bảng Danh sách kiểm tra nghiệm thu tự động (Verification Checklist) gồm 3 tiêu chí */}
        <Card appearance="civic" style={styles.card}>
          <View style={s.row}>
            <ShieldCheck size={20} color={colors.primary} />
            <Text
              style={[
                civicType.section,
                s.grow,
                { color: colors.text },
              ]}
            >
              Danh sách kiểm tra nghiệm thu tự động
            </Text>
          </View>

          {[
            checklist.gpsMatch,
            checklist.angleConsistency,
            checklist.resolutionClean,
          ].map((item, idx) => {
            const tone = getStatusColor(item.status);
            return (
              <View
                key={item.key}
                style={[
                  styles.checklistItem,
                  {
                    backgroundColor: colors.elevated,
                    borderColor:
                      item.status === "PASSED"
                        ? colors.primary + "40"
                        : item.status === "FAILED"
                          ? colors.danger
                          : colors.border,
                  },
                ]}
              >
                <View style={[s.row, { alignItems: "flex-start" }]}>
                  {renderStatusIcon(item.status)}
                  <View style={[s.grow, { gap: 4 }]}>
                    <View
                      style={[
                        s.row,
                        { justifyContent: "space-between", flexWrap: "wrap" },
                      ]}
                    >
                      <Text
                        style={[
                          s.body,
                          { color: colors.text, fontWeight: "700" },
                        ]}
                      >
                        {idx + 1}. {item.title}
                      </Text>
                      <OfficerBadge label={item.badgeLabel} color={tone} />
                    </View>
                    <Text style={[s.meta, { color: colors.textSecondary }]}>
                      {item.detail}
                    </Text>
                  </View>
                </View>

                {/* Cho phép cán bộ xác nhận hoặc báo lệch góc chụp ở tiêu chí số 2 */}
                {item.key === "ANGLE_CONSISTENCY" && photo ? (
                  <View style={[s.row, { marginTop: 6, flexWrap: "wrap" }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Xác nhận góc chụp hợp lệ"
                      onPress={() => setAngleConfirmed(true)}
                      style={[
                        styles.angleToggleBtn,
                        {
                          backgroundColor: angleConfirmed
                            ? colors.greenSoft
                            : colors.surface,
                          borderColor: angleConfirmed
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.meta,
                          {
                            color: angleConfirmed
                              ? colors.primary
                              : colors.textSecondary,
                            fontWeight: "700",
                          },
                        ]}
                      >
                        ✓ Góc chụp hợp lệ
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Báo ảnh lệch góc hoặc bị mờ"
                      onPress={() => setAngleConfirmed(false)}
                      style={[
                        styles.angleToggleBtn,
                        {
                          backgroundColor: !angleConfirmed
                            ? colors.surface
                            : colors.surface,
                          borderColor: !angleConfirmed
                            ? colors.warning
                            : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.meta,
                          {
                            color: !angleConfirmed
                              ? colors.warning
                              : colors.textMuted,
                            fontWeight: "700",
                          },
                        ]}
                      >
                        ⚠ Lệch góc / Ảnh mờ
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}

          {/* Nút phụ "Chụp lại ảnh kết quả" để quay lại camera nếu ảnh bị lệch góc hoặc chưa đạt */}
          {photo ? (
            <Button
              appearance="civic"
              variant="outline"
              title="Chụp lại ảnh kết quả"
              icon={<Camera size={16} color={colors.primary} />}
              disabled={!allowed || submitting}
              onPress={() => setCameraOpen(true)}
            />
          ) : null}
        </Card>

        <Card appearance="civic" style={styles.card}>
          <Text style={[civicType.section, { color: colors.cyan }]}>
            Thông tin xử lý hiện trường
          </Text>
          <Input
            label="Ghi chú tóm tắt kết quả xử lý *"
            multiline
            value={summary}
            maxLength={4000}
            editable={!submitting && allowed}
            onChangeText={setSummary}
            placeholder="Mô tả kết quả dọn dẹp sạch sẽ tại điểm sự cố..."
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
            label="Phương pháp thực hiện chi tiết"
            value={treatment}
            maxLength={4000}
            editable={!submitting && allowed}
            onChangeText={setTreatment}
          />
          <Text style={[civicType.section, { color: colors.text }]}>
            Vật tư & thiết bị đã sử dụng
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
            label="Ghi chú bổ sung (không bắt buộc)"
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
      </ScrollView>

      {/* Duy nhất 1 Nút Hành Động Chính (Single Primary CTA) ở dưới cùng */}
      <View
        style={{
          padding: 12,
          paddingBottom: Math.max(12, insets.bottom),
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        {!photo ? (
          <Button
            appearance="civic"
            title="Chụp ảnh kết quả (Sau xử lý)"
            disabled={!allowed || submitting}
            onPress={() => setCameraOpen(true)}
          />
        ) : (
          <Button
            appearance="civic"
            title="Xác nhận Check-out (Hoàn thành)"
            onPress={() => void send()}
            loading={submitting}
            disabled={!allowed || !checklist.isAcceptable || submitted}
          />
        )}
      </View>

      <Modal
        visible={cameraOpen && allowed}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setCameraOpen(false)}
      >
        {cameraOpen && allowed ? (
          <OfficerResolutionCamera
            beforeImageUri={beforeUri}
            referenceImageUri={beforeUri}
            onClose={() => setCameraOpen(false)}
            onCapture={(capture) => {
              void handleCapturedPhoto(capture);
            }}
          />
        ) : null}
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: { gap: 12 },
  checklistItem: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  angleToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
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
