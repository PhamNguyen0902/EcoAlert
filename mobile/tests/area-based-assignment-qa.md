# Area-based assignment — manual QA

All checkboxes below are **unverified on a physical device**. Automated Mongo/HTTP
tests are not substitutes for Expo Go/native camera, browser drawing or notifications.

## Setup

- [ ] Use a real Admin, Citizen and at least two active Officer accounts.
- [ ] Configure real Polygon/MultiPolygon jurisdiction via `/admin/service-areas`.
- [ ] Confirm coordinates are `[longitude, latitude]`, not address text/GPS guesswork.
- [ ] Add/remove Officers; check actual active/inactive state, shifts and workload.
- [ ] Edit vertices, delete a vertex/polygon, import a polygon with holes and save.
- [ ] Check overlaps, shared boundaries and priority/tie warnings.
- [ ] Confirm deactivate preserves historical assignment area snapshots.

## Happy path and fallback

- [ ] Two Officers start real shifts; give one existing active tasks.
- [ ] Citizen captures new evidence/GPS using existing live workflow and submits.
- [ ] Admin verifies; within worker poll interval, least-busy eligible Officer gets task.
- [ ] Officer Tasks and Map show the same task and exact incident GPS.
- [ ] Officer Profile shows real assigned area(s), long names wrap, load-more works.
- [ ] No area: remains VERIFIED; queue explains missing area, no fabricated area.
- [ ] Area without Officer, all off shift, inactive/deleted accounts and full capacity
  each leave VERIFIED with the appropriate readable reason.
- [ ] Configure eligible Officer/start shift, then explicit auto retry succeeds.
- [ ] Manual outside-area assignment needs explicit acknowledgement + reason.
- [ ] GIS offline: verification still saves, auto reports dependency unavailable;
  manual remains possible with acknowledgement and real active Officer.

## Refresh/security/concurrency

- [ ] Foreground refresh, pull-to-refresh and existing assignment socket update tasks.
- [ ] App background/offline → reconnect brings task without duplicate assignment.
- [ ] Empty/error/loading areas states do not block logout or other tabs.
- [ ] Citizen/Officer cannot mutate areas or call auto/manual assignment (403).
- [ ] Fake x-user-role without real Bearer JWT is rejected (401).
- [ ] Simultaneous manual/auto calls select one Officer and one assignment record.
- [ ] Several reports near capacity do not silently overfill under normal concurrency.
- [ ] Pause/crash worker: lease expires, job recovers; repeat verification/auto request
  cannot overwrite an already-assigned Officer.
- [ ] Interrupt RabbitMQ after assignment; status remains ASSIGNED; restored broker
  delivers pending outbox with stable IDs, no duplicate stored notification.

## Officer workflow regression

- [ ] Assigned Officer Start → accurate GPS Check-in → verified arrival.
- [ ] Unassigned Officer cannot start/check in/resolve another Officer's task.
- [ ] Poor/distant GPS is rejected; no fake check-in or evidence location.
- [ ] Resolution live camera keeps correct orientation and matches capture frame.
- [ ] Original/display URLs, watermark and YOLO boxes remain correct.
- [ ] Before/After comparison, real evidence metadata → RESOLVED → Admin CLOSE.
- [ ] Citizen capture/offline queue, AI analysis and pending classification still work.
- [ ] Logout, relogin, account switch and profile observer work for every role.

## Device/layout matrix

- [ ] iPhone portrait/landscape, safe areas, long area/address text and small widths.
- [ ] Android representative device.
- [ ] Admin desktop/tablet/mobile: map editor tools stay inside map, not over header.
- [ ] Browser polygon editor can save imported holes/MultiPolygon without losing them.

Known implementation limit: the 60-second dispatch lease is not transaction-fenced
under arbitrary long process suspension; cross-service geometry/shift/account edits
are eventually rechecked, not a distributed transaction. Manual dispatch can exceed
automatic capacity intentionally. Do not claim absolute global capacity/exactly-once
push transport or physical-device E2E completion without additional validation.
