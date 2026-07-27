import type { NavigatorScreenParams } from "@react-navigation/native";

export interface LocationSelection {
  latitude: number;
  longitude: number;
  address: string;
}

export type AppTabParamList = {
  DashboardTab: undefined;
  ReportTab: { selectedLocation?: LocationSelection } | undefined;
  ProfileTab: undefined;
};

export type RootStackParamList = {
  AdminApp: undefined;
  OfficerApp: undefined;
  CitizenApp: undefined;
  CitizenAppGuest: undefined;
  AppTabs: NavigatorScreenParams<AppTabParamList> | undefined;
  AppTabsGuest: NavigatorScreenParams<AppTabParamList> | undefined;
  Login: undefined;
  Register: undefined;
  LocationPicker: { initialLocation?: LocationSelection };
  AlertDetail: { id: string };
};
