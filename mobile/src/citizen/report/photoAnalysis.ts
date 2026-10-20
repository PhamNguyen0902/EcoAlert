import type { PreSubmitSemanticResult, PreSubmitVisionResult } from "../../shared/types";
import type { FieldReportCaptureDraft, FieldReportImageValidationDraft } from "./types";
import { mapSemanticResult, semanticErrorMessage } from "./semanticResult";

export const photoAnalysisIdentity = (photo: FieldReportCaptureDraft) =>
  JSON.stringify([photo.id, photo.originalLocalUri, photo.capturedAt]);

type AnalysisApi = {
  uploadFieldMedia(uri: string, name: string, mime: string, key: string): Promise<{ url: string; ownershipProof: string }>;
  analyzeUploadedImage(url: string): Promise<PreSubmitVisionResult>;
  validateImageSemantics(url: string, input: { title?: string; description?: string }): Promise<PreSubmitSemanticResult>;
};

function stageError(error: unknown, stage: "UPLOAD" | "VISION") {
  const e = error as { message?: string; code?: string; response?: { status?: number } };
  if (stage === "UPLOAD" && e?.message === "MEDIA_OWNERSHIP_PROOF_MISSING")
    return "Máy chủ Media chưa trả chứng thực ảnh. Cần cập nhật Media Service.";
  if (stage === "VISION" && e?.message === "INVALID_VISION_RESPONSE") return "Dữ liệu nhận diện ảnh trả về không hợp lệ.";
  if (["ECONNABORTED", "ETIMEDOUT", "VISION_TIMEOUT"].includes(e?.code || "")) return "Hết thời gian chờ. Vui lòng thử lại.";
  return stage === "UPLOAD" ? "Không thể tải ảnh gốc lên máy chủ." : "Không thể kết nối hệ thống nhận diện ảnh.";
}

// Never log URLs, GPS, tokens or provider messages.
export function logCitizenAi(event: string, photoId?: string, error?: unknown, elapsedMs?: number) {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  const e = error as { code?: string; response?: { status?: number; data?: { code?: string } } };
  console.info(`[CitizenAI] ${event}`, { photoId, elapsedMs,
    httpStatus: e?.response?.status, errorCode: e?.response?.data?.code || e?.code });
}

// This runner owns only one immutable original image. Callers must reject late
// patches if its draft/image identity has since changed.
export async function analyzePhoto(
  original: FieldReportCaptureDraft, draftId: string, input: { title?: string; description?: string },
  api: AnalysisApi, onPatch: (patch: Partial<FieldReportCaptureDraft>) => void,
  options: { retrySemantic?: boolean } = {},
): Promise<FieldReportCaptureDraft> {
  const identity = photoAnalysisIdentity(original);
  const trusted = original.analysisIdentity === identity;
  let photo: FieldReportCaptureDraft = { ...original, analysisIdentity: identity,
    ...(trusted ? {} : { visionState: "IDLE", semanticStage: "IDLE", analysis: undefined, detections: [] }),
    ...(original.analysisIdentity && !trusted ? { originalUploadedUrl: undefined, originalOwnershipProof: undefined,
      displayUploadedUrl: undefined, displayOwnershipProof: undefined } : {}) };
  const patch = (value: Partial<FieldReportCaptureDraft>) => { photo = { ...photo, ...value }; onPatch(value); };
  patch(photo);
  const started = Date.now();
  const hasUpload = /^https?:\/\//i.test(photo.originalUploadedUrl || "") && !!photo.originalOwnershipProof;
  if (hasUpload) patch({ uploadState: "UPLOADED", uploadError: undefined });
  if (!hasUpload) {
    patch({ uploadState: "UPLOADING", uploadError: undefined });
    logCitizenAi("UPLOAD_START", photo.id);
    try {
      const upload = await api.uploadFieldMedia(photo.originalLocalUri, `field_${photo.id}.jpg`, "image/jpeg", `${draftId}:${photo.id}:original`);
      if (!/^https?:\/\//i.test(upload.url) || !upload.ownershipProof) throw Error("MEDIA_OWNERSHIP_PROOF_MISSING");
      patch({ originalUploadedUrl: upload.url, originalOwnershipProof: upload.ownershipProof, uploadState: "UPLOADED" });
      logCitizenAi("UPLOAD_SUCCESS", photo.id, undefined, Date.now() - started);
    } catch (error) {
      const reason = stageError(error, "UPLOAD");
      patch({ uploadState: "FAILED", uploadError: reason, analysis: { state: "UNAVAILABLE", detectedObjects: [], reason } });
      logCitizenAi("UPLOAD_FAILED", photo.id, error, Date.now() - started);
      return photo;
    }
  }
  if (!["OK", "NO_DETECTION"].includes(photo.visionState || "")) {
    patch({ visionState: "PROCESSING", visionError: undefined });
    logCitizenAi("VISION_START", photo.id);
    try {
      const vision = await api.analyzeUploadedImage(photo.originalUploadedUrl!);
      if (vision.status === "error") throw Error("VISION_UNAVAILABLE");
      const detections = vision.detections.map(item => ({ ...item, label: item.materialClass }));
      patch({ visionState: detections.length ? "OK" : "NO_DETECTION", detections,
        visionRequiresManualReview: vision.requiresManualReview || vision.degraded === true });
      logCitizenAi("VISION_SUCCESS", photo.id, undefined, Date.now() - started);
    } catch (error) {
      patch({ visionState: "FAILED", visionError: stageError(error, "VISION") });
      logCitizenAi("VISION_FAILED", photo.id, error, Date.now() - started);
    }
  }
  const detections = photo.detections || [];
  const sources = new Set(detections.flatMap(item => item.sources?.length ? item.sources.map(s => s.model_id) : [item.model_id || "legacy"]));
  let analysis: FieldReportImageValidationDraft = {
    ...(photo.analysis || { state: "IDLE" }), detectedObjects: detections,
    visionRequiresManualReview: photo.visionRequiresManualReview,
    yoloConfidence: sources.size === 1 && detections.length ? detections.reduce((sum, d) => sum + (d.confidence || 0), 0) / detections.length : null,
  };
  // A successful semantic response (even UNCLASSIFIED/TEXT_ONLY) is cached.
  // Retry failed semantic without uploading or rerunning successful Vision.
  if (options.retrySemantic || photo.semanticStage !== "COMPLETE" || !photo.analysis?.semanticResult) {
    patch({ semanticStage: "PROCESSING" });
    logCitizenAi("SEMANTIC_START", photo.id);
    try {
      analysis = { ...analysis, ...mapSemanticResult(await api.validateImageSemantics(photo.originalUploadedUrl!, input)) };
      patch({ semanticStage: "COMPLETE" });
      logCitizenAi("SEMANTIC_SUCCESS", photo.id, undefined, Date.now() - started);
    } catch (error) {
      analysis = { ...analysis, semanticState: "UNAVAILABLE", semanticError: semanticErrorMessage(error),
        suggestedCategory: null, severity: null, summary: null, massEstimate: undefined, semanticResult: undefined, analysisMode: undefined, categoryConfidence: null };
      patch({ semanticStage: "FAILED" });
      logCitizenAi("SEMANTIC_FAILED", photo.id, error, Date.now() - started);
    }
  }
  const semantic = analysis.semanticResult;
  const visualIncident = analysis.analysisMode === "IMAGE_AND_TEXT" && semantic?.isIncident === true;
  // VALID means completed image processing, never a confirmed incident/category.
  // No detection is a successful detector response; failures remain unavailable.
  const state = photo.visionState === "FAILED" || photo.semanticStage === "FAILED" ? "UNAVAILABLE" : "VALID";
  const reason = photo.visionError || analysis.semanticError || semantic?.shortReason || (detections.length ? "Đã phát hiện vật thể." : "Chưa nhận diện được vật thể.");
  analysis = { ...analysis, state, visionState: photo.visionState, semanticStage: photo.semanticStage,
    isWasteRelated: detections.length ? true : undefined, reason,
    backendValidation: { decision: state === "UNAVAILABLE" ? "UNAVAILABLE" : !visualIncident || photo.visionRequiresManualReview || analysis.semanticState !== "COMPLETE" || semantic?.confidenceTier === "REVIEW_REQUIRED" ? "UNCERTAIN" : "VALID",
      isEnvironmentalIncident: semantic?.isIncident ?? null, confidence: analysis.categoryConfidence ?? null,
      suggestedCategory: analysis.suggestedCategory ?? null, reason, model: semantic?.model || "YOLO multi-model", validatedAt: new Date().toISOString() } };
  patch({ analysis });
  logCitizenAi("RESULT_STORED", photo.id, undefined, Date.now() - started);
  return photo;
}
