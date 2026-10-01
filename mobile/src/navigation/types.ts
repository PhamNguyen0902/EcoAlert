import type { NavigatorScreenParams } from '@react-navigation/native';

export interface LocationSelection { latitude: number; longitude: number; address: string; }
export type CitizenTabParamList = { DashboardTab: undefined; ReportTab: { selectedLocation?: LocationSelection } | undefined; MyReportsTab: undefined; ProfileTab: undefined; };
export type ReportFlowParamList = {
  ReportLocation: undefined;
  ReportCamera: undefined;
  ReportPhotoReview: undefined;
  ReportImageValidation: undefined;
  ReportConfirm: undefined;
  ReportSuccess: { alertId: string };
};
export type CitizenStackParamList = { CitizenTabs: NavigatorScreenParams<CitizenTabParamList> | undefined; ReportFlow: NavigatorScreenParams<ReportFlowParamList> | undefined; AlertDetail: { id: string }; LocationPicker: { initialLocation?: LocationSelection }; };
export type RootStackParamList = { AdminApp: undefined; OfficerApp: undefined; CitizenApp: undefined; CitizenAppGuest: undefined; Login: undefined; Register: undefined; };
