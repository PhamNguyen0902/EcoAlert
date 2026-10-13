import React, { useState, useEffect } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { LoginScreen } from "../../auth/screens/LoginScreen";
import { RegisterScreen } from "../../auth/screens/RegisterScreen";
import { CitizenTabNavigator } from "./CitizenTabNavigator";
import { OfficerTabNavigator } from "./OfficerTabNavigator";
import { AdminMobileNoticeScreen } from "../../auth/AdminMobileNoticeScreen";
import { setUnauthorizedCallback } from "../../shared/api/client";
import { COLORS } from "../../shared/utils/constants";
import { clearAuthQueryCache, useProfile } from "../../auth/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const [isReady, setIsReady] = useState(false);
  const { data: profile, isLoading } = useProfile();
  const queryClient = useQueryClient();

  useEffect(() => {
    setIsReady(true);

    // Register callback when 401 occurs in Axios client
    setUnauthorizedCallback(() => {
      // The API interceptor has already cleared secure session storage.
      clearAuthQueryCache(queryClient);
    });
  }, [queryClient]);

  if (!isReady || (isLoading && !profile)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const role = profile?.role?.toUpperCase();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {profile ? (
        role === "ADMIN" ? (
          <Stack.Screen name="AdminNotice" component={AdminMobileNoticeScreen} />
        ) : role === "OFFICER" ? (
          // tab của officer
          <Stack.Screen name="OfficerApp" component={OfficerTabNavigator} />
        ) : role === "CITIZEN" ? (
          //tab của người dân
          <Stack.Screen name="CitizenApp" component={CitizenTabNavigator} />
        ) : (
          <Stack.Screen name="AdminNotice" component={AdminMobileNoticeScreen} />
        )
      ) : (
        <>
          {/* chưa đăng nhập thì ở màn hình đăng nhập hoặc đăng ký */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen
            name="CitizenAppGuest"
            component={CitizenTabNavigator}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
});
