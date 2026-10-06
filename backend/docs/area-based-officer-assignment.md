# Area-based Officer assignment

## Scope and ownership

GIS Service owns `ServiceArea` and all spatial matching. User Service owns account
eligibility. Alert Service owns shifts, workload, dispatch, audit, status transitions,
durable dispatch jobs and notification outbox. Web configures real boundaries and
rosters; Officer Mobile consumes its own areas/tasks. No seeded/fake wards, Officers,
notifications, GPS coordinates or push transport were added.

Existing citizen live camera, original/display evidence, watermark, YOLO, offline
queue, check-in, resolution and authentication flows are preserved. AI completion
no longer writes an old status over a concurrent assignment.

## Data models and indexes

`gis-service/src/models/service-area.model.ts`:

- Unique uppercase `code`, `name`, `administrativeLevel` (`WARD`, `DISTRICT`, `CUSTOM`).
- Optional `parentCode`; hierarchy is informational, not inferred from addresses.
- `geometry`: GeoJSON Polygon or MultiPolygon, coordinates `[longitude, latitude]`.
- `assignedOfficerIds`: many-to-many roster, at most 100 IDs per area.
- `isActive`, integer `priority`, `createdBy`, `updatedBy`, timestamps.
- Indexes: unique code; geometry **2dsphere**; active + assignedOfficerIds.
- DELETE only deactivates; old assignment area ID/name/code snapshots remain intact.

The DTO rejects nonfinite/out-of-range coordinates, empty/open rings, unsupported
geometry, duplicate case-normalized Officer IDs and invalid/self-crossing polygons
using Turf booleanValid/kinks. Limits: 50 polygons, 50 rings/polygon, 2,000 positions/ring;
HTTP body capped at 2 MB. Complex geometry may still be rejected by Mongo's spherical
index; Admin should validate official boundaries before import.

Alert additions are optional/backward-compatible:

```ts
assignmentMethod?: 'AUTO' | 'MANUAL';
assignedAreaId?: string;
assignedAreaCode?: string;
assignedAreaName?: string;
assignmentReason?: string;
assignmentAudit?: {
  activeTaskCountAtSelection?: number;
  triggeredBy: string;
  actorId: string;
  assignedAt: Date;
  outsideAreaOverride: boolean;
};
lastAssignmentAttempt?: { reason: string; attemptedAt: Date; triggeredBy: string };
autoAssignmentJob?: { pending: boolean; actorId: string; attempts: number; nextAttemptAt: Date; /* claim lease */ };
assignmentEvent?: { eventId: string; payload: object; attempts: number; nextAttemptAt: Date; deliveredAt?: Date; /* claim lease */ };
```

Old `assignedOfficerId/Name/Email`, `assignedAt`, timeline/status history are retained;
`assignedBy` is now consistently saved. New indexes cover job pending/next-attempt
and outbox delivered/next-attempt. Existing assignedOfficer/status index supports
workload aggregation. No new AlertStatus was introduced.

## Spatial matching and ranking

`ServiceAreaService.matchServiceArea(lng, lat)` queries active polygons using MongoDB
`$geoIntersects` with an actual GeoJSON Point. It handles holes, boundaries and
MultiPolygon; no reverse-geocoding text, nearest-Officer or radius heuristic.

Overlaps are deterministic: priority descending, code ascending, ID ascending.
Return both the selected area and overlap metadata. More than 100 matches returns
an explicit configuration error, not an arbitrary area. Admin sees warnings in
assignment preview and the saved-area editor's overlap check (shared boundaries
may also count as intersections).

Candidate pool is strictly the selected area's roster. Officer must exist, have
role OFFICER, be active and not deleted. Batch identity queries are signed internal
calls to User Service; no N+1 public user lookups. Reuse
`OfficerShiftService.getAvailability`: `ON_SHIFT` requires an actual ACTIVE shift,
not app presence or first-shift GPS proximity.

Active workload = ASSIGNED + IN_PROGRESS only. RESOLVED/CLOSED/REJECTED do not count.
Exclude counts at/above configured maximum. Rank remaining Officers by active count;
ties prefer oldest reliable historical `assignedAt` if all eligible candidates have
history, otherwise stable ID order. Historical timestamps include completed tasks.
Missing legacy history is not pretended to mean "never assigned". No random selection.

## Trigger, retry and events

1. Admin PATCH status verifies JWT and only allows PENDING/AI_ANALYZING → VERIFIED
   or REJECTED. It cannot bypass dispatch by setting ASSIGNED directly.
2. VERIFIED and its `autoAssignmentJob` are written **in the same DB update**.
3. Worker starts with Alert Service; polls every 10 seconds, max 10 jobs per tick,
   claims a 120-second lease, then invokes `autoAssignOfficer` using the persisted
   Admin actor. No forged JWT or external role header is used by the worker.
4. GIS/User errors keep VERIFIED with `lastAssignmentAttempt.reason`. Dependency/
   busy errors retry up to five attempts; backoff is bounded. Other failures remain
   visible for Admin manual dispatch or explicit auto retry.
5. Successful assignment and its `assignmentEvent` are saved atomically together.
6. Publish existing `OFFICER_ASSIGNED`, then `ALERT_UPDATED` with
   `workflowNotificationHandled: true`. Payload includes alertId, officerId and
   assignedOfficerId, assignmentMethod, areaId/assignedAreaId and timestamp.

Outbox claims a 30-second lease and publishes through a RabbitMQ confirm channel
with 5-second confirmation timeout. Stable event IDs are reused on every retry.
The existing Notification Service `createOnce` recipient/event unique index prevents
duplicate persisted notifications. Socket delivery can repeat: mobile invalidation
is safe to repeat. This is **at-least-once**, not end-to-end exactly-once messaging.

Publication failure never rolls back ASSIGNED. Retry is capped to 20 outbox records
per tick, with backoff up to five minutes; pending events are retained until delivered.
Connection close schedules RabbitMQ reconnect. Operators can inspect event attempts,
lastError, nextAttemptAt and deliveredAt without exposing service credentials.

Verification broker failures do not fail an already-saved verification. The new
durable guarantee covers assignment events; historical review/create/start/resolve
events are not all migrated to an outbox in this task.

## Concurrency and limitations

Both manual and auto acquire the same Mongo singleton dispatch lease, owner UUID,
60-second expiry, conditional acquisition and owner-specific release. Expired leases
are reclaimable after crashes; ownership is rechecked/renewed before commit. Auto
rechecks geometry/roster and actual shift/workload inside the lease.

Common `AlertService.commitOfficerAssignment` uses `findOneAndUpdate` conditional on
VERIFIED, `assignedOfficerId: null` (matches missing or null), undeleted document and
unchanged expected coordinates. Same-Alert races have only one winner, one audit and
one durable assignment event. Repeated requests return ALREADY_ASSIGNED; no reassignment.

Normal cross-Alert concurrency is serialized and rechecks capacity. This is **not a
multi-document transaction/fenced reservation**: an extraordinary process pause
longer than lease TTL after the final ownership check could allow competing dispatch
to select stale workload. Geometry, user status and shift can also change in another
service between final lookup and commit. These limits are explicit; no strict global
capacity guarantee under arbitrary process suspension or cross-service edits is
claimed. Production scale requiring that guarantee needs transactional capacity
reservations/fencing on a replica set. Manual Admin dispatch can exceed automatic
capacity or use an off-shift Officer deliberately; its selection workload is audited.

## Manual fallback

POST assign still supports `{ officerId }` for ordinary in-area dispatch (and locations
without configured boundaries). Outside a matched area's roster, or when GIS is
unavailable, requires `{ overrideConfirmed: true, assignmentReason: '...' }`.
Reason must be 5–1,000 characters at the API boundary and is stored with an override
audit. Account eligibility remains mandatory. No inferred/fake area is recorded when
GIS is unavailable. Admin UI provides the explicit checkbox and reason input.

## API contracts and authorization

Through Gateway (existing proxy mapping):

| Method/path | Permission / purpose |
| --- | --- |
| GET/POST `/api/v1/gis/service-areas` | ADMIN paginated list/create |
| GET/PATCH/DELETE `/api/v1/gis/service-areas/:id` | ADMIN detail/update/deactivate |
| PUT `/api/v1/gis/service-areas/:id/officers` | ADMIN `{officerIds}` validated against User Service |
| GET `/api/v1/gis/service-areas/:id/overlaps` | ADMIN saved-geometry intersections |
| GET `/api/v1/gis/service-areas/mine` | OFFICER own active areas; no client Officer ID accepted |
| GET `/api/v1/alerts/:id/assignment-preview` | ADMIN read-only, no mutation |
| POST `/api/v1/alerts/:id/auto-assign` | ADMIN explicit retry |
| POST `/api/v1/alerts/:id/assign` | ADMIN manual assignment/override |
| GET `/api/v1/alerts?unassigned=true` | ADMIN VERIFIED + no Officer, server-side pagination |

Preview/result reason codes: AUTO_ASSIGNED, AREA_NOT_FOUND, NO_OFFICER_IN_AREA,
NO_ACTIVE_SHIFT, CAPACITY_REACHED, NO_ELIGIBLE_OFFICER, INVALID_LOCATION,
DEPENDENCY_UNAVAILABLE, ALREADY_ASSIGNED, NOT_VERIFIED, DISABLED, ASSIGNMENT_BUSY.

Internal read-only POST APIs: GIS `/service-areas/internal/match`, User
`/api/v1/internal/officers/lookup` (batch IDs or paginated directory). HMAC-SHA256
signs caller identity, timestamp, method, exact URL and JSON body; 30-second validity,
allowed service names, timing-safe comparison. Client role headers are never credentials.
Retries: two attempts, five seconds each. Secret must have at least 16 characters.

New GIS routes verify real HS256 Bearer JWTs independently. Alert routes also verify
JWT instead of trusting x-user-id. Gateway strips client identity and internal-signature
headers before forwarding, then derives identity from JWT. Gateway remains the
revocation/Redis blacklist boundary; keep individual services internal, as in Compose.

## Configuration / deployment

```env
AUTO_ASSIGN_ENABLED=true
AUTO_ASSIGN_REQUIRE_ACTIVE_SHIFT=true
AUTO_ASSIGN_MAX_ACTIVE_TASKS=5
GIS_SERVICE_URL=http://gis-service:3004
USER_SERVICE_URL=http://user-service:3001
JWT_SECRET=<existing strong shared JWT key>
SERVICE_AUTH_SECRET=<strong server-only key shared by GIS/User/Alert>
```

Compose defaults internal secret to existing JWT_SECRET for backward deployment
compatibility; a separate strong internal key is recommended. Never put either secret
in EXPO_PUBLIC/VITE variables. Existing workload NORMAL/MODERATE/HIGH thresholds
remain unchanged (defaults 3/5); capacity is a separate dispatch rule.

No database reset, volume removal or migration/backfill of existing reports. Old
VERIFIED reports appear in the unassigned queue and can be retried manually. Turning
the flag off stops auto dispatch; manual dispatch remains available.

```powershell
docker compose build user-service alert-service gis-service api-gateway
docker compose up -d --no-deps user-service gis-service alert-service api-gateway
docker compose ps
```

All changed images built and all containers were healthy in local validation;
Gateway still exposes 3000. Real signed Alert → GIS/User read-only smoke requests
succeeded. No real area was seeded; Admin must import/draw the actual jurisdiction.

## UI / mobile

`/admin/service-areas`: create/edit/deactivate, Leaflet.draw polygon/vertex editing,
multiple polygon support, GeoJSON geometry/Feature import, actual Officer status/
shift/workload checkboxes, overlap warnings. `/admin/reports` has server-filtered
unassigned queue and read-only preview + explicit auto retry. Report detail retains
manual dispatch and shows assignment method/area snapshot.

Officer Profile displays own assigned areas with loading/error/empty/load-more states.
Existing officer:assigned/alert:updated socket invalidation is reused. App foreground
refreshes tasks, areas and current shift; existing task/map APIs, pull-to-refresh,
logout and notification transport are preserved.

## Automated verification (local, 2026-10-06)

- Shared, GIS, Alert, User and Gateway TypeScript builds.
- GIS tests: schema/auth and real Mongo geoIntersects (inside/outside/boundary,
  hole, MultiPolygon, inactive, overlapping priorities/tie, no Officers, invalid GPS).
- Alert tests: eligibility/ranking/flags; real Mongo CAS/lease/cross-report capacity,
  verification worker, failure audit, manual override and stable outbox retries.
- HTTP integration: actual GIS and internal User routers, real separate Mongo
  databases and actual Alert worker/tasks/areas, then Officer start/check-in/
  GPS-tagged resolution and Admin close. Only RabbitMQ publication is
  captured in this test; it does not send synthetic production notifications.
- Existing strict GPS/check-in/resolution regression tests retained.
- Frontend typecheck/build, actual `frontend/tests/*.test.cjs` tests. Existing
  `npm test` references previously removed files; run `node --test tests/*.test.cjs`.
- Mobile typecheck and all CJS regression tests, including Profile areas/logout.

Final local results: GIS **5/5**, Alert **56/56**, frontend **5/5**, mobile
**98/98**; no skipped tests when running with TEST_MONGO_URI. All listed builds
and frontend/mobile typechecks passed. Additional tests cover no-match/empty roster
failure audit, disabled auto flag with manual dispatch, expired lease recovery and
stale-coordinate CAS rejection. These counts include existing regression tests.

Docker npm install reports high/critical dependency audit findings in the current
dependency graph. Broad dependency upgrades/audit remediation were not performed
as part of dispatch implementation; evaluate them separately before production.

Real Mongo tests only accept database names prefixed `ecoalert_assignment_test_`,
create disposable fixtures and drop those test databases afterwards. Existing project
databases/volumes are untouched. HTTP integration requires GIS/User dist builds first.

```powershell
# In backend/alert-service (after shared, GIS and User builds):
$env:TEST_MONGO_URI='mongodb://127.0.0.1:27017/ecoalert_assignment_test_alert_local'
node --test dist/tests/*.test.js
# In backend/gis-service:
$env:TEST_MONGO_URI='mongodb://127.0.0.1:27017/ecoalert_assignment_test_gis_local'
node --test dist/tests/*.test.js
```

Without TEST_MONGO_URI, DB integration tests are explicitly skipped, not counted as
E2E passes. Physical iPhone capture → real Admin browser polygon editing → broker/
notification → Officer foreground/background → resolution/CLOSE is **not verified**
by these tests. Follow the unchecked device checklist in
`mobile/tests/area-based-assignment-qa.md`. Production jurisdiction topology and
arbitrary long process-pause fencing also remain outside tested guarantees.

## Changed-file map

- `backend/shared`: service-area types, service-auth helpers/exports and JWT dependency.
- `backend/gis-service`: ServiceArea model/DTO/service/router, app body limit,
  error handling, dependencies and spatial/security tests.
- `backend/user-service`: signed minimal Officer directory router and mount.
- `backend/alert-service`: models/DTO/env/controller/router/server; user/area directory,
  shift availability, assignment engine/lease/outbox/worker, RabbitMQ confirmations,
  common assignment/status/late-AI protection and tests.
- `backend/api-gateway/src/server.ts`, `docker-compose.yml`: header sanitation and service env.
- `frontend`: ServiceAreas route/sidebar translation, geometry editor, preview, unassigned
  queue, manual override/detail metadata, service/types/hooks, dependency and tests.
- `mobile`: areas API/hook, OfficerProfile, foreground invalidation and Profile tests.
- This architecture guide and mobile QA checklist.
