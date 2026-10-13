import React, { useCallback, useRef } from "react";
import {
  Alert,
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useNetInfo } from "@react-native-community/netinfo";
import * as Location from "expo-location";
import { Camera } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  CloudUpload,
  Globe,
  Info,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  Moon,
  Shield,
  UserRound,
  Wifi,
} from "lucide-react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {
  CitizenStackParamList,
  CitizenTabParamList,
  RootStackParamList,
} from "../../navigation/types";
import { useLogout, useProfile } from "../../hooks/useAuth";
import { useUnreadNotificationCount } from "../../hooks/useNotifications";
import { useCivicTheme } from "../../theme/useCivicTheme";
import { civicStyles, civicType } from "../../theme/civicDesign";
import { Card } from "../../shared/components/ui/Card";
import { Button } from "../../components/ui/Button";
import {
  CitizenAvatar,
  CitizenSectionHeading,
  CitizenSettingsRow,
  CitizenTopBar,
} from "../../components/citizen/v2/CitizenUI";
import appConfig from "../../../app.json";
import { offlineQueue } from "../../utils/offlineQueue";

export const CitizenSettingsScreen: React.FC<
  BottomTabScreenProps<CitizenTabParamList, "SettingsTab">
> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, themeMode, setThemeMode } = useCivicTheme();
  const { data: profile } = useProfile();
  const unread = useUnreadNotificationCount();
  const logout = useLogout();
  const confirming = useRef(false);
  const network = useNetInfo();
  // Read-only summary: do not mount another useOfflineSync subscriber or mutate drafts here.
  const deviceInfo = useQuery({
    queryKey: ["citizen-settings-device", profile?._id],
    queryFn: async () => {
      const [gps, camera, drafts] = await Promise.all([
        Location.getForegroundPermissionsAsync(),
        Camera.getCameraPermissionsAsync(),
        profile ? offlineQueue.getOfflineDrafts() : Promise.resolve([]),
      ]);
      return { gps: gps.status, camera: camera.status, drafts: drafts.length };
    },
    staleTime: 30_000,
    retry: false,
  });
  const { refetch: refetchDeviceInfo } = deviceInfo;
  useFocusEffect(
    useCallback(() => {
      void refetchDeviceInfo();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") void refetchDeviceInfo();
      });
      return () => subscription.remove();
    }, [refetchDeviceInfo]),
  );
  const parent = () =>
    navigation.getParent<NativeStackNavigationProp<CitizenStackParamList>>();
  const openProfile = () => parent()?.navigate("Profile");
  const openNotifications = () => parent()?.navigate("Notifications");
  const openLogin = () =>
    parent()
      ?.getParent<NativeStackNavigationProp<RootStackParamList>>()
      ?.navigate("Login");
  const confirmLogout = () => {
    if (confirming.current || logout.isPending) return;
    confirming.current = true;
    const cancel = () => {
      confirming.current = false;
    };
    Alert.alert(
      "Đăng xuất khỏi EcoAlert?",
      "Bạn sẽ cần đăng nhập lại để gửi và theo dõi báo cáo.",
      [
        { text: "Hủy", style: "cancel", onPress: cancel },
        {
          text: "Đăng xuất",
          style: "destructive",
          onPress: () => {
            cancel();
            logout.mutate();
          },
        },
      ],
      { cancelable: true, onDismiss: cancel },
    );
  };
  const changeTheme = () =>
    Alert.alert("Giao diện", "Chọn giao diện ứng dụng", [
      ...(["light", "dark", "system"] as const).map((mode) => ({
        text: `${mode === themeMode ? "✓ " : ""}${{ light: "Sáng", dark: "Tối", system: "Theo thiết bị" }[mode]}`,
        onPress: () => {
          void setThemeMode(mode).catch(() =>
            Alert.alert("Chưa lưu được giao diện", "Vui lòng thử lại."),
          );
        },
      })),
    ]);
  const permissionLabel = (status?: string) =>
    status === "granted"
      ? "Đã cấp quyền"
      : status === "denied"
        ? "Chưa cấp quyền"
        : "Chưa xác định";
  const openPermissions = () => {
    void Linking.openSettings().catch(() =>
      Alert.alert(
        "Không mở được cài đặt",
        "Vui lòng mở Cài đặt thiết bị để kiểm tra quyền GPS và camera.",
      ),
    );
  };
  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <CitizenTopBar
        title="Cài đặt"
        user={profile}
        unreadCount={unread.data ?? 0}
        onProfile={openProfile}
        onNotifications={openNotifications}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card appearance="civic" style={styles.profile}>
          <CitizenAvatar user={profile} size={72} />
          <Text style={[civicType.section, { color: colors.text }]}>
            {profile?.fullName || "Chào bạn, khách EcoAlert"}
          </Text>
          {profile?.phone && (
            <Text style={[civicType.meta, { color: colors.textMuted }]}>
              {profile.phone.replace(/.(?=.{3})/g, "•")}
            </Text>
          )}
          <Text style={[civicType.meta, { color: colors.primary }]}>
            {profile
              ? "Công dân · Tài khoản EcoAlert"
              : "Đăng nhập để quản lý báo cáo"}
          </Text>
          <Button
            appearance="civic"
            variant="secondary"
            title={profile ? "Xem thông tin cá nhân" : "Đăng nhập"}
            onPress={profile ? openProfile : openLogin}
          />
        </Card>
        <View>
          <CitizenSectionHeading title="Tài khoản & định danh" />
          <Card appearance="civic">
            <CitizenSettingsRow
              icon={UserRound}
              title="Thông tin tài khoản"
              detail={profile?.email || "Bạn chưa đăng nhập"}
              onPress={openProfile}
            />
            <CitizenSettingsRow
              icon={Shield}
              title="Trạng thái tài khoản"
              detail={
                profile
                  ? profile.isActive
                    ? "Đang hoạt động"
                    : "Không hoạt động"
                  : "Khách"
              }
            />
            <CitizenSettingsRow
              icon={Lock}
              title="Bảo mật tài khoản"
              detail="Chưa hỗ trợ thay đổi mật khẩu trong ứng dụng."
            />
          </Card>
        </View>
        <View>
          <CitizenSectionHeading title="Dữ liệu & ngoại tuyến" />
          <Card appearance="civic">
            <CitizenSettingsRow
              icon={MapPin}
              title="GPS & camera"
              detail={`GPS: ${permissionLabel(deviceInfo.data?.gps)} · Camera: ${permissionLabel(deviceInfo.data?.camera)}`}
              onPress={openPermissions}
            />
            <CitizenSettingsRow
              icon={Wifi}
              title="Kết nối mạng"
              detail={
                network.isConnected === null
                  ? "Đang kiểm tra"
                  : network.isConnected && network.isInternetReachable !== false
                    ? "Đã kết nối"
                    : "Ngoại tuyến"
              }
            />
            <CitizenSettingsRow
              icon={CloudUpload}
              title="Báo cáo ngoại tuyến trên thiết bị"
              detail={
                !profile
                  ? "Đăng nhập để xem trong Của tôi"
                  : deviceInfo.isError
                    ? "Chưa đọc được trạng thái"
                    : deviceInfo.data
                      ? `${deviceInfo.data.drafts} báo cáo đang chờ gửi · Xem và đồng bộ trong Của tôi`
                      : "Đang kiểm tra…"
              }
              onPress={() => navigation.navigate("MyReportsTab")}
            />
          </Card>
        </View>
        <View>
          <CitizenSectionHeading title="Ứng dụng & thông báo" />
          <Card appearance="civic">
            <CitizenSettingsRow
              icon={Bell}
              title="Trung tâm thông báo"
              detail={
                profile
                  ? `${unread.data ?? 0} thông báo chưa đọc`
                  : "Đăng nhập để xem thông báo"
              }
              onPress={profile ? openNotifications : openLogin}
            />
            <CitizenSettingsRow
              icon={Moon}
              title="Giao diện"
              detail={
                { light: "Sáng", dark: "Tối", system: "Theo thiết bị" }[
                  themeMode
                ]
              }
              onPress={changeTheme}
            />
            <CitizenSettingsRow
              icon={Globe}
              title="Ngôn ngữ"
              detail="Tiếng Việt"
            />
          </Card>
        </View>
        <View>
          <CitizenSectionHeading title="Hỗ trợ & thông tin" />
          <Card appearance="civic">
            <CitizenSettingsRow
              icon={Info}
              title="Hướng dẫn gửi báo cáo"
              detail="GPS hiện trường → chụp ảnh trực tiếp → kiểm tra AI → xác nhận gửi."
            />
            <CitizenSettingsRow
              icon={Info}
              title="Phiên bản EcoAlert"
              detail={appConfig.expo.version}
            />
            <CitizenSettingsRow
              icon={Info}
              title="Chính sách & hỗ trợ"
              detail="Chưa có liên kết hỗ trợ hoặc chính sách được cấu hình trong ứng dụng."
            />
          </Card>
        </View>
        {logout.isError && (
          <Text
            accessibilityRole="alert"
            style={[civicType.body, { color: colors.danger }]}
          >
            Chưa đăng xuất được. Vui lòng thử lại.
          </Text>
        )}
        <Button
          appearance="civic"
          title={profile ? "Đăng xuất tài khoản" : "Đăng nhập"}
          variant={profile ? "destructive" : "primary"}
          onPress={profile ? confirmLogout : openLogin}
          disabled={logout.isPending}
          loading={logout.isPending}
          icon={
            profile ? (
              <LogOut size={18} color="#FFF" />
            ) : (
              <LogIn size={18} color="#07101F" />
            )
          }
        />
      </ScrollView>
    </View>
  );
};
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { ...civicStyles.content, paddingBottom: 40 },
  profile: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 24,
    borderRadius: 24,
  },
});
