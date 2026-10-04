# Evidence image UI / viewer — 2026-10-04

Branch: `feature/mobile-field-capture`; base: `b4d50d5`.

## Presentation

- Shared `EvidenceImageFrame`: 84% of available content width, max 320px,
  aspect ratio 3:4, centered, radius 16, clipped to a #050D17 background.
- Images use contain, not cover. Source files, original dimensions, EXIF
  normalization, upload and capture metadata are untouched.
- Review, Confirm, Validation, Citizen/Officer Detail and resolution preview
  use 3:4 frames. Home/My Reports keep compact thumbnails; tapping the image
  opens the viewer while tapping the report card still opens its detail.
- Review keeps the existing ViewShot watermark renderer at its existing
  dimensions behind the opaque screen UI, outside ScrollView clipping. It stays
  attached and inside native bounds for capture. The visible frame shows displayLocalUri when ready.
  Watermark generation, data, retry, original URI and Vision source are unchanged.
  The temporary visual watermark is contained, capped at 30%, address max 2 lines.
- Validation retains the existing contain rect and bbox transform. It opens
  the original image without boxes in the viewer. Its status caption is below
  the image so it cannot hide box labels or the expand control.
- The camera adds a 3:4 composition guide, not a crop. Capture settings and
  preview remain unchanged. Expo SDK 57's ratio prop is Android-preview-only;
  it is not a cross-platform guarantee of captured photo aspect ratio.
  Reference: https://docs.expo.dev/versions/v57.0.0/sdk/camera/#ratio

## Existing viewer reused

`ZoomableImageViewer.tsx` was reused without rewriting gesture logic:

- Full-screen modal, safe-area header/footer, 44px close control.
- Pinch 1x–4x; pan clamped against the fitted image and viewport.
- Double tap 1x -> 2.5x, otherwise -> 1x, 200ms animation.
- Closing unmounts the session; reopening starts centered at 1x.
- Android Modal onRequestClose closes the viewer, not report navigation.
- URI is the displayed full-quality rendition (or its original fallback).
- No zoom library, font or runtime dependency added.

## Verification

- TypeScript: `npx tsc --noEmit`, zero errors.
- 40 unique unit tests passed: frame sizing/letterboxing, bbox, orientation,
  grouping, zoom/pan and civic tokens. `npm run test:images` also passes.
- iOS and Android Expo bundle exports passed.
- AST comparison of 61 pre-existing handlers/data expressions: unchanged,
  including Officer/Resolution handlers and contain/bbox calculations.
- Browser preview uses the actual screen components with isolated fixtures
  outside the repository; no mocked API was added to the shipped app.
- Review/Confirm/Validation at 360/375/390/412/430px: 3:4 frames, width <=320,
  height <=426.7, no horizontal overflow. Tall images stay inside the frame.
- Portrait, landscape, 3:4 and watermarked images: contain rendering checked.
- 13 boxes stay within the rendered image, not vertical/horizontal letterboxes.
- Review, Confirm, Validation, Detail and My Reports: tap-to-view checked.
- Viewer + controls, close and reopen reset to 1x checked in browser.
- My Reports image opens viewer; closing it does not navigate; card text opens detail.
- Broken display URI falls back to original URI and that same URI opens in viewer.
- Review's integrity heading is visible above the action footer at 390x844.
- Legacy FieldCaptureReportScreen/ReportIncidentScreen are not registered in
  active navigation and were intentionally not edited.

## Device checks still required

Browser preview cannot validate native iPhone/Android camera, actual ViewShot
output, file:// URIs, authenticated remote image URLs, two-finger pinch, native
pan/double tap, Android hardware Back or viewer presentation over ResolutionModal.
The gesture math is unit-tested and both platform bundles compile, but do not
mark these physical-device cases as manually passed. Run capture -> review ->
Validation -> Confirm -> submit on iPhone, then check resolution preview on Android.

## Files changed

- `src/components/media/EvidenceImageFrame.tsx`
- `src/utils/evidenceImageFrame.ts`
- `src/features/report/components/ReportEvidenceImage.tsx`
- `src/features/report/screens/ReportCameraScreen.tsx`
- `src/features/report/screens/ReportPhotoReviewScreen.tsx`
- `src/features/report/screens/ReportImageValidationScreen.tsx`
- `src/features/report/screens/ReportConfirmScreen.tsx`
- `src/components/vision/WasteDetectionImage.tsx`
- `src/components/vision/WasteDetectionEvidence.tsx`
- `src/components/citizen/CitizenReportCard.tsx`
- `src/screens/citizen/AlertDetailScreen.tsx`
- `src/screens/officer/OfficerAlertDetailScreen.tsx`
- `src/components/modals/ResolutionModal.tsx`
- `tests/evidenceImageFrame.test.cjs`
- `tests/evidence-image-ui-qa.md`
- `package.json` (test script only)
