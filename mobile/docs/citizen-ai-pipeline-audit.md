# Citizen AI pipeline audit — 2026-10-17

## Scope and evidence

Audited local dirty source, not an older remote checkout. No branch change,
commit, push, merge, reset, draft deletion or model/weight replacement.
Unrelated Officer/Admin changes and existing deleted files were preserved.

The user explicitly approved uploading `mobile/assets/hero/eco-city.png` to S3
and sending it to the configured OpenRouter model. No report was created and
no GPS was submitted. This illustration tests plumbing, not model accuracy.
URLs, JWTs and API keys are deliberately omitted below.

## Root causes

1. The running Media image was older than the local upload controller. Upload
   returned HTTP 200 and a URL, but no `ownershipProof`. Mobile correctly
   rejected it before reaching Vision or Semantic. The source already signed
   uploads; the running image did not. Loading only the new compiled controller
   also exposed stale shared code/dependencies (`signMediaOwnership` missing,
   then missing `jsonwebtoken`). Rebuilt only Media and mounted the correct
   `/app/shared/dist` and `/app/media-service/dist` paths.
2. OpenRouter returned HTTP 402. AI Service previously wrapped this as a generic
   503. It now returns a safe diagnostic code and upstream status. Billing/key
   budget/provider access still requires administrator action; no alternate
   model, fabricated category, fake mass, or lower threshold was used.
3. Mobile stored Semantic globally and called it only for the primary/first
   successful photo. Preview could display another image with the global result;
   a global VALID could skip new photos. Cache lacked image identity. Catch
   could mark an already successful upload as failed when Vision failed.

## Current real API results

| Request | Result |
| --- | --- |
| Vision `/health` | ok, 2 configured/enabled/loaded models, no model errors |
| Vision `/detect` | HTTP 200, success=true, 4 detections, degraded=false |
| Vision `/predict` | HTTP 200, status=ok, 4 detections, degraded=false |
| Gateway `/api/v1/media/upload` | HTTP 200, valid URL and ownershipProof present |
| Gateway `/api/v1/media/analyze-url` | HTTP 200, status=ok, 4 detections, 4-element bbox present |
| Gateway `/api/v1/ai/validate-image` | HTTP 503, code=AI_PROVIDER_BILLING_REQUIRED, providerStatus=402 |

Both models have actual inference timings in `/detect` and `/predict`.
The surviving detections on this particular illustration came from
`ecoalert_general`; absence of `asian_waste` detections is not a model failure.
Class names are read from the weights (6 and 9 classes respectively).
All 12 Compose services were healthy after scoped deployment.

Safe semantic response:

```json
{
  "success": false,
  "code": "AI_PROVIDER_BILLING_REQUIRED",
  "providerStatus": 402,
  "message": "Chưa thể hoàn tất đánh giá tự động."
}
```

## Changes

- `mobile/src/citizen/report/photoAnalysis.ts`: independent upload, Vision,
  Semantic runner; identity is photo ID + original URI + capture timestamp.
  Per-stage checkpoints, safe development logs, partial failures and retry.
- `mobile/src/citizen/report/types.ts`: per-photo analysis identity/result,
  semantic stage and upload/Vision errors.
- `mobile/src/citizen/report/photoDraft.ts`: switching primary projects its own
  cached analysis into the legacy global field used by confirmation/submit.
- `mobile/src/citizen/report/screens/ReportImageValidationScreen.tsx`: per-photo
  requests/results, preview-matched card, late-result guards, new-photo scan
  independent of global VALID, interrupted-session recovery, targeted retry.
- `mobile/src/citizen/report/components/stitch/FieldAiResultCard.tsx`: heading
  “ĐÁNH GIÁ TỰ ĐỘNG”, honest no-detection/unavailable status, existing style kept.
- `mobile/src/citizen/report/semanticResult.ts`: safe provider error explanations.
- `mobile/src/shared/api/alertService.ts`: upload proof remains mandatory,
  validate actual `/predict` response, reject malformed/service-error results,
  60-second analysis timeout.
- `backend/media-service/src/services/vision.service.ts`: 40-second inference
  timeout (remote image fetch remains 15 seconds), response validation, safe
  error codes/logging; preserve merged detections/model provenance.
- `backend/ai-service/src/app.ts`: safe structured Semantic failure response.
- `docker-compose.yml`: Media compiled/shared bind mounts, scoped Media rebuild.
- Tests: `mobile/tests/field-photo-analysis.test.cjs`,
  `mobile/tests/report-semantic-flow.test.cjs`,
  `backend/media-service/src/tests/vision.service.test.ts`,
  `backend/ai-service/src/tests/validate-image-http.test.ts`.

## Verification and limitations

- Mobile TypeScript check passed.
- All 67 currently present Mobile tests passed. Native transport/UI primitives
  are mocked in component tests; they are not phone E2E tests.
- AI tests: 12 passed. Media tests: 3 passed. Shared/AI/Media builds passed.
- Android and iOS Expo/Hermes bundle export passed.
- Covered three independent photos, one upload failure preserving siblings,
  successful upload + failed Vision, Semantic 503/402 + retry, cache identity
  change, interrupted PROCESSING, complete primary not skipping a new photo,
  late responses after retake (same/new report), no_detection, UNCLASSIFIED,
  low confidence, TEXT_ONLY, available/unavailable/invalid mass, online and
  offline confirmation submit, GPS/camera/draft 0–5 and 3-step regressions.
- Live OpenRouter success/category/mass could not be verified because of 402.
  “Không đủ dữ liệu” remains correct for unavailable/invalid visual mass,
  TEXT_ONLY, low-confidence/UNCLASSIFIED category, or insufficient image scale.
- Real iPhone/Android Camera → Review → AI → Confirm, bbox alignment on physical
  captures, app background/resume/network loss and three freshly captured photos
  still need device testing. No claim of completed phone E2E.
- Dependency audit warnings appeared during the existing Docker npm install;
  dependency/security upgrades were not applied as part of this scoped fix.
