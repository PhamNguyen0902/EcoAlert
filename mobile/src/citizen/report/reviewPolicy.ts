import type { FieldReportDraft, FieldReportImageValidationDraft } from "./types";
import { normalizePhotoDraft } from "./photoDraft";
import { photoAnalysisIdentity } from "./photoAnalysis";
import { fieldIntegrity } from "./components/stitch/fieldPresentation";
import { isReportCategory } from "./semanticResult";

/** AI uncertainty does not reject evidence. Ownership, GPS and capture still do. */
export function canReviewReport(draft: FieldReportDraft, offline = false): boolean {
  const { photos, capture } = normalizePhotoDraft(draft);
  if (!capture || !photos.length || photos.length > 5) return false;
  if (capture.location && (!draft.location || capture.location.latitude !== draft.location.latitude
    || capture.location.longitude !== draft.location.longitude)) return false;
  return photos.every(photo => {
    const integrity = fieldIntegrity(photo, photo.location || draft.location);
    if (!/^(file|content):\/\/.+/.test(photo.originalLocalUri) || !integrity.camera || !integrity.gps || !integrity.time) return false;
    if (offline) return true; // Sync still uploads signed evidence and passes backend validation.
    return photo.analysisIdentity === photoAnalysisIdentity(photo) && !!photo.analysis
      && /^https?:\/\//i.test(photo.originalUploadedUrl || "") && !!photo.originalOwnershipProof
      && photo.uploadState === "UPLOADED"
      && ["OK", "NO_DETECTION", "FAILED"].includes(photo.visionState || "")
      && ["COMPLETE", "FAILED"].includes(photo.semanticStage || "");
  });
}

/** Display projections reuse transport enums; they are not new backend statuses. */
export function aiStageLabels(analysis: FieldReportImageValidationDraft) {
  const vision = analysis.visionState || (analysis.state === "PROCESSING" ? "PROCESSING"
    : analysis.detectedObjects.length ? "OK" : analysis.state === "IDLE" ? "IDLE" : undefined);
  const semantic = analysis.semanticStage || (analysis.semanticState === "UNAVAILABLE" ? "FAILED"
    : analysis.semanticState ? "COMPLETE" : "IDLE");
  return {
    vision: vision === "PROCESSING" ? "Đang nhận diện vật thể"
      : vision === "OK" ? `Đã nhận diện ${analysis.detectedObjects.length} vùng trong ảnh`
        : vision === "NO_DETECTION" ? "Chưa nhận diện được vật thể"
          : vision === "FAILED" ? "Tạm thời không thể phân tích ảnh"
            : "Chờ nhận diện vật thể",
    semantic: semantic === "PROCESSING" ? "Đang phân loại AI"
      : semantic === "FAILED" ? "Tạm thời không thể phân tích ảnh"
        : analysis.semanticState === "COMPLETE" && isReportCategory(analysis.suggestedCategory) ? "Đã có danh mục đề xuất"
          : semantic === "COMPLETE" ? "Chưa xác định được danh mục phù hợp"
            : "Chờ phân loại",
    review: isReportCategory(analysis.userSelectedCategory) ? "Bạn đã chọn danh mục · Chờ cán bộ rà soát" : "Chờ phân loại",
  };
}
