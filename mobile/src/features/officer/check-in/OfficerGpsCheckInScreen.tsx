import React, { useRef, useState } from "react";
import {
  AppState,
  Linking,
  Platform,
  ScrollView,
  Text,
  View,
  Alert as RNAlert,
} from "react-native";
import { usePreventRemove } from "@react-navigation/native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MapPin, ShieldCheck } from "lucide-react-native";
import { useAlert, useConfirmArrival } from "../../../hooks/useAlerts";
import { useProfile } from "../../auth/hooks/useAuth";
import { useOfficerPosition } from "../../../hooks/useOfficerPosition";
import { useCivicTheme } from "../../../theme/useCivicTheme";
import {
  OfficerHeader,
  OfficerBadge,
  OfficerCard,
  officerStyles as s,
} from "../../../components/officer/OfficerUI";
import { Button } from "../../../components/ui/Button";
import { getGeoJsonMapCoordinates } from "../../../utils/maps";
import {
  officerDate,
  officerDistance,
  ownsOfficerTask,
} from "../../../utils/officerPresentation";
import {
  isWasteOfficerTask,
  officerErrorMessage,
} from "../../../utils/officerWorkflow";
import type { OfficerStackParamList } from "../../../navigation/types";
export function OfficerGpsCheckInScreen({
  route,
  navigation,
}: NativeStackScreenProps<OfficerStackParamList, "OfficerGpsCheckIn">) {
  const { colors, isDark } = useCivicTheme();
  const insets = useSafeAreaInsets();
  const task = useAlert(route.params.id);
  const { data: profile } = useProfile();
  const gps = useOfficerPosition();
  const arrival = useConfirmArrival();
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  usePreventRemove(arrival.isPending, () =>
    RNAlert.alert(
      "Đang xác nhận GPS",
      "Vui lòng chờ server xác nhận hiện trường.",
    ),
  );
  const mine = ownsOfficerTask(task.data, profile);
  const allowed = Boolean(
    mine &&
    task.data &&
    isWasteOfficerTask(task.data) &&
    task.data.status.toUpperCase() === "IN_PROGRESS",
  );
  const verified = allowed && task.data?.checkIn?.verified === true;
  const destination = mine
    ? getGeoJsonMapCoordinates(task.data?.location?.coordinates)
    : null;
  const distance =
    gps.position && destination
      ? officerDistance(gps.position, destination)
      : null;
  const confirm = async () => {
    if (!allowed || verified || error || lock.current) return;
    lock.current = true;
    setError(null);
    try {
      // Always reacquire at confirmation; the preview fix alone never authorizes check-in.
      const fresh = await gps.refresh();
      if (!fresh || AppState.currentState !== "active") return;
      await arrival.mutateAsync({
        id: route.params.id,
        location: {
          latitude: fresh.latitude,
          longitude: fresh.longitude,
          accuracyMeters: fresh.accuracyMeters,
        },
      });
    } catch (failure) {
      setError(
        officerErrorMessage(
          failure,
          "Không thể xác nhận hiện trường. Kiểm tra GPS/kết nối rồi thử lại.",
        ),
      );
    } finally {
      lock.current = false;
    }
  };
  return (
    <View
      style={[
        s.screen,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <OfficerHeader
        title="Điểm danh GPS"
        back={navigation.goBack}
        disabled={arrival.isPending}
      />
      <ScrollView contentContainerStyle={s.content}>
        <OfficerBadge
          label="BƯỚC 03 / 06 · XÁC MINH HIỆN TRƯỜNG"
          color={colors.cyan}
        />
        <Text style={[s.body, { color: colors.textSecondary }]}>
          Xác minh vị trí thực tế của cán bộ trước khi thực hiện dọn dẹp và xử
          lý rác thải.
        </Text>
        {destination ? (
          <View style={{ borderRadius: 18, overflow: "hidden" }}>
            <MapView
              key={task.data?._id}
              provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
              userInterfaceStyle={isDark ? "dark" : "light"}
              style={{ height: 280, width: "100%" }}
              initialRegion={{
                ...destination,
                latitudeDelta: 0.004,
                longitudeDelta: 0.004,
              }}
            >
              <Marker
                coordinate={destination}
                title="Vị trí sự cố"
                pinColor="#F87171"
              />
              {gps.position && (
                <>
                  <Marker
                    coordinate={gps.position}
                    title="Vị trí GPS vừa lấy"
                    pinColor="#22C55E"
                  />
                  <Circle
                    center={gps.position}
                    radius={gps.position.accuracyMeters}
                    strokeColor="#38BDF8"
                    fillColor="rgba(56,189,248,0.12)"
                  />
                </>
              )}
            </MapView>
            <View
              style={{ position: "absolute", bottom: 12, left: 12, right: 12 }}
            >
              <OfficerBadge
                label={
                  gps.position
                    ? `SAI SỐ GPS ±${Math.round(gps.position.accuracyMeters)}m`
                    : "CHƯA LẤY GPS THIẾT BỊ"
                }
                color={colors.cyan}
              />
            </View>
          </View>
        ) : (
          <OfficerCard>
            <Text style={{ color: colors.textMuted }}>
              {task.isLoading
                ? "Đang tải nhiệm vụ..."
                : "Không có nhiệm vụ/vị trí được phân công hợp lệ."}
            </Text>
          </OfficerCard>
        )}
        <OfficerCard accent={verified}>
          <View style={s.row}>
            {verified ? (
              <ShieldCheck size={24} color={colors.primary} />
            ) : (
              <MapPin size={24} color={colors.cyan} />
            )}
            <Text
              accessibilityLiveRegion="polite"
              style={[
                s.heading,
                s.grow,
                { color: verified ? colors.primary : colors.text },
              ]}
            >
              {verified
                ? "BẠN ĐÃ ĐẾN ĐÚNG HIỆN TRƯỜNG"
                : gps.pending
                  ? "Đang lấy GPS mới..."
                  : "Xác minh vị trí hiện trường"}
            </Text>
          </View>
          <Text style={[s.body, { color: colors.textSecondary }]}>
            {mine
              ? task.data?.address || "Đã ghi nhận vị trí sự cố"
              : "Nhiệm vụ phải được phân công cho bạn."}
          </Text>
          {gps.position && (
            <>
              <Text style={[s.meta, { color: colors.cyan }]}>
                {gps.position.latitude.toFixed(6)}° N,{" "}
                {gps.position.longitude.toFixed(6)}° E
              </Text>
              <Text style={[s.body, { color: colors.text }]}>
                Sai số GPS: ±{Math.round(gps.position.accuracyMeters)}m
              </Text>
              <Text style={[s.body, { color: colors.text }]}>
                Khoảng cách thẳng đến sự cố:{" "}
                {distance === null
                  ? "Không khả dụng"
                  : `${Math.round(distance)}m`}
              </Text>
              <Text style={[s.meta, { color: colors.textMuted }]}>
                Lấy GPS: {officerDate(gps.position.recordedAt)}
              </Text>
            </>
          )}
          {verified && (
            <Text style={[s.meta, { color: colors.primary }]}>
              Server xác nhận: {officerDate(task.data?.checkIn?.checkedInAt)}
            </Text>
          )}
          <Button
            appearance="civic"
            variant="outline"
            title="LẤY LẠI GPS"
            loading={gps.pending}
            disabled={!allowed || arrival.isPending}
            onPress={async () => {
              if (await gps.refresh()) setError(null);
            }}
          />
        </OfficerCard>
        <OfficerCard>
          <Text style={[s.body, { color: colors.textMuted }]}>
            Đứng gần điểm rác, bật vị trí chính xác và giữ điện thoại ở nơi
            thoáng. Server kiểm tra bán kính và độ chính xác theo cấu hình thực
            tế. Vòng tròn trên map là sai số GPS, không phải phạm vi check-in.
          </Text>
        </OfficerCard>
        {(error || gps.error) && (
          <Text
            accessibilityRole="alert"
            style={[s.body, { color: colors.danger }]}
          >
            {error || gps.error}
          </Text>
        )}
        {gps.error && (
          <Button
            appearance="civic"
            variant="ghost"
            title="MỞ CÀI ĐẶT VỊ TRÍ"
            onPress={() => void Linking.openSettings()}
          />
        )}
      </ScrollView>
      <View
        style={{
          padding: 16,
          paddingBottom: Math.max(16, insets.bottom),
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Button
          appearance="civic"
          title={
            verified
              ? "TIẾP TỤC GHI NHẬN KẾT QUẢ"
              : "XÁC NHẬN ĐÃ ĐẾN HIỆN TRƯỜNG"
          }
          disabled={
            !allowed ||
            gps.pending ||
            arrival.isPending ||
            Boolean(error && !verified)
          }
          loading={gps.pending || arrival.isPending}
          onPress={() =>
            verified
              ? navigation.replace("OfficerResolution", { id: route.params.id })
              : void confirm()
          }
        />
      </View>
    </View>
  );
}
