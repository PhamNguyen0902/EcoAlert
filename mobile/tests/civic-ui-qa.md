# Citizen Civic Monitor UI — 2026-10-04

## Scope and audit

UI-only change on `feature/mobile-field-capture`, starting from `8ca5c64`.
Reusable components found: Card, Button, Badge, ReportHeader, ReportProgress,
ReportScreenIntro, ReportBottomActions, ReportEvidenceImage,
WasteDetectionResults, WasteDetectionEvidence and ZoomableImageViewer.
Confirm, Validation and AlertDetail are large screens; their handlers stay in place.
The main inconsistencies were 9px labels, arbitrary spacing/radii, duplicate report
surface colors, gradient report cards and separate Citizen headers.

## Visual system

- Citizen-scoped dark navy/green/cyan palette; light preference remains supported.
- Spacing scale: 4/8/12/16/20/24/32; horizontal content padding 16.
- Card/image radius 16, major card 18, button 12, chip 8.
- Titles 24/30, section titles 16, body 13/20, metadata at least 10.
- Shared CitizenHeader and CitizenReportCard; existing Card/Button/Badge gain an
  opt-in `civic` appearance. Other consumers retain their default appearance.
- Report footers remain non-shrinking siblings of ScrollView, not absolute
  overlays. Their height is already reserved; content retains bottom spacing.

## Screens

Home, GPS, Camera, Photo Review, Validation, Confirm, Success and My Reports were
polished sequentially, with typecheck after each screen. Profile and AlertDetail
received a final consistency pass. Home shows at most two report cards and a
196px mini-map. Validation has a compact result status and responsive two-column
detection groups. Evidence is contained rather than cropped. Confirm continues
to use the existing image viewer.

## Verification performed

- `npx tsc --noEmit`: passed after each screen and final consistency pass.
- `npm run test:vision`: 30 passed (orientation, contain/bbox, grouping, zoom/pan).
- `npm run test:civic`: 5 passed (palette, light mode, spacing, typography, targets).
- iOS and Android Expo export: passed.
- No lint script is configured in mobile/package.json; no lint dependencies added.
- AST comparison of 45 existing handlers/data expressions against `8ca5c64`:
  unchanged. Includes GPS acquisition, takePicture, watermark generation,
  analyze, submit, nearby confirmation, offline sync, status calculations,
  deletion, assignment and logout handlers.
- API/hooks, FieldReportContext, offline utilities, bbox math and image viewer
  implementation were not edited.

Browser QA used actual React Native screen components via a temporary RN Web
harness outside the repository. Only the harness substitutes device/API/map
fixtures; there is no mock API or fixture data in the shipped app.

- Home/Validation/Confirm/My Reports at 360/375/390/412/430px: no horizontal
  overflow, no rendered metadata below 10px, main CTAs remain single-line.
- GPS/Camera/Review/Success/Profile/Detail at 360px, including long addresses:
  no horizontal overflow.
- All ten screens rendered in light mode at 390px without runtime errors.
- 13 detections remain numbered, thin boxes remain visible, grouping stays below
  the image; portrait contain and overlap cases retain existing bbox behavior.
- Step 3 continue opens Step 4. Scrolling to the confirmation text leaves it
  above the submit footer; acknowledgement/disabled state still responds.
- Pending category/severity remain pending; no substituted category/severity.
- Citizen/report code contains no floating debug gear or test panel. Expo's own
  external development overlay is intentionally untouched.

## Deliberate differences from Stitch

- Current tabs/routes are retained. No nonfunctional Map tab was introduced.
- My Reports has a real total-count chip, not new processing/resolved filters:
  those filters do not exist in the original logic and this task forbids changing it.
- Notification/avatar controls only perform existing actions; no notification
  subscription or new navigation shortcut was added.
- No fake SLA, points, verification or status progression.
- Existing fonts are retained; no font or runtime package installed.

## Physical-device checks still needed

Browser fixtures cannot verify native camera/GPS permissions, map provider tiles,
actual iPhone EXIF capture, pinch/pan or Android hardware Back. Run the full
capture → review → Vision → confirm → submit flow on iPhone, and Android when
available. Check the bottom tab safe area, keyboard, and offline reconnect on device.

## Files changed

- `src/theme/civicDesign.ts`, `src/theme/useCivicTheme.ts`
- `src/components/citizen/CitizenHeader.tsx`, `CitizenReportCard.tsx`
- `src/components/ui/Card.tsx`, `Button.tsx`, `Badge.tsx`
- `src/components/ai/OverallAiAnalysisCard.tsx`
- `src/components/vision/WasteDetectionResults.tsx`, `WasteDetectionEvidence.tsx`
- `src/features/report/useReportTheme.ts`
- `src/features/report/components/ReportHeader.tsx`, `ReportProgress.tsx`,
  `ReportScreenIntro.tsx`
- `src/features/report/screens/ReportLocationScreen.tsx`, `ReportCameraScreen.tsx`,
  `ReportPhotoReviewScreen.tsx`, `ReportImageValidationScreen.tsx`,
  `ReportConfirmScreen.tsx`, `ReportSuccessScreen.tsx`
- `src/navigation/CitizenTabNavigator.tsx`
- `src/screens/citizen/CitizenDashboardScreen.tsx`, `MyReportsScreen.tsx`,
  `CitizenProfileScreen.tsx`, `AlertDetailScreen.tsx`
- `package.json`, `tests/civic-design.test.cjs`, `tests/civic-ui-qa.md`
