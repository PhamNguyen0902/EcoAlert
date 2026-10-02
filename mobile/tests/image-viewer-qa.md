# Field evidence image viewer — 2026-10-02

## Implementation

- Reusable component: `src/components/media/ZoomableImageViewer.tsx`.
- Existing dependencies only: Gesture Handler 2.32.0, Reanimated 4.5.1, Worklets 0.10.1, Safe Area Context. No dependency/lockfile or backend changes.
- Confirmation image measures its available width and reads actual URI dimensions with `Image.getSize`, falling back to `Image.onLoad`. Container width is 100%, screen padding is 16px; natural height is clamped to 220–420px and `contain` preserves aspect ratio.
- At 390px screen width, a 1080×1920 portrait fits approximately 236×420 inside the 358×420 frame. A 1920×1080 landscape fits approximately 358×201 inside a 358×220 frame. Tall images also stop at 420px without cropping.
- Full-screen viewer fits the original dimensions into its measured viewport, separate from the safe-area header and toolbar. It opens only on tap, never by default.
- Pinch stores the initial scale and clamps `startScale * gesture.scale` to 1–4. Zoom is centered; the user can pan to inspect details.
- Double tap toggles 1×/2.5× with a 200ms timing animation. The interval between taps allows 350ms. Returning to 1× centers the image.
- Pan uses viewport-pixel offsets and bounds `max(0, (fittedImageDimension * scale - viewportDimension) / 2)` on each axis. At 1× both bounds are zero. Animated styles also clamp each frame during zoom-out.
- Reset and close cancel animations and restore scale 1, translation 0. Closed sessions unmount, so reopening or changing URI starts at 1×. Viewport resizing resets zoom too.
- The thumbnail passes its **actually rendered URI** to the modal. A watermarked display image therefore stays watermarked; the modal does not switch to the original, copy/re-encode the file, or generate another watermark. Existing thumbnail fallback behavior is unchanged.
- Android `Modal.onRequestClose` calls the same close/reset handler. `GestureHandlerRootView` is inside the modal for Android gesture support.
- Step 3 / `WasteDetectionImage`, YOLO boxes, report payload, upload, offline queue, GPS rules and submission validation are unchanged.
- The existing footer occupies reserved layout space outside the ScrollView. Its safe-area padding plus the ScrollView's 24px bottom padding prevent content being hidden, without adding duplicate footer-height padding.

## Verification performed

- `npx tsc --noEmit`: exit 0.
- `npm run test:vision`: 30 passing tests, including zoom/pan bounds, portrait/landscape/tall aspect ratios, four mobile widths and existing YOLO coordinate/orientation regressions.
- Expo iOS and Android bundle/Hermes exports succeeded.
- Actual confirmation and viewer components were rendered in an isolated React Native Web harness, using the installed Gesture Handler/Reanimated and the Worklets Babel plugin. API, camera and safe-area fixtures exist only in the temporary harness, not in app code.
- At widths 320/360/390/430: image frame width is screen minus 32px, portrait/tall height 420px, no horizontal page overflow. Landscape 1471×877 JPEG height is 220px at the three narrower widths and about 237px at 430px.
- Tap opens the modal over the report footer; close restores the confirmation screen.
- Matching watermarked fixture URI checked in thumbnail and modal; watermark remains visible at 1×. This checks viewer preservation, not native camera watermark generation.
- Zoom toolbar reached 4×, disabled zoom-in at the limit, zoomed out, reset and reopened at centered 1×.
- Double tap 1× → 2.5× → 1× verified through the real web gesture handler. An initially too-strict 280ms interval was increased to 350ms for easier tapping.
- Portrait viewer remains correctly proportioned. Viewport resize restores centered 1×.
- Missing image shows “Không thể tải ảnh.”; zoom controls disable and close still works.
- Scrolled the confirmation acknowledgement into view: its bottom was above the send button (681px vs button top 718px at 390×844).
- AST comparison with the pre-task commit confirmed report submit/retake, nearby confirmation, upload/offline logic, GPS and Step 3 analysis functions remain unchanged.

## Still requires a physical phone

The browser preview and native bundle exports do **not** establish device-level gesture behavior. On the user's iPhone, verify pinch 1→4×, pinch back to 1×, one-finger pan at 2×, pan blocked at 1× and the actual camera-generated watermarked JPEG. On Android, verify hardware Back closes only the viewer. Automated math tests cover bounds; physical pinch/pan and Android hardware Back were not available in this environment.

## Changed files

1. `src/components/media/ZoomableImageViewer.tsx` — modal, gestures, safe-area/loading/error/controls.
2. `src/utils/imageViewer.ts` — zoom and pan calculations.
3. `src/features/report/components/ReportEvidenceImage.tsx` — tap interaction, same-URI handoff, image styling.
4. `src/features/report/screens/ReportConfirmScreen.tsx` — modal state, hint and integration.
5. `src/utils/visionBoundingBox.ts` — confirmation height limits only; analysis limits unchanged.
6. `tests/imageViewer.test.cjs` — zoom/pan regression tests.
7. `tests/visionBoundingBox.test.cjs` — confirmation dimensions/aspect-ratio tests.
8. `package.json` — include viewer tests in `test:vision`; dependencies unchanged.
9. `tests/image-viewer-qa.md` — this report.

SDK compatibility checked against [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Gesture Handler](https://docs.expo.dev/versions/v57.0.0/sdk/gesture-handler/), [Reanimated](https://docs.expo.dev/versions/v57.0.0/sdk/reanimated/) and [Android modal gesture setup](https://docs.swmansion.com/react-native-gesture-handler/docs/2.x/fundamentals/installation/).
