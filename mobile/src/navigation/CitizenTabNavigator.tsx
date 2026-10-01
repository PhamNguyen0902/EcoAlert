import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FileText, LayoutDashboard, PlusCircle, UserCircle2 } from 'lucide-react-native';
import { CitizenDashboardScreen } from '../screens/citizen/CitizenDashboardScreen';
import { FieldCaptureReportScreen } from '../screens/citizen/FieldCaptureReportScreen';
import { MyReportsScreen } from '../screens/citizen/MyReportsScreen';
import { CitizenProfileScreen } from '../screens/citizen/CitizenProfileScreen';
import { AlertDetailScreen } from '../screens/citizen/AlertDetailScreen';
import { LocationPickerScreen } from '../screens/LocationPickerScreen';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import type { CitizenStackParamList, CitizenTabParamList } from './types';

const Tab = createBottomTabNavigator<CitizenTabParamList>();
const Stack = createNativeStackNavigator<CitizenStackParamList>();

const CitizenTabs = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ color, size }) =>
          route.name === 'DashboardTab' ? (
            <LayoutDashboard color={color} size={size} />
          ) : route.name === 'ReportTab' ? (
            <PlusCircle color={color} size={size + 4} />
          ) : route.name === 'ProfileTab' ? (
            <UserCircle2 color={color} size={size} />
          ) : (
            <FileText color={color} size={size} />
          ),
      })}
    >
      <Tab.Screen
        name="DashboardTab"
        component={CitizenDashboardScreen}
        options={{ tabBarLabel: t('tabs.home') }}
      />
      <Tab.Screen
        name="ReportTab"
        component={FieldCaptureReportScreen}
        options={{ tabBarLabel: t('tabs.reportIncident') }}
      />
      <Tab.Screen
        name="MyReportsTab"
        component={MyReportsScreen}
        options={{ tabBarLabel: t('tabs.myReports', 'My Reports') }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={CitizenProfileScreen}
        options={{ tabBarLabel: t('tabs.profile', 'Cá nhân') }}
      />
    </Tab.Navigator>
  );
};

export const CitizenTabNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CitizenTabs" component={CitizenTabs} />
    <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
    {/* Kept for legacy/admin-compatible navigation. Field reporting no longer exposes manual relocation. */}
    <Stack.Screen name="LocationPicker" component={LocationPickerScreen} />
  </Stack.Navigator>
);
