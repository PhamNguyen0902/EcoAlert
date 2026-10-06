import type { NavigatorScreenParams } from "@react-navigation/native";

export interface LocationSelection {
  latitude: number;
  longitude: number;
  address: string;
}
export type CitizenTabParamList = {
  DashboardTab: undefined;
  MapTab: undefined;
  ReportTab: { selectedLocation?: LocationSelection } | undefined;
  MyReportsTab: undefined;
};
export type ReportFlowParamList = {
  ReportLocation: undefined;
  ReportCamera: undefined;
  ReportPhotoReview: undefined;
  ReportImageValidation: undefined;
  ReportConfirm: undefined;
  ReportSuccess: { alertId?: string; queued?: boolean };
};
export type CitizenStackParamList = {
  CitizenTabs: NavigatorScreenParams<CitizenTabParamList> | undefined;
  ReportFlow: NavigatorScreenParams<ReportFlowParamList> | undefined;
  AlertDetail: { id: string };
  Profile: undefined;
  Notifications: undefined;
  LocationPicker: { initialLocation?: LocationSelection };
};
export type RootStackParamList = {
  AdminApp: undefined;
  OfficerApp: undefined;
  CitizenApp: NavigatorScreenParams<CitizenStackParamList> | undefined;
  CitizenAppGuest: NavigatorScreenParams<CitizenStackParamList> | undefined;
  Login: undefined;
  Register: undefined;
};
