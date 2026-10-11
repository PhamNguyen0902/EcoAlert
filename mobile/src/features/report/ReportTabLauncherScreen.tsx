import React, { useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {
  CitizenStackParamList,
  CitizenTabParamList,
} from "../../navigation/types";
import { useTheme } from "../../context/ThemeContext";

type Props = BottomTabScreenProps<CitizenTabParamList, "ReportTab">;

/** Opens the full-screen flow while keeping Dashboard selected behind it. */
export const ReportTabLauncherScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const launchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tab navigation compatibility only: retain one deferred launch across rapid focuses.
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
