# Officer field workflow — device acceptance checklist

Automated checks are not a substitute for the physical acceptance flow below.
All boxes remain unchecked until verified on an actual device with the running
backend and separate Admin/Officer accounts. Do not mark implementation complete
solely because unit tests pass.

## Setup

- Rebuild alert-service: `docker compose up -d --build alert-service`.
- Restart/reload Expo after pulling `feature/mobile-field-capture`.
- Admin assigns a waste task to Officer A, with Officer B as a negative control.
- Default arrival radius: 100m; maximum GPS accuracy: 50m.
- Browser Officer resolution now requires fresh GPS (HTTPS or localhost), plus
  a verified mobile arrival. Browser photo metadata is submission location only;
  it does not prove the photo was captured at that location.

## Tasks

- [ ] All filter/counts agree with actual assigned tasks, including >100 tasks.
- [ ] New includes ASSIGNED only.
- [ ] Active includes IN_PROGRESS only.
- [ ] Completed includes RESOLVED and CLOSED.
- [ ] Pull refresh updates the assigned list and map.
- [ ] Empty/error states and retry work for every filter.

## Detail and arrival

- [ ] ASSIGNED has the Start action.
- [ ] Start changes ASSIGNED to IN_PROGRESS through the backend.
- [ ] Detail, task counts and map refresh after mutation.
- [ ] GPS permission denial leaves the task unverified and shows guidance.
- [ ] GPS unavailable shows a readable error, never fabricated coordinates.
- [ ] Poor accuracy (> configured maximum) is rejected without a state write.
- [ ] Outside radius is rejected with actual distance and retry/directions.
- [ ] Valid near-site GPS is accepted.
- [ ] Successful arrival displays server verification and timestamp.
- [ ] Stored distance is nonzero when the device is physically offset.

## Live camera

- [ ] Camera permission denial offers permission/settings, not Gallery.
- [ ] Native camera captures portrait/landscape correctly on iPhone/Android.
- [ ] No Gallery action is reachable in Officer after-treatment flow.
- [ ] Retake changes the selected image and its GPS/capture metadata.
- [ ] Use Photo confirms the image; zoom shows the full uncropped original.

## Resolution

- [ ] Missing after-photo prevents submission.
- [ ] Missing summary prevents submission.
- [ ] Missing treatment prevents submission; custom waste treatment works.
- [ ] Upload failure permits retry without calling resolve.
- [ ] Submission stores summary, treatment, materials, notes and real metadata.
- [ ] Rapid repeated taps send only one resolution; retry reuses successful upload.

## Resolved evidence

- [ ] Before image uses citizen evidence with original fallback.
- [ ] After image uses Officer resolution evidence.
- [ ] Both images open the zoom viewer; CLOSED/RESOLVED are read-only.

## Map and full acceptance

- [ ] Map contains only tasks assigned to the signed-in Officer.
- [ ] Marker preview shows real address/category/status/severity.
- [ ] Marker opens the correct task detail.
- [ ] Officer B cannot start/check-in/resolve Officer A's task.
- [ ] Real Admin assign → Officer start → physical arrival → GPS check-in →
  live after-photo → resolve → Admin review/close succeeds end-to-end.
- [ ] Profile/logout, Citizen capture/AI/map and existing RabbitMQ notifications
  remain functional on device; small screens/keyboard do not hide the submit CTA.

## Local verification (2026-10-06)

- Mobile TypeScript: 0 errors; all 97 Node regression tests pass, including
  Citizen image/auth/profile tests and mocked Officer camera capture tests.
- Alert-service: build succeeds; all 29 tests pass. Repository/event mocks are
  used for workflow tests; this is not a real MongoDB/device end-to-end run.
- Officer web GPS adapter: 3 tests pass; frontend TypeScript/Vite build succeeds.
- ESLint cannot run: the existing frontend has no ESLint configuration file.
  No config or unrelated lint cleanup was added in this task.
- Rebuilt only alert-service (`--no-deps`); container is healthy with runtime
  radius 100m, maximum accuracy 50m, evidence radius 100m.
- Image orientation, preview/captured field-of-view matching, actual GPS quality,
  browser GPS permissions and the full Admin → Officer → Admin flow remain
  pending physical device/browser acceptance.
- Docker build reported dependency audit warnings. They were not addressed with
  a potentially breaking `npm audit fix --force` during this workflow change.

## Changed-file inventory

Backend/config:

- `docker-compose.yml`
- `backend/alert-service/OFFICER_FIELD_WORKFLOW.md`
- `backend/alert-service/src/config/env.config.ts`
- `backend/alert-service/src/dtos/alert.dto.ts`
- `backend/alert-service/src/services/alert.service.ts`
- `backend/alert-service/src/tests/officer-arrival.test.ts`
- `backend/alert-service/src/tests/officer-resolution.test.ts`

Mobile:

- `mobile/src/api/alertService.ts`
- `mobile/src/hooks/useAlerts.ts`
- `mobile/src/navigation/types.ts`
- `mobile/src/navigation/OfficerTabNavigator.tsx`
- `mobile/src/screens/officer/OfficerTasksScreen.tsx`
- `mobile/src/screens/officer/OfficerMapScreen.tsx`
- `mobile/src/screens/officer/OfficerAlertDetailScreen.tsx`
- `mobile/src/screens/officer/OfficerResolutionCamera.tsx`
- `mobile/src/screens/officer/OfficerResolutionScreen.tsx`
- `mobile/src/types/index.ts`
- `mobile/src/utils/officerWorkflow.ts`
- `mobile/src/utils/officerResolution.ts`
- `mobile/tests/officer-workflow.test.cjs`
- `mobile/tests/officer-resolution.test.cjs`
- `mobile/tests/officer-field-workflow-qa.md`

Officer web compatibility (explicitly approved):

- `frontend/src/features/officer/pages/OfficerReportDetail.tsx`
- `frontend/src/lib/officer-field-evidence.ts`
- `frontend/tests/officer-field-evidence.test.cjs`
