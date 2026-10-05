import "react-native-gesture-handler";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { Alert, AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { LanguageProvider } from "./src/context/LanguageContext";
import { SocketProvider } from "./src/context/SocketContext";

// Create TanStack Query client with custom retry and cache policies
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 2, // 2 minutes
      refetchOnWindowFocus: false,
    },
  },
});

import { pushNotificationService } from "./src/services/pushNotificationService";
import { useOfflineSync } from "./src/hooks/useOfflineSync";
import { getPhysicalDeviceApiUrlWarning } from "./src/utils/constants";
import { useProfile } from "./src/hooks/useAuth";
import {
  navigationRef,
  flushPendingNotification,
  openNotificationPayload,
} from "./src/navigation/navigationRef";

const AppContent: React.FC = () => {
  const { isDark, colors } = useTheme();
  const { data: profile } = useProfile();
  useOfflineSync();
  const hasShownApiUrlWarning = React.useRef(false);

  React.useEffect(() => {
    const warning = getPhysicalDeviceApiUrlWarning();
    if (!warning || hasShownApiUrlWarning.current) return;

    hasShownApiUrlWarning.current = true;
    console.warn(`[EcoAlert] ${warning}`);
    Alert.alert("API configuration warning", warning);
  }, []);

  React.useEffect(() => {
    if (profile?._id)
      void pushNotificationService.registerForPushNotifications();
  }, [profile?._id]);

  const clearHandledTap = () => {
    void pushNotificationService
      .clearLastNotificationResponse()
      .catch(() => undefined);
  };
  const flushTap = () => {
    if (flushPendingNotification()) clearHandledTap();
  };

  React.useEffect(() => {
    let active = true;
    const refreshNotifications = () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({
        queryKey: ["notifications-unread-count"],
      });
    };
    const handleTap = (data: Record<string, unknown>, requestId: string) => {
      refreshNotifications();
      if (openNotificationPayload(data, requestId)) clearHandledTap();
    };

    // Listen for notification responses (user tapping on push notification)
    const responseSubscription =
      pushNotificationService.addNotificationResponseListener(handleTap);
    const receivedSubscription =
      pushNotificationService.addNotificationReceivedListener(
        refreshNotifications,
      );
    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") refreshNotifications();
      },
    );
    void pushNotificationService
      .getLastNotificationResponse()
      .then((response) => {
        if (active && response) handleTap(response.data, response.requestId);
      })
      .catch(() => undefined);

    return () => {
      active = false;
      responseSubscription.remove();
      receivedSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  const customNavigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={customNavigationTheme}
      onReady={flushTap}
      onStateChange={flushTap}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <RootNavigator />
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <SocketProvider>
            <SafeAreaProvider>
              <AppContent />
            </SafeAreaProvider>
          </SocketProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
