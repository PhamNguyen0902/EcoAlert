# EcoAlert Mobile ↔ Web Feature Parity

## Scope and approach

This inventory was taken from the current source tree, rather than from older
documentation. Mobile is a role-aware React Native/Expo client of the existing
API Gateway. It does not calculate workflows, run AI/Vision, call weather
providers, or create an alternate mobile backend.

Expo remains `~54.0.0` (`mobile/package.json`). No Expo upgrade or background
location tracking is part of this work.

## Web feature inventory

| Area | Web routes/features audited |
| --- | --- |
| Common | Login, registration, profile, password change, EN/VI, theme, notifications, assistant |
| Citizen | `/home`, `/weather`, `/report`, `/my-reports`, `/incidents/:id`, notifications, profile |
| Officer | dashboard, assigned reports, pending-verification queue, map, report detail, notifications, stats, profile |
| Admin | dashboard, users, officers, reports/detail, categories, monitoring, analytics, incident-density GIS, audit, settings, profile |

## Mobile state before this upgrade

| Area | Existing mobile state |
| --- | --- |
| Common | Secure persisted auth, JWT-aware client, role routing, theme/language settings, profile/password controls and React Query were already present. |
| Citizen | Dashboard, report P0 workflow, report list/detail, weather detail, notifications and assistant were already implemented. |
| Officer | Shift start/end with one-time foreground GPS, tasks/detail/map, GPS check-in and resolution evidence were already implemented; Assistant and notification entry points were absent from officer navigation. |
| Admin | Dashboard, user/category/audit management, and an admin-aware incident detail existed, but there was no practical mobile incidents list, officer availability, or GIS density view. The previous five-tab layout also hid the operational admin flow. |

## Feature parity matrix

### Citizen

| Feature | Web | Mobile after | Shared API | Status |
| --- | --- | --- | --- | --- |
| Dashboard/recent reports | Yes | Greeting, location, real weather, stats, reports, notification/assistant shortcuts | `/v1/alerts`, `/v1/notifications`, `/v1/gis/weather` | Kept/verified |
| Weather and details | Yes | Current, metrics, hourly/daily forecast, AQI, retry/refresh | `/v1/gis/weather`, `/v1/gis/weather/details` | Kept/verified |
| Incident reporting | Yes | Camera/library, foreground GPS/map, reverse-geocode, upload, image validation, suggestion/correction, duplicate check | `/v1/media/upload`, `/v1/ai/validate-image`, `/v1/alerts` | Kept/verified |
| My reports | Yes | Paginated list/detail with status/category/severity | `/v1/alerts` | Kept/verified |
| Detail, AI and Vision | Yes | Overall analysis, Vision evidence, image and resolution evidence, map, persisted timeline/status history | `/v1/alerts/:id` | Upgraded |
| Notifications | Yes | List, unread/read, mark-all-read, refresh and empty/error states | `/v1/notifications` | Kept/verified |
| Assistant | Yes | Conversation list/history, send, errors/retry, draft retention and sources | `/v1/assistant/*` | Kept/verified |

### Officer

| Feature | Web | Mobile after | Shared API | Status |
| --- | --- | --- | --- | --- |
| Dashboard and shift | Yes | Workload cards, foreground-GPS start/end shift and refresh | `/v1/alerts`, `/v1/alerts/officer/shifts/*` | Kept/verified |
| Tasks/detail | Yes | Assigned task filters/detail, source evidence, AI/Vision, map, Google Maps and persisted timeline | `/v1/alerts/officer/tasks`, `/v1/alerts/:id` | Upgraded |
| Workflow | Yes | Start handling, foreground GPS check-in, note, required after photo, resolution | `/start`, `/arrival`, `/note`, `/resolution` | Kept/verified |
| Map | Yes | Real incident markers; opening directions is a separate, non-mutating action | `/v1/alerts` | Kept/verified |
| Assistant/notifications | Yes | Role-aware assistant tab and notification shortcut/stack | `/v1/assistant/*`, `/v1/notifications` | Added |

### Admin

| Feature | Web | Mobile after | Shared API | Status |
| --- | --- | --- | --- | --- |
| Dashboard | Yes | Summary cards, activity, assistant and notification shortcuts | `/v1/alerts` | Upgraded |
| Incident management | Yes | Filtered/paginated incident FlatList → shared detail | `/v1/alerts` | Added |
| Classification and closure | Yes | Admin-aware detail confirms classification, assigns/reassigns, reviews resolution and closes | `/classification/review`, `/assign`, `/close` | Upgraded |
| Officer availability/workload | Yes | Shift, active/assigned/in-progress counts and workload filters | `/v1/alerts/officers/availability` | Added |
| Assignment warning context | Yes | Assignment picker now displays live on/off-shift and workload state | `/v1/alerts/officers/availability` | Upgraded |
| GIS density | Yes | Heatmap, points, combined mode, summary, filter sheet and nearby-incident drilldown | `/v1/gis/incidents/heatmap`, `/v1/gis/incidents/nearby` | Added |
| Users/categories/audit | Yes | Mobile list/forms and audit log moved into a compact More stack | `/v1/users*`, `/v1/alerts/categories*` | Retained |
| Assistant/notifications | Yes | Available from dashboard and More | `/v1/assistant/*`, `/v1/notifications` | Added |

## Shared APIs and state consistency

All of the mobile screens use `mobile/src/api/*` and React Query hooks. They
call the same endpoints as the web client. Mutation hooks invalidate the alert,
task, availability, notification, and shift query families, so both clients read
the same persisted server state on their next fetch.

## Weather parity

Both clients call the GIS service through the gateway. Coordinates are rounded
for stable cache keys and are passed unchanged from the citizen dashboard to the
weather detail view. Neither web nor mobile contains an OpenWeather credential
or calls OpenWeather directly.

## AI and Vision parity

The mobile detail views render the persisted `aiOverallAnalysis`, `aiVision`,
and `aiFusion` data returned for an incident. Semantic confidence stays
unavailable when the server returns no semantic value; detector confidence is
shown separately. AI inference and custom six-class YOLO remain server-side;
no model is downloaded to the device and SAM2 remains disabled.

## GIS parity

The admin mobile GIS view has three mobile-appropriate display modes:

- Density: native heatmap on Android; the same real GIS points are rendered as
  intensity circles where a native heatmap is not supported.
- Incident points: exact locations returned by the GIS service.
- Combined: both layers.

Its category, severity, status, and date-range filters are passed to the same
GIS endpoint as the web density page. Tapping a map location or marker calls the
existing nearby/drilldown endpoint and opens a compact bottom sheet.

## Intentional UI differences

| Web UI | Mobile equivalent |
| --- | --- |
| Wide report/user tables | Filtered FlatLists and incident/detail stacks |
| Full Leaflet GIS page/sidebar | Full-screen native map, segmented modes, filter sheet, drilldown sheet |
| Side-by-side before/after evidence | Stacked horizontal evidence galleries |
| Desktop navigation/sidebar | Five or fewer role-appropriate tabs plus stacks/More |

## Remaining web-only features

| Feature | Reason |
| --- | --- |
| Admin System Monitoring | Current page is a desktop-oriented diagnostic surface. Its operational alert counts are already available on the mobile dashboard; no dedicated mobile-safe monitoring contract was introduced. |
| Admin Analytics charts | Mobile exposes operational summary/workload cards, rather than shrinking multi-series desktop charts. There is no separate aggregate analytics endpoint in the current mobile API layer. |
| Officer Stats page | The same task metrics are on Officer Home; a duplicate metrics-only screen would not improve field workflow. |
| Notification target deep links | The current notification contract exposes title/message/read state but no incident/task identifier. Mobile marks/refreshes notifications, but does not infer unsafe links from text. |

## Verification checklist

- TypeScript compilation covers the mobile navigation, API contracts, maps, and
  role screens.
- Expo remains SDK 54; no upgrade command was used.
- Role E2E requires authenticated Citizen, Officer, and Admin accounts. It must
  be performed against a running environment because neither the repository nor
  this task provides authorized role credentials.
