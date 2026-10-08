import type { ResolutionInput, ShiftLocationInput } from "../types";

export interface OfficerPhoto {
  originalLocalUri: string;
  capturedAt: string;
  location: ShiftLocationInput;
}
/** Capture adapter is shared by the native screen and deterministic tests. */
export async function acquireOfficerGps(deps: {
  permission: () => Promise<boolean>;
  position: () => Promise<{
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
  }>;
}): Promise<ShiftLocationInput> {
  if (!(await deps.permission()))
    throw new Error("Cần quyền GPS để chụp minh chứng sau xử lý.");
  const gps = await deps.position();
  if (
    !Number.isFinite(gps.latitude) ||
    Math.abs(gps.latitude) > 90 ||
    !Number.isFinite(gps.longitude) ||
    Math.abs(gps.longitude) > 180 ||
    gps.accuracyMeters === null ||
    !Number.isFinite(gps.accuracyMeters) ||
    gps.accuracyMeters < 0
  )
    throw new Error(
      "GPS chưa xác định được vị trí hoặc độ chính xác. Vui lòng thử lại.",
    );
  return { ...gps, accuracyMeters: gps.accuracyMeters };
}
export const WASTE_TREATMENTS = [
  "Thu gom và vận chuyển rác",
  "Phân loại và đóng bao",
  "Thu gom rác cồng kềnh",
  "Thu gom xà bần / phế thải xây dựng",
  "Cô lập rác nguy hại và bàn giao xử lý",
  "Vệ sinh khu vực sau thu gom",
] as const;
export const WASTE_MATERIALS = [
  "Bao tải / túi thu gom",
  "Xe gom rác",
  "Xe tải / xe chuyên dụng",
  "Dụng cụ vệ sinh",
  "Thiết bị bảo hộ",
  "Dụng cụ thu gom rác nguy hại",
] as const;

export interface ResolutionDraft {
  photo?: OfficerPhoto;
  verifiedArrival: boolean;
  resolutionSummary: string;
  treatmentMethod: string;
  materialsUsed?: string;
  additionalNotes?: string;
}
export function validateOfficerResolution(
  draft: ResolutionDraft,
): string | null {
  if (!draft.verifiedArrival)
    return "Cần xác nhận đã đến hiện trường trước khi hoàn thành xử lý.";
  if (!draft.photo) return "Vui lòng chụp ít nhất một ảnh sau xử lý.";
  if (!draft.resolutionSummary.trim()) return "Vui lòng nhập tóm tắt xử lý.";
  if (!draft.treatmentMethod.trim())
    return "Vui lòng chọn hoặc nhập phương pháp xử lý.";
  const gps = draft.photo.location;
  if (
    !gps ||
    !Number.isFinite(gps.latitude) ||
    Math.abs(gps.latitude) > 90 ||
    !Number.isFinite(gps.longitude) ||
    Math.abs(gps.longitude) > 180 ||
    !Number.isFinite(gps.accuracyMeters) ||
    gps.accuracyMeters < 0
  )
    return "Ảnh cần có GPS hợp lệ. Vui lòng chụp lại.";
  if (!Number.isFinite(Date.parse(draft.photo.capturedAt)))
    return "Thời điểm chụp không hợp lệ. Vui lòng chụp lại.";
  return null;
}

/** One submit at a time; preserve a successful upload for retrying a failed resolution. */
export function createOfficerResolutionSubmitter(deps: {
  upload: (uri: string) => Promise<string>;
  resolve: (data: ResolutionInput) => Promise<unknown>;
}) {
  let busy = false;
  let completed = false;
  let uploaded: { uri: string; url: string } | undefined;
  return async (draft: ResolutionDraft) => {
    if (busy || completed) return false;
    const error = validateOfficerResolution(draft);
    if (error) throw new Error(error);
    const photo = draft.photo!;
    busy = true;
    try {
      if (uploaded?.uri !== photo.originalLocalUri) {
        const url = await deps.upload(photo.originalLocalUri);
        if (!/^https?:\/\//i.test(url))
          throw new Error("Không thể tải ảnh lên. Vui lòng thử lại.");
        uploaded = { uri: photo.originalLocalUri, url };
      }
      await deps.resolve({
        resolutionSummary: draft.resolutionSummary.trim(),
        treatmentMethod: draft.treatmentMethod.trim(),
        materialsUsed: draft.materialsUsed?.trim() || undefined,
        additionalNotes: draft.additionalNotes?.trim() || undefined,
        evidence: [
          {
            url: uploaded.url,
            capturedAt: photo.capturedAt,
            location: photo.location,
          },
        ],
      });
      completed = true;
      return true;
    } finally {
      busy = false;
    }
  };
}
