import React, { useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert as RNAlert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import {
  useAlert,
  useAddOfficerNote,
  useStartHandling,
} from "../../hooks/useAlerts";
import { useProfile } from "../../hooks/useAuth";
import { EvidenceImageFrame } from "../../components/media/EvidenceImageFrame";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { OverallAiAnalysisCard } from "../../components/ai/OverallAiAnalysisCard";
import {
  OfficerHeader,
  OfficerBadge,
  OfficerCard,
  officerStyles as s,
} from "../../components/officer/OfficerUI";
import { OfficerTimeline } from "../../components/officer/OfficerTimeline";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { getGeoJsonMapCoordinates, openGoogleMaps } from "../../utils/maps";
import { getAlertDisplaySeverity } from "../../utils/aiAnalysis";
import {
  getCategoryLabel,
  getSeverityLabel,
} from "../../utils/incidentPresentation";
import { getWasteDetectionLabel } from "../../utils/visionBoundingBox";
import {
  getOfficerTaskState,
  officerErrorMessage,
  officerStatus,
  isWasteOfficerTask,
} from "../../utils/officerWorkflow";
import {
  ownsOfficerTask,
  officerDate,
  officerReference,
} from "../../utils/officerPresentation";
import type { OfficerStackParamList } from "../../navigation/types";
type Props = NativeStackScreenProps<
  OfficerStackParamList,
  "OfficerAlertDetail"
>;
export const OfficerAlertDetailScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useCivicTheme();
  const query = useAlert(route.params.id);
  const { data: profile } = useProfile();
  const start = useStartHandling();
  const addNote = useAddOfficerNote();
  const [note, setNote] = useState("");
  const [openingMaps, setOpeningMaps] = useState(false);
  const actionLock = useRef(false);
  const noteLock = useRef(false);
  const mapsLock = useRef(false);
  const alert = query.data;
  const mine = ownsOfficerTask(alert, profile);
  const startTask = async () => {
    if (
      !alert ||
      !mine ||
      getOfficerTaskState(alert).action !== "START" ||
      actionLock.current
    )
      return;
    actionLock.current = true;
    try {
      await start.mutateAsync(alert._id);
    } catch (error: unknown) {
      RNAlert.alert(
        "Không thể bắt đầu",
        officerErrorMessage(
          error,
          "Không thể bắt đầu xử lý. Vui lòng thử lại.",
        ),
      );
    } finally {
      actionLock.current = false;
    }
  };
  const directions = async () => {
    const coordinates = mine
      ? getGeoJsonMapCoordinates(alert?.location?.coordinates)
      : null;
    if (!coordinates || mapsLock.current) return;
    mapsLock.current = true;
    setOpeningMaps(true);
    try {
      const result = await openGoogleMaps(
        coordinates.latitude,
        coordinates.longitude,
        "navigate",
      );
      if (!result.success)
        RNAlert.alert(
          "Không thể mở chỉ đường",
          "Vui lòng kiểm tra Google Maps và thử lại.",
        );
    } finally {
      mapsLock.current = false;
      setOpeningMaps(false);
    }
  };
  const saveNote = async () => {
    if (
      !alert ||
      !mine ||
      !["ASSIGNED", "IN_PROGRESS"].includes(officerStatus(alert)) ||
      !note.trim() ||
      noteLock.current
    )
      return;
    noteLock.current = true;
    try {
      await addNote.mutateAsync({ id: alert._id, note: note.trim() });
      setNote("");
    } catch (error: unknown) {
      RNAlert.alert(
        "Không thể lưu ghi chú",
        officerErrorMessage(error, "Vui lòng thử lại."),
      );
    } finally {
      noteLock.current = false;
    }
  };
  const root = {
    backgroundColor: colors.background,
    paddingTop: insets.top,
    flex: 1,
  };
  if (!alert || query.isError || !mine)
    return (
      <View style={root}>
        <OfficerHeader title="Chi tiết sự cố" back={navigation.goBack} />
        <View style={{ padding: 24, gap: 16 }}>
          {query.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[s.body, { color: colors.textMuted }]}>
              Nhiệm vụ không khả dụng hoặc chưa được phân công cho bạn.
            </Text>
          )}
          <Button
            appearance="civic"
            title="Thử lại"
            onPress={() => void query.refetch()}
          />
        </View>
      </View>
    );
  const state = getOfficerTaskState(alert);
  const status = officerStatus(alert);
  const wasteTask = isWasteOfficerTask(alert);
  const readOnly = !["ASSIGNED", "IN_PROGRESS"].includes(status) || !wasteTask;
  const coordinates = getGeoJsonMapCoordinates(alert.location?.coordinates);
  const before = alert.fieldEvidence?.length
    ? alert.fieldEvidence.map((e) => ({
        uri: e.displayUrl || e.originalUrl,
        fallback: e.originalUrl,
        at: e.capturedAt,
      }))
    : (alert.mediaUrls || []).map((uri) => ({
        uri,
        fallback: uri,
        at: undefined,
      }));
  const actionLabel =
    state.action === "START"
      ? "BẮT ĐẦU XỬ LÝ"
      : state.action === "ARRIVE"
        ? "ĐIỂM DANH GPS TẠI HIỆN TRƯỜNG"
        : "GHI NHẬN KẾT QUẢ XỬ LÝ";
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={root}
    >
      <OfficerHeader title="Chi tiết sự cố" back={navigation.goBack} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          s.content,
          { paddingBottom: readOnly ? insets.bottom + 24 : 24 },
        ]}
      >
        <View style={[s.row, { flexWrap: "wrap" }]}>
          <Text style={[s.technical, { color: colors.cyan }]}>
            {officerReference(alert)}
          </Text>
          <OfficerBadge label={state.label} color={state.color} />
          <OfficerBadge
            label={getCategoryLabel(alert.category)}
            color={colors.cyan}
          />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={[s.technical, { color: colors.textMuted }]}>
            ẢNH HIỆN TRƯỜNG · TRƯỚC XỬ LÝ
          </Text>
          {before[0] ? (
            <EvidenceImageFrame
              imageUri={before[0].uri}
              fallbackUri={before[0].fallback}
              style={{ width: "100%", aspectRatio: 4 / 3 }}
              overlay={
                <View
                  style={{ position: "absolute", bottom: 8, left: 8, right: 8 }}
                >
                  <OfficerBadge
                    label={
                      before[0].at
                        ? `CHỤP: ${officerDate(before[0].at)}`
                        : "MINH CHỨNG NGƯỜI DÂN"
                    }
                  />
                </View>
              }
            />
          ) : (
            <OfficerCard>
              <Text style={{ color: colors.textMuted }}>
                Chưa có ảnh hiện trường.
              </Text>
            </OfficerCard>
          )}
          {before.length > 1 && (
            <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
              {before.slice(1).map((image, i) => (
                <EvidenceImageFrame
                  key={`${i}-${image.uri}`}
                  imageUri={image.uri}
                  fallbackUri={image.fallback}
                  style={{ width: 90, aspectRatio: 3 / 4 }}
                  accessibilityLabel={`Ảnh trước xử lý ${i + 2}`}
                />
              ))}
            </ScrollView>
          )}
        </View>
        <OfficerCard>
          <View style={[s.row, { flexWrap: "wrap" }]}>
            <OfficerBadge label={state.label} color={state.color} />
            <OfficerBadge
              label={getSeverityLabel(getAlertDisplaySeverity(alert))}
              color={colors.warning}
            />
          </View>
          <Text style={[s.title, { color: colors.text }]}>{alert.title}</Text>
          <Text style={[s.body, { color: colors.textSecondary }]}>
            {alert.address || "Đã ghi nhận vị trí GPS"}
          </Text>
          <Text style={[s.meta, { color: colors.cyan }]}>
            Phân công: {officerDate(alert.assignedAt)}
          </Text>
          <Text style={[s.body, { color: colors.textSecondary }]}>
            {alert.description}
          </Text>
          <Text style={[s.meta, { color: colors.textMuted }]}>
            Ghi nhận: {officerDate(alert.createdAt)}
          </Text>
        </OfficerCard>
        <View style={{ gap: 8 }}>
          <OverallAiAnalysisCard alert={alert} appearance="civic" />
          {alert.visionEvidence?.length ? (
            <Text style={[s.meta, { color: colors.cyan }]}>
              {Array.from(
                new Set(
                  alert.visionEvidence.flatMap((e) =>
                    (e.detections ?? []).map((d) =>
                      getWasteDetectionLabel(d.materialClass),
                    ),
                  ),
                ),
              ).join(", ") || "Chưa có vật liệu được nhận diện."}
            </Text>
          ) : null}
          <Text style={[s.meta, { color: colors.textMuted }]}>
            AI chỉ hỗ trợ; cán bộ xác nhận phương án xử lý thực tế.
          </Text>
        </View>
        <OfficerCard>
          <Text style={[s.technical, { color: colors.cyan }]}>
            ĐỊNH VỊ & DI CHUYỂN
          </Text>
          <Text style={[s.body, { color: colors.text }]}>
            {alert.address || "Đã ghi nhận vị trí GPS"}
          </Text>
          {coordinates ? (
            <MapView
              provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
              userInterfaceStyle={isDark ? "dark" : "light"}
              style={{ height: 180, borderRadius: 12 }}
              initialRegion={{
                ...coordinates,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker
                coordinate={coordinates}
                title={alert.title}
                pinColor="#F87171"
              />
            </MapView>
          ) : (
            <Text style={{ color: colors.textMuted }}>
              Tọa độ không khả dụng.
            </Text>
          )}
          <View style={s.row}>
            <View style={s.grow}>
              <Button
                appearance="civic"
                size="sm"
                variant="outline"
                title="BẢN ĐỒ TÁC NGHIỆP"
                disabled={!coordinates}
                onPress={() =>
                  navigation.navigate("OfficerTabs", {
                    screen: "OfficerMapTab",
                    params: { selectedId: alert._id },
                  })
                }
              />
            </View>
            <View style={s.grow}>
              <Button
                appearance="civic"
                size="sm"
                variant="ghost"
                title="GOOGLE MAPS"
                onPress={() => void directions()}
                loading={openingMaps}
                disabled={!coordinates}
              />
            </View>
          </View>
        </OfficerCard>
        <OfficerTimeline task={alert} />
        {alert.checkIn?.verified && (
          <OfficerBadge
            label={`ĐÃ XÁC NHẬN · ${Math.round(alert.checkIn.distanceFromIncidentMeters)}m · GPS ±${Math.round(alert.checkIn.accuracyMeters)}m`}
          />
        )}
        <OfficerCard>
          <Text style={[s.heading, { color: colors.text }]}>
            Ghi chú cán bộ
          </Text>
          {alert.officerNote && (
            <Text style={[s.body, { color: colors.textSecondary }]}>
              {alert.officerNote}
            </Text>
          )}
          {!readOnly && (
            <>
              <Input
                label="Ghi chú nghiệp vụ (không bắt buộc)"
                multiline
                value={note}
                onChangeText={setNote}
                maxLength={2000}
              />
              <Button
                appearance="civic"
                variant="outline"
                title="Thêm ghi chú"
                onPress={() => void saveNote()}
                disabled={!note.trim()}
                loading={addNote.isPending}
              />
            </>
          )}
        </OfficerCard>
        {alert.resolutionEvidence?.length ? (
          <OfficerCard>
            <Text style={[s.heading, { color: colors.primary }]}>
              SAU XỬ LÝ
            </Text>
            {alert.resolutionEvidence.map((e, i) => (
              <View key={e._id || `${i}-${e.url}`} style={{ gap: 6 }}>
                <EvidenceImageFrame
                  imageUri={e.url}
                  accessibilityLabel={`Ảnh sau xử lý ${i + 1}`}
                />
                {e.capturedAt && (
                  <Text style={[s.meta, { color: colors.textMuted }]}>
                    Chụp: {officerDate(e.capturedAt)}
                  </Text>
                )}
                {typeof e.distanceFromIncidentMeters === "number" && (
                  <Text style={[s.meta, { color: colors.cyan }]}>
                    Cách điểm rác {Math.round(e.distanceFromIncidentMeters)}m
                    {typeof e.accuracyMeters === "number"
                      ? ` · GPS ±${Math.round(e.accuracyMeters)}m`
                      : ""}
                  </Text>
                )}
              </View>
            ))}
            <Text style={[s.body, { color: colors.text }]}>
              {alert.resolutionSummary}
            </Text>
            <Text style={[s.body, { color: colors.textSecondary }]}>
              {alert.treatmentMethod}
            </Text>
            {alert.materialsUsed && (
              <Text style={[s.body, { color: colors.textSecondary }]}>
                {alert.materialsUsed}
              </Text>
            )}
            {alert.resolutionNotes && (
              <Text style={[s.body, { color: colors.textMuted }]}>
                {alert.resolutionNotes}
              </Text>
            )}
          </OfficerCard>
        ) : null}
        {readOnly && (
          <Text style={[s.body, { color: colors.primary }]}>
            {!wasteTask
              ? "Báo cáo này không thuộc luồng xử lý rác thải."
              : status === "CLOSED"
                ? "ADMIN ĐÃ XÁC NHẬN ĐÓNG BÁO CÁO"
                : "ĐÃ GỬI KẾT QUẢ · Chờ Admin nghiệm thu"}
          </Text>
        )}
      </ScrollView>
      {!readOnly && state.action !== "NONE" && (
        <View
          style={{
            padding: 12,
            paddingBottom: Math.max(12, insets.bottom),
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Button
            appearance="civic"
            title={actionLabel}
            loading={start.isPending}
            onPress={() =>
              state.action === "START"
                ? void startTask()
                : navigation.navigate(
                    state.action === "ARRIVE"
                      ? "OfficerGpsCheckIn"
                      : "OfficerResolution",
                    { id: alert._id },
                  )
            }
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
};
