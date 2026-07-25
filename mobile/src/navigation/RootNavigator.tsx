import React, { useState, useEffect } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { TabNavigator } from "./TabNavigator";
import { storage } from "../utils/storage";
import { setUnauthorizedCallback } from "../api/client";
import { COLORS } from "../utils/constants";
import { useProfile } from "../hooks/useAuth";

const Stack = createNativeStackNavigator();

export const RootNavigator = () => {
  const [isReady, setIsReady] = useState(false);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const { data: profile, isLoading, isError } = useProfile();

  useEffect(() => {
    const checkAuth = async () => {
      const token = await storage.getToken();
      setHasToken(Boolean(token));
      setIsReady(true);
    };
    checkAuth();

    // Register callback when 401 occurs in Axios client
    setUnauthorizedCallback(() => {
      setHasToken(false);
    });
  }, []);

  // Update hasToken whenever profile query succeeds or fails
  useEffect(() => {
    if (profile) {
      setHasToken(true);
    } else if (isError && !isLoading) {
      setHasToken(false);
    }
  }, [profile, isError, isLoading]);

  if (!isReady || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {hasToken ? (
        <>
          <Stack.Screen name="AppTabs" component={TabNavigator} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="AppTabsGuest" component={TabNavigator} />
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
