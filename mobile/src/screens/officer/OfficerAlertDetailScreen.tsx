import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert as RNAlert,
  Platform,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import {
  useAlert,
  useAddOfficerNote,
  useStartHandling,
  useConfirmArrival,
} from "../../hooks/useAlerts";
import { EvidenceImageFrame } from "../../components/media/EvidenceImageFrame";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { OverallAiAnalysisCard } from "../../components/ai/OverallAiAnalysisCard";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { civicStyles, civicType } from "../../theme/civicDesign";
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
  const { colors } = useCivicTheme();
  const query = useAlert(route.params.id);
  const start = useStartHandling();
  const arrival = useConfirmArrival();
  const addNote = useAddOfficerNote();
  const [note, setNote] = useState("");
  const [gettingGps, setGettingGps] = useState(false);
  const [openingMaps, setOpeningMaps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const actionLock = useRef(false);
  const noteLock = useRef(false);
  const alert = query.data;
  const startTask = async () => {
    if (!alert || actionLock.current) return;
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
  const confirmArrival = async () => {
    if (!alert || actionLock.current) return;
    actionLock.current = true;
    setGettingGps(true);
    setGpsError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setGpsError(
          "Cần quyền vị trí để xác nhận hiện trường. Hãy cho phép GPS trong cài đặt.",
        );
        return;
      }
      const gps = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      if (gps.coords.accuracy === null) {
        setGpsError(
          "GPS chưa xác định được độ chính xác. Vui lòng thử lại ở nơi thoáng hơn.",
        );
        return;
      }
      await arrival.mutateAsync({
        id: alert._id,
        location: {
          latitude: gps.coords.latitude,
          longitude: gps.coords.longitude,
          accuracyMeters: gps.coords.accuracy,
        },
      });
      RNAlert.alert(
        "Đã xác nhận hiện trường",
        "Bạn có thể chụp ảnh sau xử lý và gửi kết quả.",
      );
    } catch (error: unknown) {
      setGpsError(
        officerErrorMessage(
          error,
          "Không thể lấy GPS hoặc xác nhận hiện trường. Vui lòng thử lại.",
        ),
      );
    } finally {
      setGettingGps(false);
      actionLock.current = false;
    }
  };
  const directions = async () => {
    const coordinates = getGeoJsonMapCoordinates(alert?.location?.coordinates);
    if (!coordinates || openingMaps) return;
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
    } catch {
      RNAlert.alert("Không thể mở chỉ đường", "Vui lòng thử lại.");
    } finally {
      setOpeningMaps(false);
    }
  };
  const saveNote = async () => {
    if (!alert || !note.trim() || noteLock.current) return;
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
  if (query.isLoading)
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.cyan} />
        <Text style={{ color: colors.textMuted }}>Đang tải nhiệm vụ...</Text>
      </View>
    );
  if (!alert || query.isError)
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[civicType.body, { color: colors.text }]}>
          Nhiệm vụ không khả dụng hoặc chưa được phân công cho bạn.
        </Text>
        <Button
          appearance="civic"
          title="Thử lại"
          onPress={() => void query.refetch()}
        />
        <Button
          appearance="civic"
          variant="outline"
          title="Quay lại"
          onPress={navigation.goBack}
        />
      </View>
    );
  const state = getOfficerTaskState(alert);
  const status = officerStatus(alert);
  const wasteTask = isWasteOfficerTask(alert);
  const readOnly = status === "RESOLVED" || status === "CLOSED" || !wasteTask;
  const coordinates = getGeoJsonMapCoordinates(alert.location?.coordinates);
  const before = alert.fieldEvidence?.length
    ? alert.fieldEvidence.map((e) => ({
        uri: e.displayUrl || e.originalUrl,
        fallback: e.originalUrl,
      }))
    : (alert.mediaUrls || []).map((uri) => ({ uri, fallback: uri }));
  const progress = [
    { label: "Được phân công", at: alert.assignedAt },
    { label: "Bắt đầu xử lý", at: alert.startedAt },
    {
      label: "Đã đến hiện trường",
      at: alert.checkIn?.verified ? alert.checkIn.checkedInAt : undefined,
    },
    { label: "Đã hoàn thành", at: alert.resolvedAt },
    { label: "Admin đã đóng", at: alert.closedAt },
  ];
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <View style={styles.header}>
        <Button
          appearance="civic"
          variant="ghost"
          size="sm"
          title="‹ Quay lại"
          onPress={navigation.goBack}
        />
        <Text style={[civicType.section, { color: colors.text }]}>
          Chi tiết nhiệm vụ
        </Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          civicStyles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text style={[civicType.title, { color: colors.text }]}>
          {alert.title}
        </Text>
        <View style={styles.row}>
          <Text style={[civicType.eyebrow, { color: state.color }]}>
            {state.label}
          </Text>
          <Text style={[civicType.meta, { color: colors.warning }]}>
            {getSeverityLabel(getAlertDisplaySeverity(alert))}
          </Text>
        </View>
        <Card appearance="civic" style={styles.card}>
          <Text style={[civicType.section, { color: colors.text }]}>
            ẢNH HIỆN TRƯỜNG · TRƯỚC XỬ LÝ
          </Text>
          {before.map((image, i) => (
            <EvidenceImageFrame
              key={`${i}-${image.uri}`}
              imageUri={image.uri}
              fallbackUri={image.fallback}
              accessibilityLabel={`Ảnh trước xử lý ${i + 1}`}
            />
          ))}
          {!before.length ? (
            <Text style={{ color: colors.textMuted }}>
              Chưa có ảnh hiện trường.
            </Text>
          ) : null}
        </Card>
        <Card appearance="civic" style={styles.card}>
          <Text style={[civicType.section, { color: colors.text }]}>
            Thông tin điểm rác
          </Text>
          <Text style={[civicType.body, { color: colors.cyan }]}>
            {getCategoryLabel(alert.category)}
          </Text>
          <Text style={[civicType.body, { color: colors.textSecondary }]}>
            {alert.description}
          </Text>
          <Text style={[civicType.meta, { color: colors.textMuted }]}>
            {new Date(alert.createdAt).toLocaleString("vi-VN")}
          </Text>
        </Card>
        <Card appearance="civic" style={styles.card}>
          <Text style={[civicType.section, { color: colors.text }]}>
            Vị trí hiện trường
          </Text>
          <Text style={[civicType.body, { color: colors.text }]}>
            {alert.address || "Đã ghi nhận vị trí GPS"}
          </Text>
          {coordinates ? (
            <MapView
              provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
              style={styles.map}
              initialRegion={{
                ...coordinates,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker coordinate={coordinates} title={alert.title} />
            </MapView>
          ) : (
            <Text style={{ color: colors.textMuted }}>
              Tọa độ không khả dụng.
            </Text>
          )}
          <Button
            appearance="civic"
            variant="outline"
            title="CHỈ ĐƯỜNG ĐẾN HIỆN TRƯỜNG"
            onPress={() => void directions()}
            loading={openingMaps}
            disabled={!coordinates}
          />
        </Card>
        <View style={styles.card}>
          <Text style={[civicType.section, { color: colors.cyan }]}>
            Nhận diện rác · Kết quả nhận diện hỗ trợ
          </Text>
          <OverallAiAnalysisCard alert={alert} appearance="civic" />
          {alert.visionEvidence?.length ? (
            <Text style={[civicType.body, { color: colors.textSecondary }]}>
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
          <Text style={[civicType.meta, { color: colors.textMuted }]}>
            AI chỉ hỗ trợ; cán bộ xác nhận phương án xử lý thực tế.
          </Text>
        </View>
        <Card appearance="civic" style={styles.card}>
          <Text style={[civicType.section, { color: colors.text }]}>
            Tiến trình xử lý
          </Text>
          {progress.map((p) => (
            <View key={p.label} style={styles.card}>
              <Text
                style={[
                  civicType.body,
                  { color: p.at ? colors.cyan : colors.textMuted },
                ]}
              >
                {p.label}
              </Text>
              <Text style={[civicType.meta, { color: colors.textMuted }]}>
                {p.at
                  ? new Date(p.at).toLocaleString("vi-VN")
                  : "Chưa ghi nhận"}
              </Text>
            </View>
          ))}
          {alert.checkIn?.verified ? (
            <Text style={[civicType.body, { color: colors.primary }]}>
              ✓ Đã xác nhận hiện trường ·{" "}
              {Math.round(alert.checkIn.distanceFromIncidentMeters)}m · GPS ±
              {Math.round(alert.checkIn.accuracyMeters)}m
            </Text>
          ) : null}
        </Card>
        {!readOnly ? (
          <Card appearance="civic" style={styles.card}>
            <Text style={[civicType.section, { color: colors.text }]}>
              Thao tác thực địa
            </Text>
            {state.action === "START" ? (
              <Button
                appearance="civic"
                title="BẮT ĐẦU XỬ LÝ"
                onPress={() => void startTask()}
                loading={start.isPending}
              />
            ) : null}
            {state.action === "ARRIVE" ? (
              <>
                {gettingGps ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={{ color: colors.cyan }}
                  >
                    Đang lấy vị trí GPS...
                  </Text>
                ) : null}
                <Button
                  appearance="civic"
                  title={
                    gpsError ? "THỬ LẠI GPS" : "XÁC NHẬN ĐÃ ĐẾN HIỆN TRƯỜNG"
                  }
                  onPress={() => void confirmArrival()}
                  loading={gettingGps || arrival.isPending}
                />
                {gpsError ? (
                  <Text
                    accessibilityRole="alert"
                    style={[civicType.body, { color: colors.danger }]}
                  >
                    {gpsError}
                  </Text>
                ) : null}
                <Button
                  appearance="civic"
                  variant="outline"
                  title="MỞ CHỈ ĐƯỜNG"
                  onPress={() => void directions()}
                  loading={openingMaps}
                  disabled={!coordinates}
                />
              </>
            ) : null}
            {state.action === "RESOLVE" ? (
              <Button
                appearance="civic"
                title="HOÀN THÀNH XỬ LÝ"
                onPress={() =>
                  navigation.navigate("OfficerResolution", { id: alert._id })
                }
              />
            ) : null}
          </Card>
        ) : (
          <Text style={[civicType.section, { color: colors.primary }]}>
            {!wasteTask
              ? "Báo cáo này không thuộc luồng xử lý rác thải."
              : status === "CLOSED"
                ? "ĐÃ ĐÓNG"
                : "ĐÃ HOÀN THÀNH XỬ LÝ · Chờ Admin duyệt"}
          </Text>
        )}
        <Card appearance="civic" style={styles.card}>
          <Text style={[civicType.section, { color: colors.text }]}>
            Ghi chú cán bộ
          </Text>
          {alert.officerNote ? (
            <Text style={[civicType.body, { color: colors.textSecondary }]}>
              {alert.officerNote}
            </Text>
          ) : null}
          {!readOnly ? (
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
          ) : null}
        </Card>
        {alert.resolutionEvidence?.length ? (
          <Card appearance="civic" style={styles.card}>
            <Text style={[civicType.section, { color: colors.primary }]}>
              SAU XỬ LÝ
            </Text>
            {alert.resolutionEvidence.map((e, i) => (
              <View key={e._id || `${i}-${e.url}`} style={styles.card}>
                <EvidenceImageFrame
                  imageUri={e.url}
                  accessibilityLabel={`Ảnh sau xử lý ${i + 1}`}
                />
                {e.capturedAt ? (
                  <Text style={[civicType.meta, { color: colors.textMuted }]}>
                    Chụp: {new Date(e.capturedAt).toLocaleString("vi-VN")}
                  </Text>
                ) : null}
                {typeof e.distanceFromIncidentMeters === "number" ? (
                  <Text style={[civicType.meta, { color: colors.cyan }]}>
                    Cách điểm rác {Math.round(e.distanceFromIncidentMeters)}m
                    {typeof e.accuracyMeters === "number"
                      ? ` · GPS ±${Math.round(e.accuracyMeters)}m`
                      : ""}
                  </Text>
                ) : null}
              </View>
            ))}
            <Text style={[civicType.body, { color: colors.text }]}>
              {alert.resolutionSummary}
            </Text>
            <Text style={[civicType.body, { color: colors.textSecondary }]}>
              {alert.treatmentMethod}
            </Text>
            {alert.materialsUsed ? (
              <Text style={[civicType.body, { color: colors.textSecondary }]}>
                {alert.materialsUsed}
              </Text>
            ) : null}
            {alert.resolutionNotes ? (
              <Text style={[civicType.body, { color: colors.textMuted }]}>
                {alert.resolutionNotes}
              </Text>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
};
const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  card: { gap: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  map: { width: "100%", height: 190, borderRadius: 12 },
});
