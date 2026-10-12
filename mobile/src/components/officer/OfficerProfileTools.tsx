import React, { useEffect, useRef, useState } from "react";
import { Alert, Linking, Pressable, Switch, Text, View } from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Bell, Crosshair, Moon, ShieldCheck } from "lucide-react-native";
import {
  useOfficerTasks,
  useCurrentShift,
  useStartShift,
  useEndShift,
} from "../../hooks/useAlerts";
import { useOfficerPosition } from "../../hooks/useOfficerPosition";
import { useForegroundScreen } from "../../hooks/useForegroundScreen";
import { useCivicTheme } from "../../theme/useCivicTheme";
import {
  filterOfficerTasks,
  officerErrorMessage,
} from "../../utils/officerWorkflow";
import { officerDate } from "../../utils/officerPresentation";
import { Button } from "../ui/Button";
import { OfficerCard, OfficerMetric, officerStyles as s } from "./OfficerUI";
import appConfig from "../../../app.json";
export function OfficerProfileTools() {
  const { colors, isDark, setThemeMode } = useCivicTheme();
  const query = useOfficerTasks(1, 100, undefined, { allPages: true });
  const shift = useCurrentShift();
  const start = useStartShift();
  const end = useEndShift();
  const gps = useOfficerPosition();
  const lock = useRef(false);
  const active = useForegroundScreen();
  const [permissions, setPermissions] = useState({
    gps: "Chưa kiểm tra",
    notifications: "Chưa kiểm tra",
  });
  useEffect(() => {
    let alive = true;
    if (active)
      void Promise.all([
        Location.getForegroundPermissionsAsync(),
        Notifications.getPermissionsAsync(),
      ])
        .then(([location, notifications]) => {
          if (alive)
            setPermissions({
              gps: location.granted
                ? "Đã cấp quyền khi dùng ứng dụng"
                : "Chưa cấp quyền",
              notifications: notifications.granted
                ? "Đã cấp quyền"
                : "Chưa cấp quyền",
            });
        })
        .catch(() => {
          if (alive)
            setPermissions({
              gps: "Không đọc được quyền",
              notifications: "Không đọc được quyền",
            });
        });
    return () => {
      alive = false;
    };
  }, [active]);
  const tasks = filterOfficerTasks(query.data?.items || [], "ALL");
  const toggleShift = async () => {
    if (lock.current || shift.isError || shift.isLoading) return;
    lock.current = true;
    try {
      const fresh = await gps.refresh();
      if (fresh)
        await (shift.data?.status === "ACTIVE" ? end : start).mutateAsync({
          latitude: fresh.latitude,
          longitude: fresh.longitude,
          accuracyMeters: fresh.accuracyMeters,
        });
    } catch (error) {
      Alert.alert(
        "Chưa cập nhật được ca trực",
        officerErrorMessage(error, "Vui lòng kiểm tra GPS và thử lại."),
      );
    } finally {
      lock.current = false;
    }
  };
  return (
    <View style={{ gap: 16 }}>
      <View style={s.row}>
        {(
          [
            ["ALL", "Tổng nhiệm vụ", colors.cyan],
            ["ACTIVE", "Đang xử lý", colors.warning],
            ["COMPLETED", "Đã xử lý / đóng", colors.primary],
          ] as const
        ).map(([key, label, tone]) => (
          <OfficerMetric
            key={key}
            label={label}
            tone={tone}
            value={query.data ? filterOfficerTasks(tasks, key).length : "—"}
          />
        ))}
      </View>
      {query.isError && (
        <Text style={[s.meta, { color: colors.warning }]}>
          Chưa tải được thống kê nhiệm vụ.
        </Text>
      )}
      <OfficerCard>
        <View style={s.row}>
          <ShieldCheck size={18} color={colors.primary} />
          <Text style={[s.heading, { color: colors.text }]}>
            Ca trực thực tế
          </Text>
        </View>
        <Text style={[s.body, { color: colors.textMuted }]}>
          {shift.isLoading
            ? "Đang tải ca trực..."
            : shift.isError
              ? "Chưa tải được ca trực."
              : shift.data?.status === "ACTIVE"
                ? `Đang trong ca · ${officerDate(shift.data.startedAt)}`
                : "Hiện không có ca trực đang hoạt động."}
        </Text>
        {shift.isError ? (
          <Button
            appearance="civic"
            variant="outline"
            title="THỬ LẠI"
            onPress={() => void shift.refetch()}
          />
        ) : (
          <Button
            appearance="civic"
            variant="outline"
            title={
              shift.data?.status === "ACTIVE"
                ? "KẾT THÚC CA TRỰC"
                : "BẮT ĐẦU CA TRỰC"
            }
            disabled={
              shift.isLoading || gps.pending || start.isPending || end.isPending
            }
            loading={gps.pending || start.isPending || end.isPending}
            onPress={() =>
              shift.data?.status === "ACTIVE"
                ? Alert.alert(
                    "Kết thúc ca trực?",
                    "GPS hiện tại sẽ được ghi nhận khi kết thúc ca.",
                    [
                      { text: "Hủy", style: "cancel" },
                      {
                        text: "Kết thúc ca",
                        onPress: () => void toggleShift(),
                      },
                    ],
                  )
                : void toggleShift()
            }
          />
        )}
        {gps.error && (
          <Text
            accessibilityRole="alert"
            style={[s.meta, { color: colors.danger }]}
          >
            {gps.error}
          </Text>
        )}
      </OfficerCard>
      <OfficerCard>
        <Text style={[s.technical, { color: colors.cyan }]}>
          TÁC NGHIỆP & QUYỀN ỨNG DỤNG
        </Text>
        {[
          {
            icon: Crosshair,
            title: "Định vị GPS hiện trường",
            detail: permissions.gps,
          },
          {
            icon: Bell,
            title: "Thông báo nhiệm vụ",
            detail: permissions.notifications,
          },
        ].map(({ icon: Icon, title, detail }) => (
          <Pressable
            key={title}
            accessibilityRole="button"
            accessibilityLabel={`${title}. ${detail}. Mở cài đặt ứng dụng`}
            onPress={() => void Linking.openSettings()}
            style={[s.row, { minHeight: 52 }]}
          >
            <Icon size={20} color={colors.cyan} />
            <View style={s.grow}>
              <Text style={[s.body, { color: colors.text }]}>{title}</Text>
              <Text style={[s.meta, { color: colors.textMuted }]}>
                {detail}
              </Text>
            </View>
            <Text style={{ color: colors.cyan }}>›</Text>
          </Pressable>
        ))}
        <View style={s.row}>
          <Moon size={20} color={colors.cyan} />
          <Text style={[s.body, s.grow, { color: colors.text }]}>
            Giao diện tối
          </Text>
          <Switch
            accessibilityLabel="Giao diện tối"
            value={isDark}
            onValueChange={(value) => {
              void setThemeMode(value ? "dark" : "light").catch(() =>
                Alert.alert("Chưa lưu được giao diện", "Vui lòng thử lại."),
              );
            }}
            trackColor={{ true: colors.primary }}
          />
        </View>
        <Text style={[s.meta, { color: colors.textMuted }]}>
          GPS chỉ được lấy khi thao tác; không tự theo dõi nền. Quyền thông báo
          phụ thuộc hệ điều hành và bản dựng ứng dụng.
        </Text>
        <Text style={[s.meta, { color: colors.textMuted }]}>
          EcoAlert Mobile · Phiên bản {appConfig.expo.version}
        </Text>
      </OfficerCard>
    </View>
  );
}
