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

type Props = NativeStackScreenProps<ReportFlowParamList, "ReportPhotoReview">;

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
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const aspectRatio =
    capture?.width && capture.height ? capture.width / capture.height : 4 / 3;
  const evidenceHeight = Math.min(
    windowHeight * 0.46,
    (windowWidth - 32) / aspectRatio,
  );
  const integrityCount =
    Number(Boolean(capture?.originalLocalUri)) +
    Number(Boolean(location?.source === "DEVICE_GPS")) +
    Number(Boolean(capture?.capturedAt));

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
      <ReportHeader onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ReportProgress step={2} />
        <ReportScreenIntro
          eyebrow="KIỂM TRA ẢNH"
          title="Xem lại ảnh hiện trường"
          description="Đảm bảo ảnh rõ và phản ánh đúng tình trạng tại vị trí báo cáo."
        />
        <View
          style={[
            styles.imageCard,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
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
              onLoadEnd={() => void renderDisplayImage()}
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
          {rendering ? (
            <View style={styles.renderingBadge}>
              <ActivityIndicator size="small" color="#22C55E" />
              <Text style={styles.renderingText}>Đang tạo watermark...</Text>
            </View>
          ) : null}
        </View>
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
        <View
          style={[
            styles.integrityCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.integrityHeader}>
            <Text style={[styles.technicalLabel, { color: colors.textMuted }]}>
              TÍNH TOÀN VẸN DỮ LIỆU
            </Text>
            <Text
              style={[
                styles.passed,
                {
                  color: integrityCount === 3 ? colors.primary : colors.accent,
                },
              ]}
            >
              {integrityCount}/3 ĐẠT
            </Text>
          </View>
          <IntegrityRow
            title="Camera trực tiếp"
            body="Ảnh được chụp trong luồng báo cáo."
            colors={colors}
          />
          <IntegrityRow
            title="GPS thiết bị"
            body="Vị trí được ghi nhận trước khi chụp."
            colors={colors}
          />
          <IntegrityRow
            title="Thời gian chụp"
            body="Metadata thời gian đã được lưu."
            colors={colors}
          />
        </View>
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
            onPress={() => navigation.navigate("ReportImageValidation")}
            disabled={integrityCount !== 3}
            style={[
              styles.useButton,
              {
                backgroundColor: colors.primary,
                opacity: integrityCount === 3 ? 1 : 0.45,
              },
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>SỬ DỤNG ẢNH NÀY</Text>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        </View>
      </ReportBottomActions>
    </View>
  );
};

const IntegrityRow = ({
  title,
  body,
  colors,
}: {
  title: string;
  body: string;
  colors: { text: string; textMuted: string; primary: string; border: string };
}) => (
  <View style={[styles.integrityRow, { borderTopColor: colors.border }]}>
    <View style={styles.checkIcon}>
      <CheckCircle2 size={17} color={colors.primary} />
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
  content: {
    padding: space.lg,
    paddingBottom: space.section,
    gap: space.section,
  },
  imageCard: { borderRadius: radius.card, overflow: "hidden" },
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
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
  },
  integrityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingBottom: space.md,
  },
  technicalLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  passed: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6 },
  integrityRow: {
    borderTopWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
  },
  checkIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  integrityCopy: { flex: 1 },
  integrityTitle: civicType.cardTitle,
  integrityBody: { marginTop: space.xs, fontSize: 11, lineHeight: 16 },
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
