import { fieldLocationReady } from "./components/stitch/fieldPresentation";
import {
  MAX_FIELD_GPS_ACCURACY_METERS,
  MAX_FIELD_REPORT_PHOTOS,
  type FieldReportCaptureDraft,
  type FieldReportDraft,
  type FieldReportLocationDraft,
} from "./types";
import { normalizePhotoDraft } from "./photoDraft";

export const CAPTURE_GPS_MAX_AGE_MS = 30_000;
export type CaptureStage =
  | "GPS"
  | "CAMERA"
  | "NORMALIZE"
  | "PERSIST"
  | "DRAFT"
  | "NAVIGATION";
export type CaptureErrorCode =
  | CaptureStage
  | "BUSY"
  | "PERMISSION"
  | "NOT_READY"
  | "BACKGROUND"
  | "LEFT_FLOW"
  | "PHOTO_LIMIT"
  | "GPS_INVALID"
  | "MISSING_URI";

const stageMessages: Record<CaptureStage, string> = {
  GPS: "Chưa lấy được GPS. Hãy thử lấy lại vị trí tại nơi thoáng hơn.",
  CAMERA: "Camera chưa chụp được ảnh. Hãy khởi động lại Camera và thử lại.",
  NORMALIZE: "Không thể xử lý ảnh vừa chụp. Vui lòng thử chụp lại.",
  PERSIST: "Không thể lưu ảnh. Hãy kiểm tra dung lượng điện thoại và thử lại.",
  DRAFT:
    "Ảnh đã được lưu nhưng chưa lưu được bản nháp. Nhấn lưu lại ảnh để tiếp tục.",
  NAVIGATION: "Ảnh đã được lưu. Nhấn xem ảnh đã chụp để tiếp tục.",
};

export class FieldCaptureError extends Error {
  constructor(
    public readonly code: CaptureErrorCode,
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = "FieldCaptureError";
  }
}

interface CaptureCamera {
  takePictureAsync(options: {
    quality: number;
    skipProcessing: boolean;
  }): Promise<{ uri: string } | undefined>;
}
export interface CaptureSnapshot {
  active: boolean;
  focused: boolean;
  granted: boolean;
  ready: boolean;
  camera: CaptureCamera | null;
  location?: FieldReportLocationDraft;
  draft: FieldReportDraft;
}
interface CaptureDependencies {
  lock: { current: boolean };
  getSnapshot: () => CaptureSnapshot;
  refreshLocation: () => Promise<FieldReportLocationDraft | null>;
  normalizeImage: (
    uri: string,
  ) => Promise<{ uri: string; width: number; height: number }>;
  persistImage: (uri: string, capturedAt: string) => Promise<string>;
  savePhoto: (photo: FieldReportCaptureDraft, draftId: string) => Promise<void>;
  navigateToReview: () => void;
  onBusy: (busy: boolean) => void;
  onStage: (stage: CaptureStage) => void;
  onPreparedPhoto: (photo: FieldReportCaptureDraft) => void;
  preparedPhoto?: FieldReportCaptureDraft | null;
  now?: () => number;
  timeoutMs?: number;
  /**
   * Instant Shutter & Background GPS:
   * When enabled, triggers `camera.takePictureAsync()` immediately using the best
   * currently cached/available GPS fix, transitions to Review without blocking on GPS,
   * and invokes `onBackgroundGpsSync` in the background to refine location.
   */
  allowCachedLocationOnShutter?: boolean;
  onBackgroundGpsSync?: (photoId: string, draftId: string) => void;
}

async function runStage<T>(
  stage: CaptureStage,
  operation: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${stage}_TIMEOUT`)),
          timeoutMs,
        );
      }),
    ]);
  } catch (error) {
    if (error instanceof FieldCaptureError) throw error;
    throw new FieldCaptureError(stage, stageMessages[stage], error);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function captureGpsReady(
  location: FieldReportLocationDraft | null | undefined,
  now: number,
): boolean {
  return (
    fieldLocationReady(location || undefined, now) &&
    now - Date.parse(location!.capturedAt) <= CAPTURE_GPS_MAX_AGE_MS
  );
}

/** Native operations can outlive a screen. Read the current session again after each await. */
export async function captureFieldPhoto(
  deps: CaptureDependencies,
): Promise<"REVIEW" | "SAVED"> {
  if (deps.lock.current)
    throw new FieldCaptureError(
      "BUSY",
      "Đang xử lý ảnh. Vui lòng chờ trong giây lát.",
    );
  const now = deps.now || Date.now;
  const draftId = deps.getSnapshot().draft.id;
  const current = () => {
    const snapshot = deps.getSnapshot();
    if (!snapshot.focused || snapshot.draft.id !== draftId)
      throw new FieldCaptureError(
        "LEFT_FLOW",
        "Bạn đã rời màn chụp ảnh. Hãy mở lại camera để tiếp tục.",
      );
    return snapshot;
  };
  const cameraSnapshot = () => {
    const snapshot = current();
    if (!snapshot.active)
      throw new FieldCaptureError(
        "BACKGROUND",
        "Hãy mở lại ứng dụng để chụp ảnh.",
      );
    if (!snapshot.granted)
      throw new FieldCaptureError(
        "PERMISSION",
        "Hãy cấp quyền Camera để chụp ảnh.",
      );
    if (!snapshot.ready || !snapshot.camera)
      throw new FieldCaptureError(
        "NOT_READY",
        "Camera chưa sẵn sàng. Chờ trong giây lát hoặc khởi động lại Camera.",
      );
    return snapshot;
  };
  deps.lock.current = true;
  deps.onBusy(true);
  const stage = <T>(name: CaptureStage, operation: () => Promise<T>) => {
    deps.onStage(name);
    return runStage(name, operation, deps.timeoutMs || 20_000);
  };
  try {
    let photo = deps.preparedPhoto;
    let shouldSyncGpsInBackground = false;
    if (!photo) {
      const snapshot = cameraSnapshot();
      const activePhotos = normalizePhotoDraft(snapshot.draft).photos;
      if (typeof __DEV__ !== "undefined" && __DEV__)
        console.log("[FieldCapture] Before capture", {
          photoCount: activePhotos.length,
          rawPhotoCount: snapshot.draft.photos?.length,
          activePhotoIds: activePhotos.map((p) => p.id),
          hasLegacyCapture: Boolean(snapshot.draft.capture),
          maxPhotos: MAX_FIELD_REPORT_PHOTOS,
        });
      if (activePhotos.length >= MAX_FIELD_REPORT_PHOTOS)
        throw new FieldCaptureError(
          "PHOTO_LIMIT",
          `Mỗi báo cáo tối đa ${MAX_FIELD_REPORT_PHOTOS} ảnh. Xóa một ảnh để chụp thêm.`,
        );

      const hasFreshGps = captureGpsReady(snapshot.location, now());
      let location: FieldReportLocationDraft | null | undefined =
        snapshot.location;

      if (deps.allowCachedLocationOnShutter) {
        // Instant Shutter: dùng ngay tọa độ hiện có hoặc cache gần nhất trong bản nháp mà không treo chờ GPS
        const fallbackPhotoLocation =
          activePhotos[activePhotos.length - 1]?.location;
        location = snapshot.location || fallbackPhotoLocation;
        if (!hasFreshGps) {
          shouldSyncGpsInBackground = true;
        }
      } else {
        location = hasFreshGps
          ? snapshot.location
          : await stage("GPS", deps.refreshLocation);
        if (!location || !captureGpsReady(location, now()))
          throw new FieldCaptureError(
            "GPS_INVALID",
            `GPS chưa đủ mới hoặc chính xác (tối đa ±${MAX_FIELD_GPS_ACCURACY_METERS}m). Hãy lấy lại GPS trước khi chụp.`,
          );
      }

      // A permission dialog may have unmounted/recreated CameraView while GPS was awaited.
      const camera = cameraSnapshot().camera!;
      const capturedAt = new Date(now()).toISOString();
      const picture = await stage("CAMERA", () =>
        camera.takePictureAsync({ quality: 0.9, skipProcessing: false }),
      );
      current();
      if (!picture?.uri)
        throw new FieldCaptureError(
          "MISSING_URI",
          "Camera không trả về ảnh. Hãy khởi động lại Camera và thử lại.",
        );
      const normalized = await stage("NORMALIZE", () =>
        deps.normalizeImage(picture.uri),
      );
      current();
      const originalLocalUri = await stage("PERSIST", () =>
        deps.persistImage(normalized.uri, capturedAt),
      );
      current();
      photo = {
        id: `photo_${now()}_${Math.random().toString(36).slice(2, 10)}`,
        originalLocalUri,
        capturedAt,
        location: location || undefined,
        width: normalized.width,
        height: normalized.height,
        uploadState: "IDLE",
        visionState: "IDLE",
        detections: [],
      };
      deps.onPreparedPhoto(photo);
    }
    current();
    await stage("DRAFT", () => deps.savePhoto(photo!, draftId));
    if (shouldSyncGpsInBackground && photo?.id && deps.onBackgroundGpsSync) {
      deps.onBackgroundGpsSync(photo.id, draftId);
    }
    if (!current().active) return "SAVED";
    await stage("NAVIGATION", async () => deps.navigateToReview());
    return "REVIEW";
  } finally {
    deps.lock.current = false;
    deps.onBusy(false);
  }
}
