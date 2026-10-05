import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "../api/client";
import { getNotificationAlertId } from "../utils/notificationNavigation";

// Configure how notifications are handled when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const pushNotificationService = {
  /**
   * Request notification permissions and register device Push Token with backend
   */
  registerForPushNotifications: async (): Promise<string | null> => {
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "EcoAlert Alerts",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#22C55E",
        });
      }

      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log(
          "[PushNotifications] Permission not granted for notifications.",
        );
        return null;
      }

      // Get Expo Push Token safely
      let token: string | null = null;
      try {
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        token = tokenData.data;
        console.log("[PushNotifications] Device Expo Push Token:", token);
      } catch {
        console.warn(
          "[PushNotifications] Expo Push Token not active in standard Expo Go without EAS projectId. Remote push notifications require a Development Build (eas build).",
        );
        return null;
      }

      // Save token to backend user profile
      if (token) {
        try {
          await api.patch("/v1/users/profile", { pushToken: token });
          console.log(
            "[PushNotifications] Push token registered with backend successfully.",
          );
        } catch (apiErr) {
          console.warn(
            "[PushNotifications] Failed to save push token to backend:",
            apiErr,
          );
        }
      }

      return token;
    } catch (error) {
      console.warn("[PushNotifications] Note on push notifications:", error);
      return null;
    }
  },

  /**
   * Add listener for notification responses (user taps notification)
   */
  addNotificationResponseListener: (
    onNotificationTap: (
      data: Record<string, unknown>,
      requestId: string,
    ) => void,
  ) => {
    return Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log("[PushNotifications] User tapped notification:", data);
      if (
        response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
      ) {
        onNotificationTap(data ?? {}, response.notification.request.identifier);
      }
    });
  },

  getLastNotificationResponse: async () => {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (
      !response ||
      response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER
    )
      return null;
    return {
      data: response.notification.request.content.data ?? {},
      requestId: response.notification.request.identifier,
    };
  },
  clearLastNotificationResponse: () =>
    Notifications.clearLastNotificationResponseAsync(),

  /**
   * Add listener for incoming notifications while app is in foreground
   */
  addNotificationReceivedListener: (
    onNotificationReceived: (notification: Notifications.Notification) => void,
  ) => {
    return Notifications.addNotificationReceivedListener((notification) => {
      console.log(
        "[PushNotifications] Notification received in foreground:",
        notification,
      );
      onNotificationReceived(notification);
    });
  },

  /**
   * Schedule a local push notification immediately to test device notification popups
   */
  sendLocalTestNotification: async (
    title?: string,
    body?: string,
    alertId?: string,
  ): Promise<string> => {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: title || "Cập nhật báo cáo EcoAlert",
        body: body || "Báo cáo điểm rác của bạn đã được tiếp nhận.",
        data: getNotificationAlertId({ alertId }) ? { alertId } : {},
        sound: true,
      },
      trigger: null,
    });
  },
};
