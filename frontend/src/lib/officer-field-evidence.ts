import type { ResolutionEvidenceInput } from "@/types";

/** A fresh foreground GPS fix; never substitute incident coordinates or cached route GPS. */
export function getFreshOfficerFieldLocation(
  geolocation:
    Pick<Geolocation, "getCurrentPosition"> | undefined = navigator.geolocation,
): Promise<NonNullable<ResolutionEvidenceInput["location"]>> {
  return new Promise((resolve, reject) => {
    if (!geolocation) {
      reject(
        new Error(
          "Trình duyệt không hỗ trợ GPS. Vui lòng dùng ứng dụng EcoAlert tại hiện trường.",
        ),
      );
      return;
    }
    geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (
          !Number.isFinite(latitude) ||
          Math.abs(latitude) > 90 ||
          !Number.isFinite(longitude) ||
          Math.abs(longitude) > 180 ||
          !Number.isFinite(accuracy) ||
          accuracy < 0
        ) {
          reject(
            new Error(
              "GPS chưa xác định được vị trí hoặc độ chính xác. Vui lòng thử lại.",
            ),
          );
          return;
        }
        resolve({ latitude, longitude, accuracyMeters: accuracy });
      },
      (failure) =>
        reject(
          new Error(
            failure.code === 1
              ? "Cần cho phép vị trí GPS để gửi kết quả xử lý."
              : "Không thể lấy vị trí GPS mới. Vui lòng thử lại tại nơi thoáng hơn.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

/** Web uploads are not live-camera proof: do not invent capturedAt from File.lastModified. */
export const attachOfficerEvidenceLocation = (
  urls: string[],
  location: NonNullable<ResolutionEvidenceInput["location"]>,
): ResolutionEvidenceInput[] => urls.map((url) => ({ url, location }));
