# ReportFlow AI classification / visual mass audit — 2026-10-13

## Findings

Camera stores the original local image in FieldReportContext. PhotoReview forwards the same draft. ImageValidation uploads the original via Media, calls `/v1/media/analyze-url` (Media downloads the image and invokes Vision/YOLO), then `/v1/ai/validate-image`. Gateway strips `/api/v1/ai`; AI `/validate-image` invokes OpenRouter with the image URL and report text. AI normalizes category, applies its configured thresholds and validates visual mass. A provider image rejection can fall back to TEXT_ONLY; a provider failure returns HTTP 503. Confirmation receives the same context provider; no provider remount/category overwrite was found between these screens.

Previous mobile code silently caught all semantic exceptions, assigned null category and still marked the overall analysis VALID. It mixed YOLO confidence with semantic confidence and presented successful recognition without explaining incomplete classification. YOLO materials alone cannot confirm an incident category. A null/UNCLASSIFIED result can also be legitimate; this audit does not claim every pending category was caused by an outage.

Mass fields were missing from mobile types/draft mapping and the shared result card hardcoded “API hiện chưa cung cấp”. AI already supplies massEstimate. Backend additionally attached a misleading TEXT_ONLY limitation to every unavailable mass estimate, including invalid ranges with a real image; corrected without changing thresholds or prompts.

## Real service evidence (sanitized)

Existing Docker AI/Gateway logs contain iPhone Expo requests to `/api/v1/ai/validate-image` returning 200, one request without a completed response, and IMAGE_AND_TEXT mass estimates both unavailable and available (2–5 kg, 5–15 kg). No semantic 503 was found in the inspected log window. A missing response is not sufficient to prove a timeout cause.

With explicit user approval, one existing report image was submitted to the live **internal AI `/validate-image`** endpoint. Result:

```json
{
  "httpStatus": 200,
  "success": true,
  "category": "illegal_dumping",
  "categoryConfidence": 0.75,
  "classificationStatus": "AI_SUGGESTED",
  "confidenceTier": "REVIEW_REQUIRED",
  "analysisMode": "IMAGE_AND_TEXT",
  "isIncident": true,
  "model": "openai/gpt-4o-mini",
  "massEstimate": {
    "available": false,
    "minKg": null,
    "maxKg": null,
    "mostLikelyKg": null,
    "confidence": null,
    "scale": null,
    "reasoningSummary": "Ảnh chưa đủ bằng chứng để ước tính khối lượng đáng tin cậy.",
    "limitations": ["Thiếu vật tham chiếu để ước tính khối lượng", "Góc chụp không rõ ràng", "Mức độ che khuất của các vật thể", "Không biết kích thước tuyệt đối của các vật thể", "Không có thông tin về mật độ chất thải"]
  }
}
```

No tokens, image URLs, account identities or coordinates are recorded here. This call verifies the live service response, not authenticated mobile/gateway/device end-to-end operation. The running Docker image predates the small diagnostic/logging change; new backend behavior is verified by local build/HTTP tests, not claimed deployed.

## Fix / contracts

- Keep YOLO detections, confidence, uploaded photo and semantic state separate. Semantic 503, timeout, malformed response, TEXT_ONLY, UNCLASSIFIED and below-threshold results are no longer silent successful classifications.
- Honor backend classificationStatus/confidenceTier. Do not reduce confidence thresholds or classify from detector labels.
- Retry reuses the original upload and existing detections, only repeats semantic inference. Late responses cannot overwrite a newly retaken photo.
- Carry massEstimate and semantic provenance into the shared Step 3 / confirmation card. Display a kg range only for actual IMAGE_AND_TEXT incident analysis with valid finite min/max/mostLikely/confidence. Do not calculate kg from bounding boxes.
- If unavailable, show the backend reason; if TEXT_ONLY or malformed, display an explicit unavailable explanation. Image estimates are labeled as estimates, not measured weights.
- Optional citizen category uses existing canonical taxonomy and `{classification:{selectedCategory,decision}}`. Preserve `imageValidation.suggestedCategory` as AI provenance. Offline queue/sync preserves the same human decision. No new backend feature/schema required.
- Pre-submit mass stays in the context draft. Do not submit an untrusted client mass field to a schema that does not support it; the existing asynchronous AI pipeline still analyzes the submitted original image.

## Checks

Files changed:

- `mobile/src/types/index.ts`, `mobile/src/features/report/types.ts`: semantic/mass types and draft provenance.
- `mobile/src/features/report/semanticResult.ts`: validated mapping, unavailable reasons, mass presentation and human-selection payload.
- `mobile/src/api/alertService.ts`: preserve response, detect failure envelopes and dedicated 60-second semantic timeout.
- `mobile/src/features/report/screens/ReportImageValidationScreen.tsx`: explicit semantic state, cached retry and stale-photo guard.
- `mobile/src/features/report/screens/ReportConfirmScreen.tsx`: retry link, optional canonical human selection and matching online/offline payload.
- `mobile/src/features/report/components/stitch/FieldAiResultCard.tsx`: real mass/status/confidence source, existing layout/tokens retained.
- `mobile/src/utils/offlineQueue.ts`, `mobile/src/hooks/useOfflineSync.ts`: preserve optional citizen classification.
- `backend/ai-service/src/services/openrouter.service.ts`: diagnostic classificationReason/logs and accurate unavailable-mass limitation, no threshold/prompt change.
- `backend/ai-service/src/tests/openrouter.service.test.ts`, `backend/ai-service/src/tests/validate-image-http.test.ts`, `backend/alert-service/src/tests/capture-metadata.test.ts`, `mobile/tests/report-semantic-flow.test.cjs`: regression coverage.
- This audit document.

- `cd mobile; npx tsc --noEmit`
- `cd mobile; node --test tests/report-semantic-flow.test.cjs`
- `cd backend/ai-service; npm test`
- `cd backend/alert-service; npm run build; node --test dist/tests/capture-metadata.test.js dist/tests/workflow-authorization.test.js dist/tests/ai-analysis.test.js`

Tests use mock native components/transports for the mobile flow, the real AI parser/fallback with mock model responses, and local HTTP for AI success/503. They cover valid/unknown/low-confidence categories, valid/unavailable/invalid mass, TEXT_ONLY, schema errors, semantic retry without upload/YOLO repeats, navigation, online submit, offline human correction and stale responses after retaking a photo.

Results: Mobile TypeScript passed; 12 ReportFlow tests passed (21 total with the 9 existing Officer map tests still present locally); all 11 AI tests passed; Alert build and 10 targeted metadata/AI/workflow tests passed. The older deleted Mobile suite was not restored or counted as passing.

Physical iPhone/Android verification has **not** been performed. Existing deleted local test files are intentionally preserved as deleted and not restored or included in this task commit. Existing Officer map changes are also excluded.

Manual device follow-up: capture a waste scene → inspect YOLO/semantic labels → verify confirmation shows the same suggestion/mass; force semantic failure → retry with photo retained; correct category → submit or queue offline → verify human/AI provenance. Missing visual reference, occlusion, inconsistent mass ranges, TEXT_ONLY and genuine low-confidence/UNCLASSIFIED classifications must remain “Không đủ dữ liệu”, never fabricated values.
