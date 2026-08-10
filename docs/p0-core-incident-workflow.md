# EcoAlert P0 – Core Incident Workflow

## Purpose

P0 turns a submitted report into an auditable operational workflow. AI assists the citizen and Admin; it never verifies, assigns, resolves, or closes an incident.

## Image validation and classification

After a citizen uploads a temporary report image, the semantic AI service returns `VALID`, `UNCERTAIN`, `INVALID`, or `UNAVAILABLE` with a concise reason, model name, timestamp, confidence, and an optional supported category suggestion. Clearly unrelated images (`INVALID`) cannot create an Alert. `UNCERTAIN` and `UNAVAILABLE` remain manually reportable.

AI suggestions are restricted to visual categories: illegal dumping, construction waste, water pollution, air pollution, illegal burning, flooding, and fallen trees. Low-confidence, unsupported, unavailable, and ambiguous results have no forced suggestion and remain `UNCLASSIFIED`.

`classification` is deliberately separate from workflow status. Its states are `AI_SUGGESTED`, `USER_CONFIRMED`, `USER_CORRECTED`, `ADMIN_CONFIRMED`, `ADMIN_CORRECTED`, and `UNCLASSIFIED`. It keeps the original AI suggestion/confidence/reason, the citizen selection, and Admin confirmation/correction. The legacy `category` mirrors the final human category for backwards compatibility; old Alerts without these fields remain viewable.

## Workflow and responsibilities

```text
Citizen reports → PENDING → Admin verifies → VERIFIED → Admin assigns → ASSIGNED
→ assigned Officer starts → IN_PROGRESS → verified GPS check-in + after evidence
→ Officer resolves → RESOLVED → Admin reviews before/after → CLOSED
```

Only Citizens create their own reports. Only Admins verify, assign, correct classification, and close. Only the assigned Officer can start, check in, or resolve. Each transition and check-in creates server-side timeline/history evidence and reuses the existing RabbitMQ workflow notifications.

## GPS check-in and after evidence

Officer mobile check-in requests foreground location at the time of the action; it does not use background location tracking. The server calculates Haversine distance from the incident GeoJSON point (`[longitude, latitude]`) and records a successful `checkIn` only when both checks pass:

- `OFFICER_CHECKIN_RADIUS_METERS` (default `50` m)
- `OFFICER_MAX_GPS_ACCURACY_METERS` (default `100` m)

Too-far and poor-accuracy readings return a business error and do not record arrival. Resolution requires an assigned Officer, `IN_PROGRESS`, a verified check-in, notes/treatment information, and at least one after-treatment image. After evidence stores capture timestamp and, when mobile GPS is available, GeoJSON location, accuracy, and server-calculated distance. Evidence outside `OFFICER_EVIDENCE_RADIUS_METERS` (default `50` m) is rejected as on-site evidence.

Admin closure additionally requires a resolved timestamp, assigned Officer, and after-treatment evidence. The Admin screen presents citizen before images alongside officer after images, resolution notes, and check-in evidence.

## Limitations

GPS check-in is practical operational evidence, not a cryptographically tamper-proof anti-spoofing guarantee. It intentionally avoids surveillance and continuous background tracking.

The custom YOLO26n V1 detector remains the specialized detector for its six waste-object classes (`plastic_bottle`, `plastic_bag`, `plastic_cup`, `metal_can`, `cardboard`, `glass_bottle`). Its absence of detection is never treated as proof that an environmental incident is invalid. SAM2 remains disabled (`VISION_SEGMENTATION_ENABLED=false`).
