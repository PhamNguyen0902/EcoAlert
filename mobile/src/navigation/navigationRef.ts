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
    ({ alertId }) => {
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
