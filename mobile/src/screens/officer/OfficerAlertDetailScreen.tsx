import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert as RNAlert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import {
  ArrowLeft,
  MapPin,
  ShieldCheck,
  CheckCircle,
  PlayCircle,
  MessageSquare,
  AlertTriangle,
  Navigation,
} from "lucide-react-native";
import {
  useAlert,
  useUpdateAlertStatus,
  useAddOfficerNote,
  useStartHandling,
  useConfirmArrival,
} from "../../hooks/useAlerts";
import { ResolutionModal } from "../../components/modals/ResolutionModal";
import { GlassCard } from "../../components/ui/GlassCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { VisionAnalysisCard } from "../../components/ai/VisionAnalysisCard";
import { useTheme } from "../../context/ThemeContext";
import { SEVERITY_COLORS } from "../../utils/constants";
import { getGeoJsonMapCoordinates, openGoogleMaps } from "../../utils/maps";

export const OfficerAlertDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const alertId = route.params?.id;
  const { data: alert, isLoading, error } = useAlert(alertId);

  const updateStatusMutation = useUpdateAlertStatus();
  const addNoteMutation = useAddOfficerNote();
  const startHandlingMutation = useStartHandling();
  const confirmArrivalMutation = useConfirmArrival();

  const [note, setNote] = useState("");
  const [isResolutionModalOpen, setResolutionModalOpen] = useState(false);
  const [isOpeningMaps, setIsOpeningMaps] = useState(false);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.secondary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Đang tải thông tin xác minh cho cán bộ...</Text>
      </View>
    );
  }

  if (error || !alert) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <AlertTriangle size={48} color={colors.destructive} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Không tìm thấy báo cáo</Text>
        <Text style={[styles.errorSub, { color: colors.textMuted }]}>
          Sự cố này chưa được phân công cho tài khoản của bạn hoặc không còn khả dụng.
        </Text>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: isDark ? "rgba(59, 130, 246, 0.25)" : colors.primaryLight }]} onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtnText, { color: isDark ? "#60A5FA" : colors.primaryDark }]}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const incidentCoordinates = getGeoJsonMapCoordinates(alert.location?.coordinates);

  const sevColor = SEVERITY_COLORS[alert.severity ?? "low"] || { bg: "#F1F5F9", text: "#475569" };
  const currentStatus = alert.status?.toUpperCase();

  const handleStartHandling = async () => {
    try {
      await startHandlingMutation.mutateAsync(alert._id);
      RNAlert.alert("Thành công", "Đã chuyển trạng thái sự cố sang Đang xử lý.");
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Không thể bắt đầu xử lý.";
      RNAlert.alert("Lỗi", msg);
    }
  };

  const handleConfirmArrival = async () => {
    if (!incidentCoordinates) {
      RNAlert.alert("Thiếu vị trí", "Không có tọa độ vị trí sự cố.");
      return;
    }

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        RNAlert.alert("Cần quyền vị trí", "Hãy cho phép vị trí khi dùng ứng dụng để thực hiện check-in tại hiện trường.");
        return;
      }
      const freshLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      await confirmArrivalMutation.mutateAsync({
        id: alert._id,
        location: {
          latitude: freshLocation.coords.latitude,
          longitude: freshLocation.coords.longitude,
          accuracyMeters: freshLocation.coords.accuracy ?? Number.MAX_SAFE_INTEGER,
        },
      });
      RNAlert.alert("Thành công", "Đã ghi nhận thời điểm cán bộ tới hiện trường.");
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Không thể xác nhận tới hiện trường.";
      RNAlert.alert("Lỗi", msg);
    }
  };

  const handleOpenGoogleMaps = async () => {
    if (!incidentCoordinates) {
      RNAlert.alert("Thiếu vị trí", "Không có tọa độ vị trí sự cố.");
      return;
    }

    setIsOpeningMaps(true);
    try {
      const result = await openGoogleMaps(
        incidentCoordinates.latitude,
        incidentCoordinates.longitude,
        "navigate",
      );

      if (!result.success) {
        RNAlert.alert(
          "Không thể mở Google Maps",
          "Không thể mở ứng dụng chỉ đường. Vui lòng thử lại sau.",
        );
      }
    } finally {
      setIsOpeningMaps(false);
    }
  };

  const handleAddNote = async () => {
    if (!note.trim()) {
      RNAlert.alert("Thông báo", "Vui lòng nhập nội dung ghi chú nghiệp vụ trước khi lưu.");
      return;
    }

    try {
      await addNoteMutation.mutateAsync({ id: alert._id, note: note.trim() });
      RNAlert.alert("Thành công", "Đã lưu ghi chú cán bộ.");
      setNote("");
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Không thể lưu ghi chú.";
      RNAlert.alert("Lỗi", msg);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Navigation */}
      <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={[styles.circleBtn, { backgroundColor: colors.background }]} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.text }]}>Nhiệm vụ & Xác minh Cán bộ</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Category & Status */}
        <View style={styles.badgesRow}>
          <Badge
            label={alert.category?.toUpperCase().replace("_", " ") || "CHUNG"}
            type="custom"
            bgColor={isDark ? "rgba(255,255,255,0.1)" : "#F1F5F9"}
            textColor={isDark ? colors.text : "#334155"}
          />
          <View style={[styles.sevBadge, { backgroundColor: sevColor.bg }]}>
            <Text style={[styles.sevBadgeText, { color: sevColor.text }]}>
              MỨC ĐỘ {alert.severity?.toUpperCase()}
            </Text>
          </View>
          <Badge label={alert.status || "PENDING"} type="status" />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>{alert.title}</Text>

        {/* Workflow Quick Action Buttons */}
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Hành động Xử lý Sự cố</Text>
        <View style={styles.workflowGrid}>
          {currentStatus === "ASSIGNED" ? (
            <Button
              title="Bước 1: Bắt đầu xử lý"
              onPress={handleStartHandling}
              loading={startHandlingMutation.isPending}
              style={styles.workflowBtn}
              icon={<PlayCircle size={18} color="#FFF" style={{ marginRight: 6 }} />}
            />
          ) : null}

          {currentStatus === "IN_PROGRESS" ? (
            alert.arrivedAt ? (
              <View style={[styles.arrivedBadge, { backgroundColor: isDark ? "rgba(22,163,74,0.25)" : "#DCFCE7", borderColor: isDark ? "rgba(22,163,74,0.4)" : "#86EFAC" }]}>
                <CheckCircle size={16} color={isDark ? "#86EFAC" : "#16A34A"} />
                <Text style={[styles.arrivedBadgeText, { color: isDark ? "#86EFAC" : "#15803D" }]}>Đã đến hiện trường</Text>
              </View>
            ) : (
              <Button
                title="Bước 2: Xác nhận đã đến hiện trường"
                onPress={handleConfirmArrival}
                loading={confirmArrivalMutation.isPending}
                variant="outline"
                style={styles.workflowBtn}
                icon={<Navigation size={18} color={isDark ? "#60A5FA" : colors.secondary} style={{ marginRight: 6 }} />}
              />
            )
          ) : null}

          {currentStatus === "IN_PROGRESS" && alert.checkIn?.verified ? (
            <Button
              title="Bước 3: Đánh dấu Đã hoàn thành"
              onPress={() => setResolutionModalOpen(true)}
              style={[styles.workflowBtn, { backgroundColor: "#16A34A" }]}
              icon={<CheckCircle size={18} color="#FFF" style={{ marginRight: 6 }} />}
            />
          ) : null}
        </View>

        {/* Officer Note Input */}
        <GlassCard style={styles.noteFormCard}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Ghi chú kiểm tra / Nghiệp vụ Cán bộ</Text>
          <Input
            placeholder="Nhập kết quả xác minh, phương án hoặc ghi chú kiểm tra..."
            multiline
            numberOfLines={3}
            style={styles.textArea}
            value={note}
            onChangeText={setNote}
          />
          <Button
            title="Lưu ghi chú Cán bộ"
            onPress={handleAddNote}
            loading={addNoteMutation.isPending}
            variant="outline"
            style={{ marginTop: 8 }}
            icon={<MessageSquare size={16} color={colors.secondary} style={{ marginRight: 6 }} />}
          />
        </GlassCard>

        {/* Incident Details Card */}
        <GlassCard style={styles.mainCard}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Mô tả từ Người dân</Text>
          <Text style={[styles.descriptionText, { color: colors.text }]}>{alert.description}</Text>
        </GlassCard>

        <VisionAnalysisCard alert={alert} />

        {/* Evidence Photos */}
        {alert.mediaUrls && alert.mediaUrls.length > 0 ? (
          <View style={styles.sectionBox}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>Hình ảnh & Minh chứng</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
              {alert.mediaUrls.map((url, idx) => (
                <Image key={idx} source={{ uri: url }} style={styles.evidenceImage} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Map View */}
        <View style={styles.sectionBox}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Vị trí Sự cố (Bản đồ)</Text>
          <Card style={styles.mapCard}>
            {incidentCoordinates ? (
              <MapView
                style={styles.map}
                initialRegion={{
                  ...incidentCoordinates,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                <Marker
                  coordinate={incidentCoordinates}
                  title={alert.title}
                  description={alert.address}
                />
              </MapView>
            ) : (
              <View style={[styles.mapUnavailable, { backgroundColor: colors.background }]}>
                <MapPin size={30} color={colors.textMuted} />
                <Text style={[styles.mapUnavailableText, { color: colors.textMuted }]}>
                  Incident location is unavailable.
                </Text>
              </View>
            )}
            <View style={[styles.addressBox, { backgroundColor: colors.surface }]}>
              <MapPin size={16} color={colors.secondary} />
              <View style={styles.locationCopy}>
                <Text style={[styles.locationLabel, { color: colors.textMuted }]}>Address</Text>
                <Text style={[styles.addressText, { color: colors.text }]} numberOfLines={3}>
                  {alert.address || "Address unavailable"}
                </Text>
              </View>
            </View>
            <View style={[styles.coordinatesBox, { borderTopColor: colors.border }]}>
              <Text style={[styles.locationLabel, { color: colors.textMuted }]}>Coordinates</Text>
              <Text style={[styles.coordinatesText, { color: colors.text }]}>
                {incidentCoordinates
                  ? `${incidentCoordinates.latitude.toFixed(6)}, ${incidentCoordinates.longitude.toFixed(6)}`
                  : "Unavailable"}
              </Text>
            </View>
            <Button
              title="Navigate with Google Maps"
              onPress={handleOpenGoogleMaps}
              loading={isOpeningMaps}
              disabled={!incidentCoordinates}
              style={styles.navigationButton}
              icon={<Navigation size={18} color="#FFF" style={styles.navigationIcon} />}
              accessibilityHint="Opens driving directions to this incident without changing its workflow status"
            />
            {!incidentCoordinates ? (
              <Text style={[styles.locationUnavailableText, { color: colors.textMuted }]}>
                Incident location is unavailable.
              </Text>
            ) : null}
          </Card>
        </View>

        {/* Response log history */}
        {alert.officerNote ? (
          <GlassCard style={[styles.savedNoteCard, { backgroundColor: isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE" }]}>
            <View style={styles.savedNoteHeader}>
              <ShieldCheck size={18} color={isDark ? "#38BDF8" : colors.secondary} />
              <Text style={[styles.savedNoteTitle, { color: isDark ? "#38BDF8" : colors.secondary }]}>Logged Officer Note</Text>
            </View>
            <Text style={[styles.savedNoteText, { color: colors.text }]}>{alert.officerNote}</Text>
          </GlassCard>
        ) : null}
      </ScrollView>

      <ResolutionModal
        visible={isResolutionModalOpen}
        alertId={alert._id}
        onClose={() => setResolutionModalOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorTitle: { fontSize: 20, fontWeight: "800", marginTop: 16 },
  errorSub: { fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 18 },
  backBtn: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  backBtnText: { fontSize: 14, fontWeight: "700" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  circleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  topBarTitle: { fontSize: 17, fontWeight: "700" },
  scrollContent: { padding: 20, paddingBottom: 50 },
  badgesRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  sevBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 16, lineHeight: 28 },
  sectionHeading: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  workflowGrid: { gap: 10, marginBottom: 20 },
  workflowBtn: { borderRadius: 14 },
  arrivedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  arrivedBadgeText: { fontSize: 13, fontWeight: "700" },
  noteFormCard: { padding: 18, marginBottom: 20, borderRadius: 20 },
  textArea: {},
  mainCard: { padding: 18, marginBottom: 20, borderRadius: 20 },
  descriptionText: { fontSize: 14, lineHeight: 22 },
  sectionBox: { marginBottom: 20 },
  evidenceImage: { width: 140, height: 100, borderRadius: 14, marginRight: 10 },
  mapCard: { padding: 0, overflow: "hidden", marginTop: 4 },
  map: { width: "100%", height: 180 },
  mapUnavailable: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  mapUnavailableText: { fontSize: 13, fontWeight: "600" },
  addressBox: { flexDirection: "row", alignItems: "center", padding: 12, gap: 8 },
  locationCopy: { flex: 1, gap: 3 },
  locationLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  addressText: { fontSize: 13, fontWeight: "500", lineHeight: 18 },
  coordinatesBox: { marginHorizontal: 12, paddingVertical: 12, borderTopWidth: 1, gap: 3 },
  coordinatesText: { fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
  navigationButton: { marginHorizontal: 12, marginBottom: 12 },
  navigationIcon: { marginRight: 8 },
  locationUnavailableText: {
    marginHorizontal: 12,
    marginTop: -4,
    marginBottom: 12,
    fontSize: 12,
    textAlign: "center",
  },
  savedNoteCard: { padding: 16, marginBottom: 20, borderRadius: 18 },
  savedNoteHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  savedNoteTitle: { fontSize: 14, fontWeight: "700" },
  savedNoteText: { fontSize: 13, lineHeight: 20 },
});

