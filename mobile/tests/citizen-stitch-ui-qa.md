# Citizen Stitch UI — implementation and QA

## Scope and navigation

Branch: `feature/mobile-field-capture`. Baseline: `d1d09a4` (fast-forward from the latest `origin/main`). No merge into main, force push, backend feature, dependency upgrade, or API contract change.

Exactly five visible positions: **Trang chủ / Gần tôi / + / Của tôi / Cài đặt**. `SettingsTab` is typed in `CitizenTabParamList`. The raised 60dp plus uses the existing `ReportTabLauncherScreen` and `ReportFlowNavigator`; Profile remains a stack route. Bottom navigation stays in normal navigator layout, with safe-area padding, rather than overlaid on content.

`ReportTabLauncherScreen` is the only modified file under `features/report/`: a deferred-launch guard prevents repeated focus/double taps from opening duplicate flows, cleans up on unmount, and leaves Dashboard selected behind the flow. No report step UI, capture/GPS, orientation, watermark, validation, bounding boxes, submission, success screen, offline queue or sync implementation was modified.

## Screens and new reusable components

- `components/citizen/v2/CitizenUI.tsx`: `CitizenTopBar`, `CitizenAvatar` (real avatar with initials fallback), `CitizenSectionHeading`, `CitizenActionTile`, `CitizenSearch`, `CitizenStat`, `CitizenSettingsRow`.
- `components/citizen/v2/CitizenReportProgress.tsx`: three workflow-derived stages without invented timestamps.
- Home: top bar; topographic SVG hero and real profile; report/tracking actions; 2×2 feature cards; native map preview; four utility shortcuts; latest three own reports. No community counts presented as personal activity. No artificial user marker at the default map center.
- Nearby: native map, debounced search across loaded title/address/id, clear action and up to three focusable results, horizontal state filters, real GPS/recenter, compact scrollable selection preview, detail and existing external Google Maps directions. Rejected/deleted/unmappable incidents excluded. Distances are explicitly straight-line and omitted without device coordinates. The displayed subset is labelled as the latest 100 reports, not a city-wide total.
- My Reports: search, three KPIs, separate pending/processing/resolved chips, compact evidence cards, real status/progress/severity/reference, resolution time/summary only when supplied. Expandable before/after evidence reuses `EvidenceImageFrame` and its existing zoom viewer. Pagination, pull-to-refresh, edit/delete constraints and offline sync remain available. Total sent uses the backend total; status counts/search are explicitly labelled as loaded reports only.
- Settings: real profile/masked phone/account activity; Profile and Notifications navigation; persisted light/dark/system ThemeContext choice; truthful Vietnamese-only language row; actual GPS/camera permissions and system-settings link; network state; read-only device offline queue summary; real app-config version; help text; guarded logout/cancel/error state and guest login. Device summary refreshes on tab focus and return from system settings. No duplicate sync or notification listener added.

## APIs and state reused

- `useProfile` / `GET /v1/users/profile`, `useLogout` and existing auth/cache cleanup.
- `useAlerts` / `GET /v1/alerts?page=…&limit=…` for authorized public map data.
- `useCitizenReports` / same alerts endpoint with `reporterId`, gated by the signed-in citizen ID and paginated.
- `useUnreadNotificationCount` / `GET /v1/notifications/unread-count`; existing Notifications route/actions.
- Existing update/delete hooks, `EditAlertModal`, offline queue and `useOfflineSync` in My Reports.
- `useLocation`, `useDashboardLocation`, `toMapCoordinate`, `distanceMeters`, `openGoogleMaps` and native MapView.
- Existing `useCivicTheme`/ThemeContext and local permission APIs. No mocked production response or new backend endpoint.

## Files changed

New:

- `src/components/citizen/v2/CitizenUI.tsx`
- `src/components/citizen/v2/CitizenReportProgress.tsx`
- `src/screens/citizen/CitizenSettingsScreen.tsx`
- `src/utils/citizenPresentation.ts`
- `tests/citizen-stitch.test.cjs`
- `tests/citizen-stitch-ui-qa.md`

Updated:

- `src/navigation/CitizenTabNavigator.tsx`, `src/navigation/types.ts`
- `src/features/report/ReportTabLauncherScreen.tsx` (navigation guard only)
- `src/screens/citizen/CitizenDashboardScreen.tsx`
- `src/screens/citizen/CitizenMapScreen.tsx`
- `src/screens/citizen/MyReportsScreen.tsx`
- `src/utils/citizenIncidents.ts` (separate pending/processing UI groups)
- `tests/citizenNavigation.test.cjs`, `tests/citizenIncidents.test.cjs`
- `tests/officer-profile.test.cjs`: only stale navigation expectation updated from four tabs to the three tabs already present in upstream after intentional RAG removal (`9907103`). No Officer screen or navigator code changed by this task.

Pre-existing Admin logout edits (`AdminIncidentsScreen.tsx`, `tests/admin-logout.test.cjs`) are preserved locally and **excluded** from these Citizen commits.

## Validation

- `npx tsc --noEmit`: passed, no diagnostics.
- `node --test tests/*.test.cjs`: 119 tests passed in the working tree (includes four pre-existing, uncommitted Admin logout tests); new Citizen behavior suite has 17 tests. Tests execute transpiled screen handlers with native dependencies stubbed; they are not device E2E tests.
- `npx expo export --platform android --platform ios --output-dir .expo/stitch-validation`: JS/Hermes bundles produced for both platforms. This validates imports/bundling, not a signed native build or visual/device behavior.
- `npx expo-doctor`: **20/21 checks passed**, one patch-version compatibility check warns about existing dependencies. Installed → expected: Expo 57.0.22 → ~57.0.27; image-manipulator 57.0.20 → ~57.0.21; image-picker 57.0.17 → ~57.0.20; location 57.0.17 → ~57.0.20; notifications 57.0.18 → ~57.0.22. No packages were upgraded or warnings suppressed.
- `git diff --check`: passed. Protected report-step, API, offline queue/sync and Admin/Officer navigator files match the baseline.
- No mobile lint script/config exists; no lint result is claimed.

## Reference comparison and known differences

Only the supplied combined Stitch overview was available, not four separate full-resolution design files. The comparison below is a **source/layout comparison**, not a claim of pixel-perfect screenshot validation on a device.

| Reference placement | Implemented placement / proportions |
| --- | --- |
| Shared compact top bar | 60dp minimum header with logo, title, unread bell, profile avatar |
| Home hero → actions → feature grid → map → utilities → activity | Same section order; 16dp content gutters, 24dp section gaps, 24dp hero radius, flexible 2-column feature tiles, 210dp map preview |
| Full map with floating search and chips | Native map fills available tab body; search/chips constrained to its bounds, controls on the right, scrollable selected-incident preview above tab bar |
| Reports search → three KPIs → chips → rich cards | Same order, compact real image thumbnails, 3-stage progress and real resolution evidence |
| Settings profile → grouped rows → logout | Centered 72dp profile avatar, grouped navy cards, real settings/actions and bottom destructive logout |
| Five-position nav with raised plus | Five native tab positions; 60dp green plus in center and no second tab bar inside ReportFlow |

Intentional differences: no fake citizen points/trust score/VNeID/verification, city-wide counts, unsupported switches, password editing or invented policy links. Native platform map rendering is used, not a screenshot or fake map. Feature artwork uses lightweight Lucide/SVG shapes rather than reproducing the reference's raster illustrations. Profile is view-only because no real edit flow exists. Existing system-theme behavior is reused rather than changing app/native config.

## Pending physical iPhone / Android QA

No attached physical-device or simulator UI session was available. These checks remain pending and must not be treated as passed:

1. Compare screenshots to the supplied overview at 375/390/430dp, tablet, and increased text scale in both themes.
2. Check safe-area/home-indicator clearance, plus touch target, search keyboard, long names/addresses and bottom content visibility.
3. Switch all five tabs repeatedly; tap plus rapidly; back/cancel/report-success then reopen flow and confirm tabs remain usable.
4. Native map tiles, pan/zoom, marker tap, search-result focus, GPS denied/granted, permission change in device settings, recenter and external Google Maps routing.
5. No-data/API-error/retry, real multi-page own reports, refresh, edit/delete, offline queued report and reconnection sync.
6. Open real original and after-treatment evidence; zoom/pan, close and collapse preview.
7. Change each theme, restart for persistence; cancel and confirm logout; log in again under Citizen/Officer/Admin.
8. Run full live GPS → 3:4 camera → review → YOLO/Vision → confirm → submit → success regression with real backend and phone camera.

Commit SHAs and successful remote push status are provided in the task's final response after Git verification. Main is not merged.
