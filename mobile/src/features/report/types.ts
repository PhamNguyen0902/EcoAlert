import type { Alert, AlertCategory, ImageValidation, Severity } from "../../types";

export const MAX_FIELD_GPS_ACCURACY_METERS = 50;

export interface FieldReportLocationDraft {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  address: string;
  capturedAt: string;
  source: "DEVICE_GPS";
}

export interface FieldReportCaptureDraft {
  originalLocalUri: string;
  displayLocalUri?: string;
  originalUploadedUrl?: string;
  displayUploadedUrl?: string;
  capturedAt: string;
  width?: number;
  height?: number;
}

export interface WasteDetectionDraft {
  label: string;
  count?: number;
  confidence?: number;
  bbox?: [number, number, number, number];
}

export type ImageValidationState = "IDLE" | "PROCESSING" | "VALID" | "INVALID" | "UNAVAILABLE";

export interface FieldReportImageValidationDraft {
  state: ImageValidationState;
  isWasteRelated?: boolean;
  detectedObjects: WasteDetectionDraft[];
  suggestedCategory?: AlertCategory | null;
  severity?: Severity | null;
  summary?: string | null;
  reason?: string | null;
  backendValidation?: ImageValidation;
}

export interface FieldReportDraft {
  location?: FieldReportLocationDraft;
  capture?: FieldReportCaptureDraft;
  imageValidation: FieldReportImageValidationDraft;
  title: string;
  description: string;
  createdAlert?: Alert;
}

export const createEmptyFieldReportDraft = (): FieldReportDraft => ({
  imageValidation: { state: "IDLE", detectedObjects: [] },
  title: "",
  description: "",
});
