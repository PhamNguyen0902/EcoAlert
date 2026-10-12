import React, { useCallback } from "react";
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

// mở luồng báo cáo toàn màn hình và giữ tab trang chủ được chọn ở phía sau
export const ReportTabLauncherScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();

  useFocusEffect(
    useCallback(() => {
      // chuyển hướng về tab trang chủ rồi kích hoạt mở ngăn xếp luồng báo cáo hiện trường
      const rootNavigation =
        navigation.getParent<
          NativeStackNavigationProp<CitizenStackParamList>
        >();
      navigation.navigate("DashboardTab");
      setTimeout(() => rootNavigation?.navigate("ReportFlow"), 0);
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
