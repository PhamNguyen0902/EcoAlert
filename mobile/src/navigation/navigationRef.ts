import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "./types";
import { NotificationTapQueue } from "../utils/notificationNavigation";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
const taps = new NotificationTapQueue();

export const flushPendingNotification = () =>
  taps.flush(
    navigationRef.isReady(),
    navigationRef.isReady()
      ? (navigationRef.getRootState()?.routeNames ?? [])
      : [],
    ({ alertId, app }) => {
      if (app === "OfficerApp" && alertId) {
        navigationRef.navigate("OfficerApp", {
          screen: "OfficerAlertDetail",
          params: { id: alertId },
          initial: false,
        });
        return;
      }
      if (app === "AdminApp" && alertId) {
        navigationRef.navigate("AdminApp", {
          screen: "AlertDetail",
          params: { id: alertId },
          initial: false,
        });
        return;
      }
      if (alertId)
        navigationRef.navigate("CitizenApp", {
          screen: "AlertDetail",
          params: { id: alertId },
          initial: false,
        });
      else
        navigationRef.navigate("CitizenApp", {
          screen: "Notifications",
          initial: false,
        });
    },
  );
export const openNotificationPayload = (
  payload: unknown,
  requestId: string,
) => {
  taps.enqueue(payload, requestId);
  return flushPendingNotification();
};
