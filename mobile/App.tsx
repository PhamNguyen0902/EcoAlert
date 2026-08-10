import "react-native-gesture-handler";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { LanguageProvider } from "./src/context/LanguageContext";
import { SocketProvider } from "./src/context/SocketContext";

// Create TanStack Query client with custom retry and cache policies
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 2, // 2 minutes
      refetchOnWindowFocus: false,
    },
  },
});

import { pushNotificationService } from "./src/services/pushNotificationService";
import { useOfflineSync } from "./src/hooks/useOfflineSync";

const AppContent: React.FC = () => {
  const { isDark, colors } = useTheme();
  useOfflineSync();

  React.useEffect(() => {
    // Register push notifications
    void pushNotificationService.registerForPushNotifications();

    // Listen for notification responses (user tapping on push notification)
    const responseSubscription = pushNotificationService.addNotificationResponseListener(
      (data) => {
        console.log("[App] User clicked notification with payload:", data);
      },
    );

    return () => {
      responseSubscription.remove();
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
    <NavigationContainer theme={customNavigationTheme}>
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
