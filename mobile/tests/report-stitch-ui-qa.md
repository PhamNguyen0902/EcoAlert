# ReportFlow Stitch — implementation and QA handoff

Date: 2026-10-11

Branch: `feature/mobile-field-capture`

Task baseline: `00d72cf`

## Scope and verification boundary

All six ReportFlow screens now use the supplied Stitch composition:
GPS → Camera → Photo Review → AI → Confirmation → Success.
The four-stage progress intentionally counts Camera and Photo Review together.
No backend, navigation route, global theme preference, Citizen tab or Officer/Admin
feature was redesigned.

The code was compared section-by-section with the supplied references during
implementation. This is **not screenshot/pixel-comparison evidence**: this Windows
environment has no connected phone, Android SDK/emulator/adb or iOS simulator.
Native camera framing, GPS, map tiles, ViewShot, real API submission and gesture
rendering still require the device checklist below. Automated tests exercise the
actual handlers with native/network mocks; they are not physical-device E2E tests.

## Changes by screen

| Screen | Implemented composition |
| --- | --- |
| GPS | Compact field header, thin four-segment progress, hero, actual dark native map, accuracy halo, recenter, address-first location card, GNSS/time metadata, security notice and bottom CTA. Permission/error/retry, weak accuracy and stale-fix states remain available. |
| Camera | Full-width portrait 3:4 viewfinder, real CameraView, rule-of-thirds lines and corner brackets, instruction pill, actual GPS/time HUD, native-ready LIVE SENSOR status, flash control, animated shutter, normalized camera zoom and no-gallery notice. Small screens scroll the viewfinder instead of distorting its ratio. |
| Review | Large 3:4 evidence frame, original/display fallback, existing zoom viewer, real metadata watermark, three integrity badges, photo guidance and paired Retake/Use buttons. Continue waits while watermark generation is pending. |
| AI | Actual YOLO viewport, processing scan line, unified analysis card, grouped detections, actual confidence and animated bar, category/severity pending states, actual AI summary, disclaimer and bottom Continue. Existing invalid/unavailable/manual-review paths remain. |
| Confirmation | Horizontal evidence summary, compact AI card, editable existing title/description, classification chips, character count, focused input styling, duplicate warning/actions, field acknowledgement and submission/loading/offline CTA. Keyboard avoidance is retained. |
| Success | Centered emblem/glow, contribution card, real reference/copy action, actual metadata/status, three-stage timeline and navigation actions. Offline is amber and says saved locally; no server ID is shown for a queued report. Missing report data does not render a success heading/check. |

## Shared architecture

ReportFlow-only components added in `src/features/report/components/stitch/`:

- `fieldDesign.ts`: palette, spacing, shared surface/text/button styles.
- `fieldPresentation.ts`: GPS eligibility, capture integrity, confidence and
  readable address presentation; no API/schema changes.
- `FieldUI.tsx`: notices, metadata overlay, entrance and processing animation,
  reduced-motion preference.
- `FieldMapPreview.tsx`: actual read-only native map, real accuracy circle,
  loading/slow-load presentation. Android waits for loaded tiles; MapKit uses its
  supported ready callback.
- `FieldAiResultCard.tsx`: reusable full/compact analysis presentation.
- `FieldReportSummary.tsx`: horizontal evidence/metadata card.
- `FieldProcessingTimeline.tsx`: real milestone timestamps, not invented progress.

Refactored existing `ReportHeader`, `ReportProgress`, `ReportScreenIntro`,
`ReportBottomActions` and `useReportTheme`. The dark palette is scoped to
ReportFlow and does not change the saved ThemeContext preference.

Reused existing FieldReportContext, useLocation/reverse geocoding,
CameraView/takePictureAsync, normalizeFieldCaptureImage, original/display
persistence, formatWatermarkData, ViewShot, EvidenceImageFrame,
ZoomableImageViewer, WasteDetectionImage, WasteDetectionChips, alertService,
React Query mutations, duplicate checks, offlineQueue and offline synchronization.

WasteDetectionImage only received optional presentation props:
`frameStyle`, `frameOverlay`, `showHints`. Its defaults and bbox geometry/grouping
remain unchanged for other consumers.

## Data truth and preserved behavior

- GPS remains device-only with the existing **50 m** threshold and **5 minute**
  freshness gate. A shared predicate validates finite/ranged coordinates, source
  and timestamp. It is checked again on advancing/capturing, not just at render.
- Reverse-geocoding fallback is readable in the UI. Coordinates remain separate
  metadata; address/payload state is not replaced with a fabricated street.
- Camera uses the existing normalization and original-file persistence. No new
  image picker, generated picture, forced rotation or original-image crop.
  A synchronous capture ref prevents rapid double presses before rerender.
- Watermark uses a separate display file; the original remains the AI/upload
  evidence. The render source matches the original aspect ratio instead of
  introducing letterboxing in the persisted display. Existing display files are
  not watermarked twice. Generation failure preserves the existing original-only
  fallback and a visible retry; it is not reported as successful watermarking.
- Review integrity badges reflect actual capture/GPS/time metadata. They do not
  claim cryptographic authenticity or absolute GPS anti-spoofing.
- Vision and semantic analysis still run through existing real API services.
  VALID/INVALID/PROCESSING/UNAVAILABLE and backend UNCERTAIN branching are retained.
  No detections or missing category/severity/confidence do not create fake values.
- The pre-submit semantic DTO currently supplies no mass estimate: UI says
  “Chưa có ước tính / API hiện chưa cung cấp”. No mass estimation backend added.
- The existing field flow had no category editor; it used AI suggestions. The
  new classification chips therefore remain read-only, with title/description
  editable. No new taxonomy or user/AI category provenance was invented.
- Submit retains original/display upload, capture metadata, AI validation,
  category, duplicate-report checks, the synchronous submit lock and GeoJSON
  `[longitude, latitude]` ordering.
- Offline submission still queues original and display local paths. Leaving
  Success only clears the in-memory report context, not queued evidence/files.
  Offline status is not described as server acceptance.
- Success reference uses the existing formatAlertReference helper and a valid
  actual ID. Timeline checks only actual timestamps: createdAt records server
  creation (not Admin approval), assignedAt assignment and closedAt completion.
  No +20 EcoPoint, fake sample ID, date, confidence, weight or impact claim.

## Automated validation

Run from `mobile`:

```powershell
npx tsc --noEmit
node --test tests/*.test.cjs
npx expo export --platform android --platform ios --output-dir .expo/report-stitch-validation
git diff --check
```

- TypeScript: PASS.
- New ReportFlow suite: 28/28 PASS.
- Full mobile suite: 154/154 PASS (includes four existing, uncommitted Admin
  logout tests; these are not included in ReportFlow commits).
- Android and iOS Metro/Hermes export: PASS; local ignored output under
  `.expo/report-stitch-validation`. This is not a native app build or a publish.
- Whitespace/diff check: PASS.
- No mobile lint script/config exists. An additional unused-symbol audit was
  used to remove obsolete imports/styles in the touched ReportFlow files only.
  Pre-existing unused-symbol findings elsewhere were left untouched.

The new tests cover GPS source/accuracy/freshness/permission/timeout/retry,
camera-ready/capture failure/rapid presses/retake, separate original/display
watermark handling and retries, AI states/API boundaries, null confidence/mass,
actual bbox preservation, editing/validation/keyboard structure, duplicate
actions, submit success/failure/double-submit, offline payload, reference copy,
success navigation, timeline truthfulness and platform-specific map readiness.
Existing suites cover normalization, contain/bbox alignment, 1/4/13 detections,
overlaps, low-confidence labels, image viewer, queue and Citizen navigation.

## Mandatory remaining device/visual QA

Use an iPhone and Android at 360/390/430dp (also smallest/largest iPhones).
Take screenshots of each screen and compare with its reference before accepting
pixel fidelity. No such screenshots were generated in this environment.

- [ ] GPS permission denied → settings/retry; timeout → retry; accuracy >50 m
  disabled; valid GPS enabled; wait 5 minutes and verify expiry.
- [ ] Actual address, coordinates, GNSS/time and marker correspond to device;
  airplane mode/slow map tiles show the supported loading state.
- [ ] Camera frame is 3:4, native preview matches saved composition, portrait and
  landscape captures have correct orientation; no stretch/unintended crop.
- [ ] Flash/zoom/shutter work; rapid taps produce one capture; failure recovers.
- [ ] Review retains original and persisted watermark; retake/use works; zoom,
  pan and close work; returning to Review does not duplicate watermark.
- [ ] Real Vision result renders aligned bboxes for 0/1/4/13 and overlapping
  detections; scan line stops; error/manual-review paths remain usable.
- [ ] Actual semantic result vs missing result displays truthful
  category/severity/confidence/summary with no invented weight.
- [ ] Long Vietnamese address/title/description, larger system font, keyboard
  and scrolling never hide the last field or bottom CTA.
- [ ] Real online submit works; failure preserves draft; repeated taps submit
  once; nearby report view/confirmation works.
- [ ] Disconnect after AI validation → queue → no server reference; reconnect
  → existing sync uploads both evidence versions; no files lost on exit.
- [ ] Success reference copies correctly, timeline reflects actual status,
  My Reports/detail and Home navigation work.
- [ ] Reduced motion, safe areas/Dynamic Island/home indicator, camera ready
  transition, glow and contrast are visually appropriate.
- [ ] Home/Nearby/My Reports/Settings, five-position tabs, notifications,
  Officer and Admin remain visually and behaviorally unchanged.

## File manifest

Modified:

- `mobile/package.json`, `mobile/package-lock.json`
- `mobile/src/components/vision/WasteDetectionImage.tsx`
- `mobile/src/features/report/useReportTheme.ts`
- `mobile/src/features/report/components/ReportHeader.tsx`
- `mobile/src/features/report/components/ReportProgress.tsx`
- `mobile/src/features/report/components/ReportBottomActions.tsx`
- `mobile/src/features/report/components/ReportScreenIntro.tsx`
- All six `mobile/src/features/report/screens/Report*Screen.tsx` files.

Added: seven files in `components/stitch/` listed above,
`mobile/tests/report-stitch.test.cjs` and this QA document.

Only runtime dependency added is `expo-clipboard ~57.0.2`, for the real reference
copy action, installed using the matching Expo 57 tooling. No unrelated dependency
upgrades. Installation reported 34 audit findings in the dependency tree;
no broad audit-fix/upgrade was attempted in this UI task.

## Local commits and protected work

- Phase A: `9cd4ef8` — build stitch field report design system.
- Phase B: `a2f5843` — redesign GPS and live camera capture.
- Phase C: `a1bd5ec` — redesign field evidence photo review.
- Phase D: `d0678d8` — redesign YOLO image validation experience.
- Phase E: `ca30471` — redesign report confirmation and success.
- Phase F: `fix(mobile): polish stitch report flow fidelity` — final local QA
  commit containing this document; SHA reported in the handoff message.

Notification commits `ede9a6f`, `46b0cea`, `00d72cf` remain intact.
Existing `mobile/src/screens/admin/AdminIncidentsScreen.tsx` edits and
`mobile/tests/admin-logout.test.cjs` remain untouched and outside these commits.
No reset, remote push, main merge or PR was performed.
