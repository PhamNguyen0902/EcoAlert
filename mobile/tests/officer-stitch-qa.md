# Officer Stitch implementation / audit

Baseline: feature/mobile-field-capture at 41f4595. Mobile TypeScript passes; 174 tests pass. Local AdminIncidentsScreen, admin-logout test and Citizen AlertDetailScreen/alert-detail-ai test are excluded from Officer commits.

## Existing contracts (not replaced)

- Task data: useOfficerTasks(1,100,undefined,{allPages:true}); shared query across dashboard/list/map/profile.
- startHandling, confirmArrival and resolveIncident remain separate mutations. Backend scopes getAlertById and mutations to the assigned Officer.
- Check-in: backend envConfig.officerCheckinRadiusMeters (default 100m) and officerCheckinMaxAccuracyMeters (default 50m), configurable at deployment. No endpoint exposes deployed policy. Mobile must not claim a 100m policy or show client-only verified success. Accuracy circle is device uncertainty, not check-in radius. Server validates every confirmation.
- Routing: existing GET /v1/gis/route?startLat/startLng/endLat/endLng proxies OSRM; returns distanceMeters, durationSeconds and GeoJSON LineString [lng,lat]. No straight-line fallback. External Google directions retained.
- Evidence: OfficerResolutionCamera → fresh Highest GPS → takePictureAsync(skipProcessing:false) → normalizeFieldCaptureImage → persistOriginalFieldImage → review → createOfficerResolutionSubmitter (upload reuse on retry) → resolve. Original pipeline stays intact.
- No weight, shift schedule, average response time, rating, government identity, voice navigation or automatic acceptance is invented.

## Nine-screen reference checklist

1. Dashboard: compact field header, real greeting, contour hero/three counts, prominent priority task, filters/list, actual timestamp activity.
2. List: scoped search, status pills, rich photo cards, real count statistics; floating map shortcut never bypasses evidence prerequisites.
3. Detail: evidence first, incident summary, exactly one overall AI card, map, six-stage timeline, notes, state-gated action.
4. Map: native full-height map, status/search controls, own position, actual OSRM route, selected-task sheet, functional recenter/zoom/destination controls. Admin branch unchanged.
5. GPS: dedicated map/status/metadata/guidance; fresh confirmation GPS, server verified result, explicit permission/error/retry.
6. Resolution: before/after comparison, original camera/review/retake, existing required summary/treatment/equipment/notes, duplicate-safe submission.
7. Submitted: success only for own server RESOLVED/CLOSED task; real receipt/evidence, pending Admin review (not CLOSED).
8. Profile: actual identity, work counts, areas/pagination, theme/permissions, existing confirmed logout.
9. Notifications: paginated localized real notifications, all/unread/read filters, mark read/all, validated alertId Officer route only.

## Native QA required

No connected iPhone/Android device or iOS simulator is available on this Windows host. Composite reference is low-resolution; individual exports were requested. Do not claim pixel-perfect or device verification from static tests/bundles.

Device checklist: 360/390/430dp, small iPhone/Pro Max; font scaling; dark/light; keyboard and safe area; slow/offline/empty; own/unowned deep links; ASSIGNED/start/GPS error/verified/resolve/RESOLVED/CLOSED; duplicate submit/upload retry; portrait/landscape original evidence; map GPS denied/route fail/provider; notification valid/missing alertId; logout; reduce motion and foreground/background.
