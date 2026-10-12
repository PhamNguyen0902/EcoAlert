# Non-destructive mobile production polish

Baseline: local `9186f10` on `feature/mobile-field-capture`, 2026-10-12.
Uncommitted Admin screen/logout test are outside this task. Source of truth is
the local branch; no remote checkout, dependency upgrade, backend edit or navigation rewrite.

## Phase A — baseline inventory (read-only audit before implementation)

| Area | Approved elements / implementation | Audit outcome |
| --- | --- | --- |
| Citizen Home | App bar, profile/bell, animated topographic hero, original eco-city PNG, two hero CTAs, feature grid, native map preview, utilities, recent report cards | Keep structure/artwork/motion. Region and marker JSX recreated on unrelated renders; activity error offers “first report” instead of retry; spinner has no card-shaped loading feedback. |
| Citizen tabs | Home, Nearby, center PLUS launcher, My Reports, Settings | Five positions and deduplicated ReportFlow launcher already tested; keep unchanged. |
| Nearby | Map markers, status chips, incident search, GPS button, selected incident preview/directions | Markers already memoized, bounded preview, permission/error/empty states. No redesign or marker/filter changes needed. |
| My Reports | Real user-scoped infinite query, status counters/chips, search, report cards, evidence expansion, progress, edit/delete, offline banner | Footer only checks next-page fetch, allowing it to cancel background refresh. List's default keyboard handling consumes first card tap while searching. |
| Notifications | Localized cards/icons, read/unread, expansion, mark-all, report navigation, delete, load-earlier/retry | Same pagination/refetch race. Read/navigation already guarded; preserve semantics. |
| Settings / Profile | Actual user, permissions, theme/system mode, offline summary, support, logout | Existing focus/foreground refresh and logout confirmation are sound. Shared settings row can expose a clearer screen-reader label. |
| GPS verification | Real fix, accuracy/time, map/radius, trust notice, retry/settings, 5-minute freshness, continue CTA | 15-second freshness timer runs on covered screens and does not immediately refresh time on foreground. Keep GPS rules/permission/API. |
| Live Camera | 3:4 viewport, guide/corners, HUD, live timestamp/GPS, flash/zoom, animated shutter, direct-only capture | Whole camera screen rerenders every second for timestamp; interval runs while covered. Native camera gated by navigation focus only, not app foreground. Late capture completion can navigate after leaving. |
| Photo Review | Original/display image, watermark ViewShot, integrity metrics, zoom, retry, retake/use CTA | Existing generated-URI guard and draft identity check prevent duplicate/stale watermark writes. Keep untouched. |
| AI validation | Original image, scaled boxes/numbers, scan line, processing/results, manual-review/error, guide, continue | Scan animates `top` with JS driver (`FieldUI.tsx`, pre-change lines 167/172) even when stack screen is covered. Preserve line, range, cycle and result semantics. |
| Confirmation | Evidence summary, AI result, title/description, duplicate check, acknowledgement, offline notice, fixed sibling footer | Existing synchronous submission lock and offline/online branches already tested. Add screen-reader busy/error state only; preserve inputs, duplicate flow and footer hierarchy. |
| Success | Emblem/halo/entrance, actual reference/time/address, processing timeline, queued vs confirmed, copy, return actions | Existing states correctly avoid fabricated completion/points. Keep untouched. |
| Officer | Tasks, map, profile/shift, detail/arrival/notes, resolution camera and evidence | Outside patch scope; existing tests retained. |
| Admin | Incidents/filtering/assignment/detail, GIS; unrelated local logout edits | Outside patch scope; preserve working tree verbatim. |
| Shared media/theme | Keyed image sessions, contain sizing, grouped bbox labels, zoom/pan, local hero asset, scoped theme tokens | No demonstrated need to alter geometry, original image, theme palette or artwork. |

## Change classification

- **A, confirmed bugs:** footer pagination can collide with refetch; camera
  lifecycle and stale asynchronous completion; misleading Home error CTA.
- **B, safe polish/accessibility:** activity skeletons matching compact report
  cards, contextual labels/busy states and keyboard tap handling. No visual
  hierarchy, section order, theme or typography changes.
- **C, implementation optimization:** native transform scan animation; clocks
  pause on blur/background; live timestamp isolated from CameraView; stable Home
  region/marker inputs. Technical cost reduction, not a measured FPS claim.
- **D, not implemented:** new backend features, ReportFlow semantic changes,
  navigation redesign, global theme/font changes, replacing maps/artwork/animations.

## Validation / delivery

### Implemented scope

Production source (10 files):

- `src/hooks/useForegroundScreen.ts`: focus/foreground lifecycle and visible clock.
- `src/components/citizen/CitizenActivitySkeleton.tsx`: theme-aware, static,
  compact-card-shaped activity loading placeholder with one accessible announcement.
- `src/components/citizen/v2/CitizenUI.tsx`: contextual action/settings labels only.
- `src/screens/citizen/CitizenDashboardScreen.tsx`: memoized region/markers/recent
  list; real loading placeholders; existing error button now retries the query.
- `src/screens/citizen/MyReportsScreen.tsx`: guard pagination during refetch,
  non-cancelling next-page call, keyboard taps/dismissal and accessible busy state.
- `src/screens/citizen/CitizenNotificationsScreen.tsx`: same pagination protection;
  read/unread, delete and navigation callbacks unchanged.
- `src/features/report/components/stitch/FieldUI.tsx`: identical scan-line endpoints
  and timing using native transform; pause on blur/background/Reduce Motion;
  isolated one-second live HUD clock.
- `src/features/report/screens/ReportCameraScreen.tsx`: foreground-only native
  camera, coarse freshness clock, stale-capture generation guard, ready/error and
  shutter accessible state. Capture options/normalization/original persistence unchanged.
- `src/features/report/screens/ReportLocationScreen.tsx`: pause/resume freshness
  clock; GPS rules, acquisition, permission and reverse-geocoding unchanged.
- `src/features/report/screens/ReportConfirmScreen.tsx`: accessible submit busy
  state and error announcement only; payload, synchronous lock and queue unchanged.

Regression files: `tests/foreground-polish.test.cjs`,
`tests/citizen-stitch.test.cjs`, `tests/notification-presentation.test.cjs`,
`tests/report-stitch.test.cjs`, plus this audit document. Existing assertions retained.

### Technical evidence (not a device benchmark)

- Scan animation: previously JS-driven `top` every frame; now native-driver
  `translateY`, `isInteraction: false`, measured layout only. Still 12% → 85%
  → 12% in 3.6 seconds. Tests verify driver, range, duration, focus/reduced-motion
  stops and unmount cleanup.
- Camera: previously whole screen updated once per second. Now only live HUD has
  the 1-second state; parent freshness updates at 15-second intervals while active.
  GPS validity is still rechecked with `Date.now()` at the capture/continue action.
- Covered/background GPS/Camera clocks stop, refresh immediately on resume and
  remove subscriptions/timers on unmount. Native camera is released offscreen.
- Home retains stable map region/marker elements while unrelated query status
  changes; marker data/filter/coordinate semantics unchanged.
- Pagination tests verify no additional request during ongoing fetch/refetch and
  `cancelRefetch: false`, preserving the existing infinite query/cache/API.

### Regression validation

- `npx tsc --noEmit`: passed.
- `node --test tests/*.test.cjs`: 170 passed, 0 failed, 0 skipped.
  Includes existing navigation/auth, Officer, Admin logout (uncommitted and not
  included in this task's commit), Hero, GPS/camera/watermark, detection grouping,
  bbox orientation/contain geometry, duplicate submit, offline and success tests.
- `npx expo export --platform android --platform ios --output-dir
  .expo/production-polish-validation`: both production Hermes bundles exported
  successfully. This validates bundling, not a native store build/device runtime.
- No new dependency, backend change, API contract, role/access rule or offline
  queue change. No remote checkout, push, merge or PR.
- No screen, navigation position, card, CTA, artwork, animation concept, field or
  theme removed. Six report screens, viewfinder/HUD/watermark/AI boxes, success
  timeline, hero topography and original eco-city PNG remain present.

### Device QA / remaining risks

No connected physical device, Android adb/emulator or iOS simulator was available
on this Windows host. No native before/after screenshots or FPS/memory measurements
were taken; source/test checks are not pixel-accuracy proof. Do not treat this as
complete native release certification.

Before release, verify on iPhone and Android:

1. Current approved visuals and light/dark mode at small/large widths and enlarged fonts.
2. Camera 3:4 preview versus saved image, EXIF orientation, flash/zoom/shutter;
   background/foreground and navigating away during capture, including a phone interruption.
3. GPS denied/weak/stale → retry/settings and resume after more than five minutes.
4. Scan line motion/Reduce Motion and real 1/4/13 overlapping detections.
5. Slow/failing API loading/retry, pagination while refreshing and search keyboard
   taps; notification navigation/read status still matches server state.
6. Keyboard/CTA reachability, photo zoom/watermark, duplicate confirmation,
   offline queue/online resync and actual success data.
7. VoiceOver/TalkBack announcement ordering and camera/map performance using device tooling.

AI and GPS still depend on existing services/permissions/connectivity; no values
are fabricated when unavailable. Hero asset (~2 MB) intentionally unchanged;
compression or visual/layout/font/theme changes require separate approval.
Any backend capability, idempotency contract change, map/provider replacement or
ReportFlow semantic change also needs a separate task/approval, not this UI polish.
