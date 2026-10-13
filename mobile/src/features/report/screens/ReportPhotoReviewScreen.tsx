import {
  civicSpace as space,
  civicRadius as radius,
  civicType,
} from "../../../theme/civicDesign";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import ViewShot, { captureRef, type ViewShotRef } from "react-native-view-shot";
import {
  Camera,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ReportFlowParamList } from "../../../navigation/types";
import { useReportTheme } from "../useReportTheme";
import { ReportScreenIntro } from "../components/ReportScreenIntro";
import { ReportBottomActions } from "../components/ReportBottomActions";
import {
  formatWatermarkData,
  persistWatermarkedDisplayImage,
} from "../../../utils/watermark";
import { useFieldReport } from "../FieldReportContext";
import { ReportHeader } from "../components/ReportHeader";
import { ReportProgress } from "../components/ReportProgress";
import { EvidenceImageFrame } from "../../../components/media/EvidenceImageFrame";
import { FieldNotice, FieldEntrance } from "../components/stitch/FieldUI";
import { fieldStyles } from "../components/stitch/fieldDesign";
import { fieldIntegrity } from "../components/stitch/fieldPresentation";

type Props = NativeStackScreenProps<ReportFlowParamList, "ReportPhotoReview">;
// hiển thị ảnh vừa chụp để người dân kiểm tra lại trước khi phân tích ai
export const ReportPhotoReviewScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useReportTheme();
  const { draft, setDraft } = useFieldReport();
  const capture = draft.capture;
  const location = draft.location;
  const viewShotRef = useRef<ViewShotRef>(null);
  const generatedForRef = useRef<string | null>(
    capture?.displayLocalUri ? capture.originalLocalUri : null,
  );
  const [rendering, setRendering] = useState(false);
  const [watermarkError, setWatermarkError] = useState<string | null>(null);
  // định dạng thông tin watermark gồm tọa độ, địa chỉ, thời gian và nhãn tác nghiệp
  const watermark = useMemo(
    () =>
      formatWatermarkData(
        {
          latitude: location?.latitude,
          longitude: location?.longitude,
          accuracyMeters: location?.accuracyMeters,
          address: location?.address,
          timestamp: capture ? new Date(capture.capturedAt) : undefined,
          brandTag: "ECOALERT FIELD CAPTURE",
        },
        "vi",
      ),
    [capture, location],
  );
  const { width: windowWidth } = useWindowDimensions();
  const aspectRatio =
    capture?.width && capture.height ? capture.width / capture.height : 3 / 4;
  const evidenceHeight = (windowWidth - 32) / aspectRatio;
  const integrity = fieldIntegrity(capture, location);
  const integrityCount =
    Number(integrity.camera) + Number(integrity.gps) + Number(integrity.time);
  // tạo ra bức ảnh có in kèm ngày giờ và tọa độ gps ở góc dưới
  const renderDisplayImage = useCallback(async () => {
    if (
      !capture ||
      !viewShotRef.current ||
      rendering ||
      generatedForRef.current === capture.originalLocalUri
    )
      return;
    setRendering(true);
    setWatermarkError(null);
    generatedForRef.current = capture.originalLocalUri;
    try {
      const temporaryUri = await captureRef(viewShotRef, {
        format: "jpg",
        quality: 0.95,
        result: "tmpfile",
      });
      const displayLocalUri = await persistWatermarkedDisplayImage(
        temporaryUri,
        capture.capturedAt,
      );
      setDraft((current) =>
        current.capture?.originalLocalUri === capture.originalLocalUri
          ? { ...current, capture: { ...current.capture, displayLocalUri } }
          : current,
      );
    } catch {
      generatedForRef.current = null;
      setWatermarkError(
        "Không thể tạo ảnh hiển thị có watermark. Ảnh gốc vẫn được giữ nguyên.",
      );
    } finally {
      setRendering(false);
    }
  }, [capture, rendering, setDraft]);
  // xóa bức ảnh hiện tại và quay lại camera để chụp tấm khác
  const retake = () => {
    setDraft((current) => ({
      ...current,
      capture: undefined,
      imageValidation: { state: "IDLE", detectedObjects: [] },
    }));
    navigation.navigate("ReportCamera");
  };

  if (!capture || !location)
    return (
      <View
        style={[
          styles.missingScreen,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <TriangleAlert size={36} color={colors.accent} />
        <Text style={[styles.missingTitle, { color: colors.text }]}>
          Chưa có ảnh hiện trường
        </Text>
        <Text style={[styles.missingBody, { color: colors.textMuted }]}>
          Hãy quay lại Camera để chụp ảnh trực tiếp.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("ReportCamera")}
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>MỞ CAMERA</Text>
        </TouchableOpacity>
      </View>
    );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      {/* giữ kích thước hiển thị đóng dấu watermark độc lập với khung giao diện */}
      <View
        style={[
          styles.captureSource,
          { width: windowWidth - 32, top: insets.top },
        ]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <ViewShot
          ref={viewShotRef}
          options={{ format: "jpg", quality: 0.95, result: "tmpfile" }}
          style={styles.viewShot}
        >
          <Image
            source={{ uri: capture.originalLocalUri }}
            style={[styles.image, { height: evidenceHeight }]}
            resizeMode="contain"
            onLoad={() => void renderDisplayImage()}
          />
          <View style={styles.watermark}>
            <View style={styles.watermarkBrand}>
              <ShieldCheck size={13} color="#22C55E" />
              <Text style={styles.watermarkBrandText}>
                {watermark.brandStr}
              </Text>
            </View>
            <Text style={styles.watermarkAddress} numberOfLines={2}>
              {watermark.addressStr}
            </Text>
            <Text style={styles.watermarkLine}>{watermark.locationStr}</Text>
            <Text style={styles.watermarkLine}>
              {watermark.dateTimeStr.replace("Captured:", "")}
            </Text>
          </View>
        </ViewShot>
      </View>
      <ReportHeader title="Xem lại ảnh" onBack={navigation.goBack} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* bước 2 */}
        <ReportProgress step={2} />
        <ReportScreenIntro
          eyebrow="ẢNH HIỆN TRƯỜNG"
          title="Xem lại ảnh vừa chụp"
          description="Xem lại chất lượng hình ảnh hiện trường trước khi chuyển sang giai đoạn phân tích AI."
        />
        <EvidenceImageFrame
          imageUri={capture.displayLocalUri || capture.originalLocalUri}
          fallbackUri={capture.originalLocalUri}
          disabled={rendering || (!capture.displayLocalUri && !watermarkError)}
          accessibilityLabel="Ảnh hiện trường có watermark"
          style={styles.evidenceFrame}
          overlay={
            <>
              <Text style={styles.photoBadge}>ẢNH HIỆN TRƯỜNG</Text>
              {!capture.displayLocalUri ? (
                <View style={[styles.watermark, styles.previewWatermark]}>
                  <Text style={styles.watermarkBrandText}>
                    {watermark.brandStr}
                  </Text>
                  <Text style={styles.watermarkAddress} numberOfLines={2}>
                    {watermark.addressStr}
                  </Text>
                  <Text style={styles.watermarkLine} numberOfLines={1}>
                    {watermark.locationStr}
                  </Text>
                  <Text style={styles.watermarkLine} numberOfLines={1}>
                    {watermark.dateTimeStr.replace("Captured:", "")}
                  </Text>
                </View>
              ) : null}
              {rendering ? (
                <View style={styles.renderingBadge}>
                  <ActivityIndicator size="small" color="#22C55E" />
                  <Text style={styles.renderingText}>
                    Đang tạo watermark...
                  </Text>
                </View>
              ) : null}
            </>
          }
        />
        <Text style={[styles.viewerHint, { color: colors.textMuted }]}>
          Chạm để xem ảnh
        </Text>
        {watermarkError ? (
          <View
            style={[styles.errorCard, { borderColor: "rgba(245,158,11,0.3)" }]}
          >
            <TriangleAlert size={17} color={colors.accent} />
            <View style={styles.errorCopy}>
              <Text style={[styles.errorText, { color: colors.textMuted }]}>
                {watermarkError}
              </Text>
              <TouchableOpacity
                onPress={() => void renderDisplayImage()}
                style={styles.retryWatermark}
                accessibilityRole="button"
              >
                <RefreshCw size={13} color={colors.secondary} />
                <Text style={[styles.retryText, { color: colors.secondary }]}>
                  THỬ TẠO LẠI
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        <View style={styles.integrityCard}>
          <IntegrityRow
            title="Camera trực tiếp"
            body={integrity.camera ? "Ảnh gốc đã lưu" : "Thiếu ảnh gốc"}
            valid={integrity.camera}
            colors={colors}
          />
          <IntegrityRow
            title="GPS thiết bị"
            body={
              integrity.gps
                ? `±${Math.round(location.accuracyMeters)}m`
                : "Cần kiểm tra"
            }
            valid={integrity.gps}
            colors={colors}
          />
          <IntegrityRow
            title="Thời gian chụp"
            body={integrity.time ? "Đã ghi nhận" : "Chưa có"}
            valid={integrity.time}
            colors={colors}
          />
        </View>
        <FieldEntrance>
          <FieldNotice title="Ảnh đã rõ nội dung cần phản ánh chưa?">
            Hãy đảm bảo khu vực rác được nhìn thấy rõ, không bị quá tối hoặc che
            khuất.
          </FieldNotice>
        </FieldEntrance>
      </ScrollView>
      <ReportBottomActions>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={retake}
            style={[
              styles.secondaryButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            accessibilityRole="button"
          >
            <Camera size={17} color={colors.text} />
            <Text style={[styles.secondaryText, { color: colors.text }]}>
              CHỤP LẠI
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
          // xác nhận sử dụng ảnh này và chuyển sang bước kiểm tra nhận diện ai
            onPress={() => navigation.navigate("ReportImageValidation")}
            disabled={
              integrityCount !== 3 ||
              rendering ||
              (!capture.displayLocalUri && !watermarkError)
            }
            style={[
              styles.useButton,
              {
                backgroundColor: colors.cta,
                opacity:
                  integrityCount === 3 &&
                  !rendering &&
                  (capture.displayLocalUri || watermarkError)
                    ? 1
                    : 0.45,
              },
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>DÙNG ẢNH NÀY</Text>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        </View>
      </ReportBottomActions>
    </View>
  );
};
// hiển thị từng dòng kiểm tra tính toàn vẹn của dữ liệu hiện trường
const IntegrityRow = ({
  title,
  body,
  colors,
  valid,
}: {
  title: string;
  body: string;
  colors: { text: string; textMuted: string; primary: string; border: string };
  valid: boolean;
}) => (
  <View style={[styles.integrityRow, { borderTopColor: colors.border }]}>
    <View style={styles.checkIcon}>
      <CheckCircle2 size={15} color={valid ? colors.primary : "#F59E0B"} />
    </View>
    <View style={styles.integrityCopy}>
      <Text style={[styles.integrityTitle, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.integrityBody, { color: colors.textMuted }]}>
        {body}
      </Text>
    </View>
  </View>
);
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: fieldStyles.content,
  evidenceFrame: {
    width: "100%",
    maxWidth: 480,
    aspectRatio: 3 / 4,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.22)",
    borderRadius: 18,
  },
  photoBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(7,16,31,0.82)",
    color: "#22C55E",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "800",
    padding: 6,
    borderRadius: 6,
  },
  // giữ ảnh chụp gắn liền trong khung nền phía sau thanh tiêu đề và danh sách cuộn
  // ngoài danh sách cuộn thì cơ chế cắt giao diện trên android không làm mất nguồn ảnh này
  captureSource: { position: "absolute", left: 16 },
  previewWatermark: { maxHeight: "30%", overflow: "hidden", padding: space.sm },
  viewerHint: {
    marginTop: -space.md,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },
  viewShot: { backgroundColor: "#081522" },
  image: { width: "100%" },
  watermark: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: space.md,
    backgroundColor: "rgba(7,16,31,0.76)",
  },
  watermarkBrand: { flexDirection: "row", alignItems: "center", gap: space.xs },
  watermarkBrandText: {
    color: "#22C55E",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  watermarkAddress: {
    color: "#F8FAFC",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: space.xs,
  },
  watermarkLine: {
    color: "#CBD5E1",
    fontSize: 10,
    lineHeight: 14,
    marginTop: space.xs,
  },
  renderingBadge: {
    position: "absolute",
    right: 8,
    top: 8,
    borderRadius: 8,
    backgroundColor: "rgba(7,16,31,0.85)",
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  renderingText: { color: "#F8FAFC", fontSize: 10, fontWeight: "600" },
  errorCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: space.md,
    flexDirection: "row",
    gap: space.sm,
  },
  errorCopy: { flex: 1 },
  errorText: { fontSize: 13, lineHeight: 20 },
  retryWatermark: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    alignSelf: "flex-start",
  },
  retryText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  integrityCard: {
    flexDirection: "row",
    gap: 6,
  },
  integrityRow: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#101D31",
    borderRadius: 10,
    alignItems: "center",
    gap: 4,
    padding: 8,
  },
  checkIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  integrityCopy: { alignItems: "center" },
  integrityTitle: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  integrityBody: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
  },
  actions: { flexDirection: "row", gap: space.sm },
  secondaryButton: {
    flex: 2,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
  },
  secondaryText: civicType.button,
  useButton: {
    flex: 3,
    minHeight: 52,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
  },
  primaryButton: {
    minHeight: 52,
    minWidth: 210,
    marginTop: space.section,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#07101F",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0,
  },
  arrow: { color: "#07101F", fontSize: 18, fontWeight: "800" },
  missingScreen: {
    flex: 1,
    paddingHorizontal: space.section,
    alignItems: "center",
    justifyContent: "center",
  },
  missingTitle: { marginTop: space.lg, fontSize: 22, fontWeight: "800" },
  missingBody: {
    marginTop: space.sm,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
});
