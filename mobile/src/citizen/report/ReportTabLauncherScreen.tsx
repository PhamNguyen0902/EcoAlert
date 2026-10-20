import React, { useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {
  CitizenStackParamList,
  CitizenTabParamList,
} from "../../app/navigation/types";
import { useTheme } from "../../shared/context/ThemeContext";

type Props = BottomTabScreenProps<CitizenTabParamList, "ReportTab">;

// mở luồng báo cáo toàn màn hình và giữ tab trang chủ được chọn ở phía sau
export const ReportTabLauncherScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const launchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (launchTimer.current !== null) clearTimeout(launchTimer.current);
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      const rootNavigation =
        navigation.getParent<
          NativeStackNavigationProp<CitizenStackParamList>
        >();
      navigation.navigate("DashboardTab");
      if (!rootNavigation || launchTimer.current !== null) return;
      launchTimer.current = setTimeout(() => {
        launchTimer.current = null;
        const state = rootNavigation.getState();
        if (state.routes[state.index]?.name !== "ReportFlow")
          rootNavigation.navigate("ReportFlow");
      }, 0);
    }, [navigation]),
  );
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
