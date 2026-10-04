import React, { useCallback } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { CitizenStackParamList, CitizenTabParamList } from "../../navigation/types";
import { useTheme } from "../../context/ThemeContext";

type Props = BottomTabScreenProps<CitizenTabParamList, "ReportTab">;

/** Opens the full-screen flow while keeping Dashboard selected behind it. */
export const ReportTabLauncherScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();

  useFocusEffect(useCallback(() => {
    const rootNavigation = navigation.getParent<NativeStackNavigationProp<CitizenStackParamList>>();
    navigation.navigate("DashboardTab");
    setTimeout(() => rootNavigation?.navigate("ReportFlow"), 0);
  }, [navigation]));

  return <View style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
};

const styles = StyleSheet.create({ container: { flex: 1, alignItems: "center", justifyContent: "center" } });
