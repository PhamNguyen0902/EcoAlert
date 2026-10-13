import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ReportLocationScreen } from "./screens/ReportLocationScreen";
import { ReportCameraScreen } from "./screens/ReportCameraScreen";
import { ReportPhotoReviewScreen } from "./screens/ReportPhotoReviewScreen";
import { ReportImageValidationScreen } from "./screens/ReportImageValidationScreen";
import { ReportConfirmScreen } from "./screens/ReportConfirmScreen";
import { ReportSuccessScreen } from "./screens/ReportSuccessScreen";
import type { ReportFlowParamList } from "../../app/navigation/types";
import { FieldReportProvider } from "./FieldReportContext";

const Stack = createNativeStackNavigator<ReportFlowParamList>();

// luồng điều hướng báo cáo toàn màn hình dành cho người dân
export const ReportFlowNavigator = () => (
  <FieldReportProvider>
    <Stack.Navigator
      initialRouteName="ReportLocation"
      screenOptions={{
        headerShown: false,
        animation: "fade",
        animationDuration: 200,
      }}
    >
      <Stack.Screen name="ReportLocation" component={ReportLocationScreen} />
      <Stack.Screen name="ReportCamera" component={ReportCameraScreen} />
      <Stack.Screen
        name="ReportPhotoReview"
        component={ReportPhotoReviewScreen}
      />
      <Stack.Screen
        name="ReportImageValidation"
        component={ReportImageValidationScreen}
      />
      <Stack.Screen name="ReportConfirm" component={ReportConfirmScreen} />
      <Stack.Screen
        name="ReportSuccess"
        component={ReportSuccessScreen}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  </FieldReportProvider>
);
