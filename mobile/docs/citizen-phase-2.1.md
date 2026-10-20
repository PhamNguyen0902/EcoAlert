# CIT-07 — Citizen Phase 2.1

Implemented and tested on 2026-10-17. No Git mutation, model/weight changes,
Camera rewrite, Officer/Admin UI changes, or new backend feature.

## Audit findings and fixes

1. Successful `no_detection` plus unclassified Semantic used to become local
   `INVALID`, although that cannot prove the absence of an incident. It now
   finishes image processing without fabricating objects, confidence, mass or
   a category. Backend image validation is `UNCERTAIN`, not `INVALID`.
2. Technical failures could appear locally `VALID` when YOLO had detections.
   They now remain `UNAVAILABLE`; successful YOLO regions are retained.
3. Confirmation only accepted global `VALID`. A separate evidence eligibility
   policy now permits manual review after completed/failed analysis stages.
   Online images still require successful signed upload, matching image
   identity, native capture URI, valid GPS relative to capture time, 1–5 images,
   and no processing stage. Title, description and acknowledgment are still
   required at confirmation. Offline sync retains its existing signed upload,
   authentication and backend validation path.
4. AI suggestions were sent as `category` despite no explicit citizen choice;
   the backend treated them as user decisions. Now only explicit citizen
   selection sends `category`/`classification`. AI provenance remains in
   `imageValidation`. Without a choice, the existing backend creates
   `status=pending`, `category=UNCLASSIFIED`, `classification.status=UNCLASSIFIED`,
   with no final category or confirmed user.
5. Result UI now says “Đánh giá tự động” and separates detector and Semantic
   labels from “Chưa gửi · Chờ phân loại” workflow copy. An automatic assessment
   is explicitly not a final officer conclusion. Counts are regions in the
   selected image, not deduplicated physical objects across multiple photos.
6. Per-photo upload/Vision/Semantic caches remain independent. A detector retry
   does not rerun completed Semantic; explicit Semantic retry can refresh an
   unclassified result. Late sibling responses do not change the preview.

## State mapping (existing enums reused)

| Layer | Existing state | Display/behavior |
| --- | --- | --- |
| Vision | IDLE / PROCESSING | Chờ nhận diện / Đang nhận diện |
| Vision | OK | Actual detected regions, Vietnamese labels and valid scores |
| Vision | NO_DETECTION | Chưa nhận diện được vật thể; no fabricated boxes/scores |
| Vision | FAILED | Tạm thời không thể phân tích ảnh; retry |
| Semantic | IDLE / PROCESSING stage | Chờ phân loại / Đang phân loại AI |
| Semantic | COMPLETE + classified result | Danh mục đề xuất; not human confirmation |
| Semantic | COMPLETE + UNCLASSIFIED/TEXT_ONLY result | Chưa xác định được danh mục phù hợp |
| Semantic | FAILED stage / UNAVAILABLE result | Technical failure; retain YOLO and allow retry |
| Review | Draft, no explicit category | Chưa gửi · Chờ phân loại |
| Review | Created with no explicit category | Existing PENDING + UNCLASSIFIED backend statuses |

Local `imageValidation.state=VALID` means image processing completed, not that
AI proved an incident or assigned a final category. New service failures remain
`UNAVAILABLE`. Old cached `INVALID` results can still enter manual review if
their own evidence/stage/identity checks pass; no destructive draft migration.

## Files and key locations

- `mobile/src/citizen/report/reviewPolicy.ts:8`: evidence eligibility;
  `:26`: independent stage/review label projections.
- `mobile/src/citizen/report/photoAnalysis.ts:104`: no-detection/failure mapping
  and preservation of separate Vision/Semantic states in each photo analysis.
- `mobile/src/citizen/report/types.ts:49`: existing per-photo stage types reused
  in the analysis snapshot; no backend enum added.
- `mobile/src/citizen/report/semanticResult.ts:61`: explicit citizen choice only.
- `mobile/src/citizen/report/components/stitch/FieldAiResultCard.tsx:29`:
  trustworthy category/confidence, per-image states/count and final-review note.
- `mobile/src/citizen/report/screens/ReportImageValidationScreen.tsx:78`:
  targeted retry; `:121`: evidence-based continuation and manual-review copy.
- `mobile/src/citizen/report/screens/ReportConfirmScreen.tsx:100`:
  pending-review submission; `:302`: separate review status; existing description
  and manual taxonomy inputs retained.
- `mobile/tests/report-semantic-flow.test.cjs`: UI, policy, retry, async preview
  isolation, explicit category and pending submission regression coverage.
- `backend/alert-service/src/tests/workflow-authorization.test.ts:15`:
  real DTO/service classification and signed media checks.
- `backend/alert-service/src/tests/manual-review-http.test.ts:9`:
  real HTTP/auth/DTO/controller/service contract test with repository and
  event transport stubbed (no production persistence or external AI calls).

Backend DTO/schema/production services did not need changes: existing
`UNCERTAIN`, `UNAVAILABLE`, optional category, `UNCLASSIFIED` and signed media
validation already support manual review. Gateway authentication/rate limiting,
per-image GPS restrictions, idempotency and ownership verification are unchanged.

## Verification

- Mobile `npx tsc --noEmit`: passed.
- Mobile tests: 72 passed, 0 failed.
- Alert Service build: passed. Suite: 50 passed, 0 failed, 2 skipped.
  Skips are the existing real Mongo area-assignment integrations requiring
  `TEST_MONGO_URI`; they were not weakened or removed.
- Expo export for Android and iOS: passed, both Hermes bundles generated.
- HTTP tests: pending review returns 201 with UNCLASSIFIED; forged JWT 401;
  wrong role/missing ownership proof 403; inaccurate GPS/missing images 422.
- Covered single/multiple detections, distinct multi-photo results, no detection,
  unclassified/low-confidence/TEXT_ONLY results, Vision/Semantic failure/timeout,
  retry, preview change during processing, late response isolation, signed
  pending submission, explicit category confirmation, offline queue, normal
  submission and Camera/GPS/draft/3-step regression tests.

## Limits

No iPhone/Android physical-device UI or camera E2E was performed. Native UI and
transport are mocked in component tests; HTTP tests exercise the actual server
stack but stub database/events. Test the 3-step flow with real captures and
connectivity changes on both providers/devices before device acceptance.

No paid OpenRouter call was repeated during this UI phase. The previous audit
observed provider HTTP 402; this phase does not repair provider billing/access.
GPS/camera metadata retain existing trust limits, not new hardware attestation.
No report, photo, draft or offline queue data was deleted.
