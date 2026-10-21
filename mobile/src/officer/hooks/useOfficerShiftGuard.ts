import { useRef } from "react";
import { Alert } from "react-native";
import {
  useCurrentShift,
  useEndShift,
  useStartShift,
} from "../../shared/hooks/useAlerts";
import { useOfficerPosition } from "./useOfficerPosition";
import { officerErrorMessage } from "../utils/officerWorkflow";

export function useOfficerShiftGuard() {
  const shift = useCurrentShift();
  const start = useStartShift();
  const end = useEndShift();
  const gps = useOfficerPosition();
  const lock = useRef(false);

  const isOnShift = shift.data?.status === "ACTIVE";
  const isOperating = gps.pending || start.isPending || end.isPending;

  const startShiftDirectly = async (): Promise<boolean> => {
    if (lock.current || isOperating) return false;
    lock.current = true;
    try {
      const fresh = await gps.refresh();
      if (!fresh) {
        Alert.alert(
          "Không thể xác định vị trí GPS",
          "Vui lòng bật định vị GPS trên thiết bị và cấp quyền truy cập để bắt đầu ca trực.",
        );
        return false;
      }
      await start.mutateAsync({
        latitude: fresh.latitude,
        longitude: fresh.longitude,
        accuracyMeters: fresh.accuracyMeters,
      });
      return true;
    } catch (error) {
      Alert.alert(
        "Chưa bắt đầu được ca trực",
        officerErrorMessage(error, "Vui lòng kiểm tra kết nối GPS và thử lại."),
      );
      return false;
    } finally {
      lock.current = false;
    }
  };

  const endShiftDirectly = async (): Promise<boolean> => {
    if (lock.current || isOperating) return false;
    lock.current = true;
    try {
      const fresh = await gps.refresh();
      if (!fresh) {
        Alert.alert(
          "Không thể xác định vị trí GPS",
          "Vui lòng bật định vị GPS trên thiết bị để ghi nhận vị trí kết thúc ca.",
        );
        return false;
      }
      await end.mutateAsync({
        latitude: fresh.latitude,
        longitude: fresh.longitude,
        accuracyMeters: fresh.accuracyMeters,
      });
      return true;
    } catch (error) {
      Alert.alert(
        "Chưa kết thúc được ca trực",
        officerErrorMessage(error, "Vui lòng thử lại."),
      );
      return false;
    } finally {
      lock.current = false;
    }
  };

  const assertOnShiftWithAlert = (onSuccessProceed?: () => void): boolean => {
    if (isOnShift) {
      onSuccessProceed?.();
      return true;
    }

    Alert.alert(
      "Chưa bắt đầu ca trực",
      "Bạn cần bắt đầu ca trực trước khi thực hiện Check-in hoặc xử lý sự cố tại hiện trường.",
      [
        { text: "Để sau", style: "cancel" },
        {
          text: "Bắt đầu ca trực ngay",
          onPress: async () => {
            const started = await startShiftDirectly();
            if (started) {
              onSuccessProceed?.();
            }
          },
        },
      ],
    );
    return false;
  };

  return {
    shift,
    isOnShift,
    isOperating,
    gps,
    start,
    end,
    startShiftDirectly,
    endShiftDirectly,
    assertOnShiftWithAlert,
  };
}
