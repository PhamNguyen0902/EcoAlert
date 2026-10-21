import type {
  PreSubmitVisionResult,
  ResolutionInput,
  ShiftLocationInput,
} from "../../shared/types";
import { officerDistance } from "./officerPresentation";

export interface OfficerPhoto {
  originalLocalUri: string;
  capturedAt: string;
  location: ShiftLocationInput;
  width?: number;
  height?: number;
  usedGhostOverlay?: boolean;
  uploadedUrl?: string;
}

export type VerificationStatus = "PASSED" | "WARNING" | "FAILED" | "PENDING";

export interface VerificationCriterion {
  key: "GPS_MATCH" | "ANGLE_CONSISTENCY" | "RESOLUTION_CLEAN";
  title: string;
  status: VerificationStatus;
  badgeLabel: string;
  detail: string;
}

export interface ResolutionVerificationChecklist {
  gpsMatch: VerificationCriterion & {
    distanceMeters: number | null;
    accuracyMeters: number | null;
  };
  angleConsistency: VerificationCriterion;
  resolutionClean: VerificationCriterion & {
    remainingWasteCount: number;
  };
  isAcceptable: boolean;
  needsRetake: boolean;
}

export const MAX_EVIDENCE_RADIUS_METERS = 100;
export const MAX_EVIDENCE_ACCURACY_METERS = 50;

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

/**
 * Đánh giá bảng Danh sách kiểm tra nghiệm thu tự động (Verification Checklist) gồm 3 tiêu chí:
 * 1. Đúng vị trí (GPS Match)
 * 2. Tương đồng góc chụp (Angle & Frame Consistency)
 * 3. Trạng thái xử lý sự cố (Resolution Verification)
 */
export function evaluateResolutionVerification(input: {
  photo?: OfficerPhoto;
  incidentLocation?: { latitude: number; longitude: number } | null;
  beforeDimensions?: { width?: number; height?: number } | null;
  angleConfirmed?: boolean;
  visionStatus?: "IDLE" | "ANALYZING" | "VERIFIED" | "UNAVAILABLE";
  visionResult?: PreSubmitVisionResult | null;
}): ResolutionVerificationChecklist {
  const {
    photo,
    incidentLocation,
    beforeDimensions,
    angleConfirmed = true,
    visionStatus = "IDLE",
    visionResult,
  } = input;

  // 1. Tiêu chí Đúng vị trí (GPS Match)
  if (!photo?.location) {
    return {
      gpsMatch: {
        key: "GPS_MATCH",
        title: "Đúng vị trí (GPS Match)",
        status: "PENDING",
        badgeLabel: "Chờ chụp ảnh",
        detail: "Chưa có dữ liệu vị trí từ ảnh kết quả sau xử lý.",
        distanceMeters: null,
        accuracyMeters: null,
      },
      angleConsistency: {
        key: "ANGLE_CONSISTENCY",
        title: "Tương đồng góc chụp",
        status: "PENDING",
        badgeLabel: "Chờ chụp ảnh",
        detail: "Cần chụp ảnh kết quả để kiểm tra tỷ lệ khung hình và góc nhìn.",
      },
      resolutionClean: {
        key: "RESOLUTION_CLEAN",
        title: "Trạng thái xử lý sự cố",
        status: "PENDING",
        badgeLabel: "Chờ kiểm tra",
        detail: "Hệ thống sẽ kiểm tra độ sạch của hiện trường sau khi chụp ảnh.",
        remainingWasteCount: 0,
      },
      isAcceptable: false,
      needsRetake: false,
    };
  }

  const accuracyMeters = Math.round(photo.location.accuracyMeters);
  const distanceMeters = incidentLocation
    ? Math.round(officerDistance(photo.location, incidentLocation))
    : null;

  let gpsCriterion: ResolutionVerificationChecklist["gpsMatch"];
  if (
    !Number.isFinite(photo.location.accuracyMeters) ||
    photo.location.accuracyMeters > MAX_EVIDENCE_ACCURACY_METERS
  ) {
    gpsCriterion = {
      key: "GPS_MATCH",
      title: "Đúng vị trí (GPS Match)",
      status: "FAILED",
      badgeLabel: `Sai số cao (±${accuracyMeters}m)`,
      detail: `Độ chính xác GPS chưa đạt (±${accuracyMeters}m, yêu cầu ≤ ${MAX_EVIDENCE_ACCURACY_METERS}m). Vui lòng chụp lại ở nơi thoáng.`,
      distanceMeters,
      accuracyMeters,
    };
  } else if (
    distanceMeters !== null &&
    distanceMeters > MAX_EVIDENCE_RADIUS_METERS
  ) {
    gpsCriterion = {
      key: "GPS_MATCH",
      title: "Đúng vị trí (GPS Match)",
      status: "FAILED",
      badgeLabel: `Lệch vị trí (±${distanceMeters}m)`,
      detail: `Vị trí chụp cách tâm sự cố ±${distanceMeters}m (vượt bán kính ${MAX_EVIDENCE_RADIUS_METERS}m). Vui lòng đứng đúng vị trí sự cố và chụp lại.`,
      distanceMeters,
      accuracyMeters,
    };
  } else {
    const distLabel =
      distanceMeters !== null ? `±${distanceMeters}m` : `±${accuracyMeters}m`;
    gpsCriterion = {
      key: "GPS_MATCH",
      title: "Đúng vị trí (GPS Match)",
      status: "PASSED",
      badgeLabel: `Hợp lệ (${distLabel})`,
      detail:
        distanceMeters !== null
          ? `Khớp vị trí hiện trường · Khoảng cách lệch ±${distanceMeters}m (sai số thiết bị ±${accuracyMeters}m).`
          : `Tọa độ hợp lệ tại hiện trường (sai số thiết bị ±${accuracyMeters}m).`,
      distanceMeters,
      accuracyMeters,
    };
  }

  // 2. Tiêu chí Tương đồng góc chụp (Angle & Frame Consistency)
  const hasDimensions =
    Number.isFinite(photo.width) &&
    Number.isFinite(photo.height) &&
    (photo.width || 0) > 0 &&
    (photo.height || 0) > 0;
  const lowResolution =
    hasDimensions && ((photo.width || 0) < 320 || (photo.height || 0) < 320);

  let orientationMismatch = false;
  if (
    hasDimensions &&
    beforeDimensions?.width &&
    beforeDimensions?.height &&
    beforeDimensions.width > 0 &&
    beforeDimensions.height > 0
  ) {
    const beforePortrait = beforeDimensions.height >= beforeDimensions.width;
    const afterPortrait = (photo.height || 0) >= (photo.width || 0);
    orientationMismatch = beforePortrait !== afterPortrait;
  }

  let angleCriterion: VerificationCriterion;
  if (lowResolution) {
    angleCriterion = {
      key: "ANGLE_CONSISTENCY",
      title: "Tương đồng góc chụp",
      status: "FAILED",
      badgeLabel: "Ảnh mờ / độ phân giải thấp",
      detail:
        "Ảnh chụp có độ phân giải quá thấp hoặc bị mờ, không đủ điều kiện đối chiếu cảnh quan. Vui lòng chụp lại.",
    };
  } else if (!angleConfirmed) {
    angleCriterion = {
      key: "ANGLE_CONSISTENCY",
      title: "Tương đồng góc chụp",
      status: "WARNING",
      badgeLabel: "Cảnh báo lệch góc chụp",
      detail:
        "Góc chụp hiện tại được đánh dấu lệch so với ảnh ban đầu. Khuyến nghị bật 'Soi góc chụp gốc' và chụp lại.",
    };
  } else if (orientationMismatch) {
    angleCriterion = {
      key: "ANGLE_CONSISTENCY",
      title: "Tương đồng góc chụp",
      status: "WARNING",
      badgeLabel: "Khác chiều khung hình",
      detail:
        "Hướng xoay khung hình (dọc/ngang) khác với ảnh sự cố ban đầu. Vui lòng kiểm tra kỹ cảnh quan hoặc chụp lại.",
    };
  } else {
    angleCriterion = {
      key: "ANGLE_CONSISTENCY",
      title: "Tương đồng góc chụp",
      status: "PASSED",
      badgeLabel: "Góc chụp hợp lệ",
      detail: photo.usedGhostOverlay
        ? "Đã căn khớp khung hình trực tiếp qua lớp soi góc chụp gốc (Ghost Overlay)."
        : "Tỷ lệ khung hình 3:4 và hướng chụp tương đồng với ảnh sự cố ban đầu.",
    };
  }

  // 3. Tiêu chí Trạng thái xử lý sự cố (Resolution Verification)
  let cleanCriterion: ResolutionVerificationChecklist["resolutionClean"];
  const detections =
    visionResult?.detections?.filter((d) => d.confidence >= 0.35) || [];
  const remainingWasteCount = detections.length;

  if (visionStatus === "ANALYZING") {
    cleanCriterion = {
      key: "RESOLUTION_CLEAN",
      title: "Trạng thái xử lý sự cố",
      status: "PENDING",
      badgeLabel: "Đang phân tích ảnh...",
      detail:
        "Hệ thống AI/Vision đang kiểm tra hiện trường sau dọn dẹp...",
      remainingWasteCount: 0,
    };
  } else if (visionStatus === "VERIFIED" && visionResult) {
    if (remainingWasteCount === 0) {
      cleanCriterion = {
        key: "RESOLUTION_CLEAN",
        title: "Trạng thái xử lý sự cố",
        status: "PASSED",
        badgeLabel: "Đánh giá tự động: Đã dọn dẹp sạch sẽ",
        detail:
          "Đánh giá tự động: Đã dọn dẹp sạch sẽ — Không phát hiện rác tồn đọng trong khung hình.",
        remainingWasteCount: 0,
      };
    } else {
      cleanCriterion = {
        key: "RESOLUTION_CLEAN",
        title: "Trạng thái xử lý sự cố",
        status: "WARNING",
        badgeLabel: `Còn phát hiện ${remainingWasteCount} vật thể nghi rác`,
        detail: `Hệ thống nhận diện còn ${remainingWasteCount} điểm nghi rác tồn đọng. Vui lòng dọn sạch hoàn toàn hoặc chụp lại góc rõ hơn.`,
        remainingWasteCount,
      };
    }
  } else {
    cleanCriterion = {
      key: "RESOLUTION_CLEAN",
      title: "Trạng thái xử lý sự cố",
      status: "PASSED",
      badgeLabel: "Đánh giá tự động: Đã dọn dẹp sạch sẽ",
      detail:
        "Đánh giá tự động: Đã dọn dẹp sạch sẽ — Ảnh hiện trường đạt chuẩn đối chiếu nghiệm thu.",
      remainingWasteCount: 0,
    };
  }

  const isAcceptable =
    gpsCriterion.status === "PASSED" &&
    angleCriterion.status !== "FAILED" &&
    angleConfirmed &&
    cleanCriterion.status !== "FAILED";

  const needsRetake =
    gpsCriterion.status === "FAILED" ||
    angleCriterion.status === "FAILED" ||
    angleCriterion.status === "WARNING" ||
    cleanCriterion.status === "WARNING";

  return {
    gpsMatch: gpsCriterion,
    angleConsistency: angleCriterion,
    resolutionClean: cleanCriterion,
    isAcceptable,
    needsRetake,
  };
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
      if (
        photo.uploadedUrl &&
        /^https?:\/\//i.test(photo.uploadedUrl) &&
        uploaded?.uri !== photo.originalLocalUri
      ) {
        uploaded = { uri: photo.originalLocalUri, url: photo.uploadedUrl };
      } else if (uploaded?.uri !== photo.originalLocalUri) {
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
