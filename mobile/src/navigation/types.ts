import type { NavigatorScreenParams } from '@react-navigation/native';

export interface LocationSelection { latitude: number; longitude: number; address: string; }
export type CitizenTabParamList = { DashboardTab: undefined; ReportTab: { selectedLocation?: LocationSelection } | undefined; MyReportsTab: undefined; };
export type CitizenStackParamList = { CitizenTabs: NavigatorScreenParams<CitizenTabParamList> | undefined; AlertDetail: { id: string }; LocationPicker: { initialLocation?: LocationSelection }; };
export type RootStackParamList = { AdminApp: undefined; OfficerApp: undefined; CitizenApp: undefined; CitizenAppGuest: undefined; Login: undefined; Register: undefined; };
