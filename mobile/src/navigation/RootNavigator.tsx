import React, { useState, useEffect } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { LoginScreen, RegisterScreen } from "../screens";
import { CitizenTabNavigator } from "./CitizenTabNavigator";
import { OfficerTabNavigator } from "./OfficerTabNavigator";
import { AdminTabNavigator } from "./AdminTabNavigator";
import { storage } from "../utils/storage";
import { setUnauthorizedCallback } from "../api/client";
import { COLORS } from "../utils/constants";
import { useProfile } from "../hooks/useAuth";
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
      queryClient.setQueryData(["profile"], null);
      queryClient.clear();
      storage.clearAll();
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
          // tab của admin
          <Stack.Screen name="AdminApp" component={AdminTabNavigator} />
        ) : role === "OFFICER" ? (
          // tab của officer
          <Stack.Screen name="OfficerApp" component={OfficerTabNavigator} />
        ) : (
          //tab của người dân
          <Stack.Screen name="CitizenApp" component={CitizenTabNavigator} />
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
