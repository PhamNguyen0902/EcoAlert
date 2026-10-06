# Citizen Mobile — Map, navigation, filters, notifications

## Scope and sequence

Working branch: `feature/mobile-field-capture`. No merge to `main`, no force push.
The branch was safely fast-forwarded to `origin/main` (`ed500cf`) before implementation.
Implementation sequence and commits:

1. `b5a4de3` — `feat(mobile): add citizen waste incident map`
2. `b863cfd` — `feat(mobile): align citizen navigation with mobile design`
3. `9883a19` — `feat(mobile): add citizen report status filters`
4. `fc40825` — `feat(mobile): add citizen notification center and deep links`
5. `fix(mobile): polish citizen screens to match stitch` — final commit containing this report.

## Implementation

- Citizen Map reuses `useAlerts(1, 100)` and existing location hooks. GeoJSON `[longitude, latitude]` is converted to native map coordinates; missing/malformed/out-of-range coordinates and deleted/rejected incidents are ignored. Pending, processing and resolved groups use amber, cyan and green. A marker opens a compact preview, then `AlertDetail`. Home's map link and mini-map open `MapTab`.
- Current location and “Gần tôi” request GPS only on user action, not on Home mount. Nearby filtering uses a 5 km radius over the loaded records; denied GPS does not remove the map or its authorized incidents.
- Exactly four bottom tabs: Trang chủ, Bản đồ, Báo cáo, Của tôi. Báo cáo keeps launching the existing report flow. Profile remains accessible through header avatars as a Citizen stack route, with the existing logout action.
- My Reports uses the existing paginated alerts endpoint, not a new backend API. `ALL` includes every returned status, including rejected; `PROCESSING` includes PENDING/AI_ANALYZING/VERIFIED/ASSIGNED/IN_PROGRESS; `RESOLVED` includes RESOLVED/CLOSED. Counts describe loaded records, with total/load-more copy when pagination remains. Offline drafts stay visible independently of the selected filter.
- Notification service paths are `/v1/notifications`, `/v1/notifications/unread-count`, `/v1/notifications/mark-all-read`, `/v1/notifications/:id/read`, `/v1/notifications/:id`. The mobile client base contains `/api`; the gateway exposes `/api/v1/notifications`.
- Notification hooks: `useNotifications`, `useInfiniteNotifications`, `useUnreadNotificationCount`, `useMarkNotificationRead`, `useMarkAllNotificationsRead`, `useDeleteNotification`. Queries are scoped by user; list/count mutations invalidate shared caches. Unread count has 45 s stale time and 60 s foreground polling, plus invalidation on foreground push/socket updates/app resume.
- Bell badges display 1–9 or 9+, and disappear at zero. The notification center supports real list pagination, mark-one, mark-all, delete confirmation, loading, retry and empty states. No production mock notifications are generated.
- Backend audit found `eventId` is a RabbitMQ event UUID, not an Alert ID. Added optional `alertId` to the existing model and propagated validated report IDs for existing Citizen notifications. Legacy notifications with no target remain readable in the center; IDs are not guessed from event UUIDs.
- Existing notification persistence, recipient/event deduplication, and read/delete semantics are retained. A recipient-room `notification:created` signal is emitted after persistence so unread invalidation cannot race the earlier workflow broadcast.
- Push taps use a typed navigation ref and validated `{ alertId }`. A bounded request-ID deduplication queue waits for navigation readiness and Citizen authentication. Cold-start reads the last notification response and clears it only after handling. No navigation reset is used; unsaved report flow state is preserved. Non-Citizen users are not routed into Citizen details.
- Pixel polish is limited to compact 3:4 thumbnails, spacing, selected-filter contrast, readable empty states and Success/header consistency. Token/payload debug logs are removed or development-only. The Expo Go gear is supplied by Expo, not EcoAlert application code.

## Verification performed

- `npx tsc --noEmit`: 0 errors.
- Mobile Node test suite: 55/55 passing across status/coordinates/filtering, navigation routes, notification payload/queue/cache contracts, civic tokens, evidence frames, field-capture images, viewer and bounding-box geometry.
- Notification-service tests: 2/2 passing (mapping/persistence contract tests). Notification-service TypeScript build and API gateway build pass.
- `npx expo-doctor`: 20/21 checks pass. Patch alignment warnings remain: expo 57.0.22 → ~57.0.26; image-picker 57.0.17 → ~57.0.20; location 57.0.17 → ~57.0.20; notifications 57.0.18 → ~57.0.21. No dependencies were blindly upgraded.
- Local browser preview of actual screen components at 360×780 and 430×932: Home, GPS, Camera, Photo Review, Image Validation, Confirm, Success and My Reports have no document horizontal overflow; landscape/portrait preview sources load; camera frame remains 3:4. Photo Review CTAs fit within the viewport. Thirteen detections remain grouped/numbered; category/severity pending states remain pending, not fabricated. Step 3 → Step 4 works.
- Browser interaction checks: Home map link; status filters; invalid coordinates ignored; marker preview/detail link; avatar/Profile/logout availability; My Reports counts/filter-specific empty states/offline banner; notification bell, read-one/read-all badge updates, valid-target detail link and no-target staying in center. Empty map/notification states checked.
- The browser preview uses temporary fixtures and native map stand-ins outside the repository. These are UI checks, not live backend, native map, GPS or remote-push integration tests. No test fixtures were added to production app code.
- AST comparison against `ed500cf` confirmed existing critical capture, review, Vision validation, submit, offline sync, logout, detail permissions and Officer processing handlers remain unchanged. Camera/GPS/Validation/Confirm implementations, YOLO/Vision bbox components, watermark/capture metadata, offline queue and Officer/Admin flows are not modified.

## Required physical-device / integration checks still outstanding

1. On an iPhone development build, open Map and check native tiles/markers and current-location recentering; grant and deny GPS, then test “Gần tôi”. Android retains Google provider; iOS retains the project's existing default native provider.
2. Verify all four native tabs, Profile/logout, report launch and back navigation using actual authenticated API data.
3. Produce real backend notifications, then test pagination, mark-one, mark-all, delete confirmation, unread count and socket updates against the running service.
4. Configure the existing EAS project/native push credentials and a real backend push sender, then test foreground delivery, background tap and terminated-app tap on iPhone. Navigation queue tests cover readiness/auth/deduplication, but do not prove delivery from APNs/Expo.
5. Repeat GPS → Camera → Review → Validation → Confirm → Success with a physical capture, offline queue/sync and actual YOLO/OpenRouter responses. No native EXIF/sensor/AI accuracy claim is made from a browser stand-in.

## Existing architecture limits / differences from Stitch

- `getAlerts` restricts CITIZEN results to their authorized/own reports. The map therefore shows these records, not an unrestricted public city-wide feed. Authorization was not weakened or bypassed for UI polish.
- The map loads at most 100 records; nearby results are not a server-side complete geographic search. My Reports supports loading additional pages; chip counts initially cover loaded pages.
- The existing notification backend currently persists processing/arrival/resolved/closed/generic updates. “Report received” and “Officer assigned” are not newly persisted by this change. No new workflow events or realtime warnings were invented.
- Existing push-token registration is reused, but this audit found no backend Expo/APNs push sender. A notification-center implementation alone does not enable remote push delivery.
- Stitch-only contribution points, server-verified time/NTP badges and unavailable category/severity are not fabricated. Existing Camera behavior takes precedence over exact screenshot pixels. Native map look can differ between Android and iOS.
- Existing notification ownership/shared-system read semantics deserve a separate backend security review; this UI task does not change those persistence semantics.

## Files changed (relative to repository root)

### Mobile production

- `mobile/App.tsx`
- `mobile/src/api/notificationService.ts`
- `mobile/src/components/citizen/CitizenHeader.tsx`
- `mobile/src/components/citizen/CitizenReportCard.tsx`
- `mobile/src/context/SocketContext.tsx`
- `mobile/src/features/report/components/ReportHeader.tsx`
- `mobile/src/features/report/screens/ReportPhotoReviewScreen.tsx`
- `mobile/src/features/report/screens/ReportSuccessScreen.tsx`
- `mobile/src/hooks/useAlerts.ts`
- `mobile/src/hooks/useNotifications.ts`
- `mobile/src/navigation/CitizenTabNavigator.tsx`
- `mobile/src/navigation/navigationRef.ts`
- `mobile/src/navigation/types.ts`
- `mobile/src/screens/citizen/CitizenDashboardScreen.tsx`
- `mobile/src/screens/citizen/CitizenMapScreen.tsx`
- `mobile/src/screens/citizen/CitizenNotificationsScreen.tsx`
- `mobile/src/screens/citizen/CitizenProfileScreen.tsx`
- `mobile/src/screens/citizen/MyReportsScreen.tsx`
- `mobile/src/services/pushNotificationService.ts`
- `mobile/src/types/notification.ts`
- `mobile/src/utils/citizenIncidents.ts`
- `mobile/src/utils/notificationNavigation.ts`

### Tests / QA

- `mobile/tests/citizenIncidents.test.cjs`
- `mobile/tests/citizenNavigation.test.cjs`
- `mobile/tests/notifications.test.cjs`
- `mobile/tests/citizen-map-notifications-qa.md`

### Notification backend

- `backend/notification-service/package.json`
- `backend/notification-service/src/models/notification.model.ts`
- `backend/notification-service/src/services/notification.service.ts`
- `backend/notification-service/src/services/rabbitmq.service.ts`
- `backend/notification-service/tests/notification-links.test.cjs`
