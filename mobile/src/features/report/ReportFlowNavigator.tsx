import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { FieldCaptureReportScreen } from "../../screens/citizen/FieldCaptureReportScreen";
import type { ReportFlowParamList } from "../../navigation/types";
import { FieldReportProvider } from "./FieldReportContext";

const Stack = createNativeStackNavigator<ReportFlowParamList>();

/**
 * Full-screen report flow. ReportLocation temporarily hosts the existing
 * production field-capture UI until each state-machine screen is migrated.
 */
export const ReportFlowNavigator = () => (
  <FieldReportProvider>
    <Stack.Navigator initialRouteName="ReportLocation" screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="ReportLocation" component={FieldCaptureReportScreen} />
    </Stack.Navigator>
  </FieldReportProvider>
);
