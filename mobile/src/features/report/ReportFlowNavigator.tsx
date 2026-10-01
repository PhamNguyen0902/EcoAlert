import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ReportLocationScreen } from "./screens/ReportLocationScreen";
import { ReportCameraScreen } from "./screens/ReportCameraScreen";
import { ReportPhotoReviewScreen } from "./screens/ReportPhotoReviewScreen";
import { ReportImageValidationScreen } from "./screens/ReportImageValidationScreen";
import { ReportConfirmScreen } from "./screens/ReportConfirmScreen";
import { ReportSuccessScreen } from "./screens/ReportSuccessScreen";
import type { ReportFlowParamList } from "../../navigation/types";
import { FieldReportProvider } from "./FieldReportContext";

const Stack = createNativeStackNavigator<ReportFlowParamList>();

/**
 * Full-screen report state machine. Screens are added incrementally while the
 * old field-capture implementation remains in the repository as a fallback.
 */
export const ReportFlowNavigator = () => (
  <FieldReportProvider>
    <Stack.Navigator initialRouteName="ReportLocation" screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="ReportLocation" component={ReportLocationScreen} />
      <Stack.Screen name="ReportCamera" component={ReportCameraScreen} />
      <Stack.Screen name="ReportPhotoReview" component={ReportPhotoReviewScreen} />
      <Stack.Screen name="ReportImageValidation" component={ReportImageValidationScreen} />
      <Stack.Screen name="ReportConfirm" component={ReportConfirmScreen} />
      <Stack.Screen name="ReportSuccess" component={ReportSuccessScreen} options={{ gestureEnabled: false }} />
    </Stack.Navigator>
  </FieldReportProvider>
);
