# P1 operational management

## Scope

P1 adds operational decision support without introducing automated dispatch, predictive decisions, background location tracking, or any mutation through the assistant. It remains compatible with Expo SDK 54. The existing YOLO path is unchanged and SAM2 remains disabled.

## Admin incident density

`GET /api/v1/gis/incidents/heatmap` and `GET /api/v1/gis/incidents/nearby` are Admin-only endpoints. They read GIS `Location` documents populated from the existing `ALERT_CREATED` and `ALERT_UPDATED` events and use the existing `2dsphere` index. Both accept optional `from`, `to`, `category`, `severity`, and `status` filters; drilldown additionally accepts `lat`, `lng`, and a radius up to 20 km.

The Admin **Incident Density** experience has three selectable layers: **Heatmap**, **Incident Points**, and **Combined** (the default). Heatmap uses the concentration of real reported locations; Incident Points renders one marker for each valid GIS record; Combined renders both from the same `points` response and the same filters. It never describes the layer as temperature, a forecast, or a prediction.

Each marker contains the alert ID, category, severity, status, reported time, and available address. Selecting it highlights the record without resetting the map; **View details** opens the existing Admin report detail route. Invalid or absent coordinates are excluded instead of being invented. On the web, marker clustering protects the map when the result contains many points. Map clicks use the existing radius/`2dsphere` drilldown endpoint rather than triggering a complete reload while the user moves the map.

The Admin mobile route uses the same authenticated endpoints and response contract with native map interactions: Android uses the native heatmap layer, while iOS renders the existing intensity-area fallback. It exposes the same three modes, synchronized filters, marker preview, nearby drilldown, retry states, and the existing alert-detail screen. The mobile entry point is registered only in the Admin navigator; server-side role enforcement remains unchanged.

## Officer shifts and availability

Officers have one active `OfficerShift` at most. Starting and ending a shift requires an explicit foreground GPS position from the officer mobile app; no location watcher or background task is registered. The server validates coordinates and GPS accuracy, records start/end timestamps and location accuracy, and rejects a second active shift.

Admins use `GET /api/v1/alerts/officers/availability` to view the authoritative availability read model. It contains each Officer's on/off-shift state and task total calculated only from `ASSIGNED` plus `IN_PROGRESS` incidents. Workload thresholds are configuration values:

- `OFFICER_WORKLOAD_MODERATE_THRESHOLD=3`
- `OFFICER_WORKLOAD_HIGH_THRESHOLD=5`

The Admin assignment control still requires a manual selection. An off-shift or high-workload officer is shown with a warning and requires the Admin's normal confirmation; the platform does not auto-assign or block the manual operational decision.

## Operational assistant

The role-aware assistant remains server-side and read-only. It retrieves only:

- a Citizen's own reports;
- an Officer's assigned reports;
- authorized Admin incident aggregates.

For a next-step question, it returns status-based advisory guidance derived from the authorized record. Officer advice can recommend starting handling, foreground arrival check-in, evidence documentation, or awaiting review, but it never performs those actions. Admin advice links to incident density and asks the Admin to make the final decision. The assistant has no write tool, assignment tool, notification tool, or privileged client secret.

## Verification

- Alert-service test: workload threshold behavior.
- GIS-service test: density summary aggregation.
- AI-service test: operational guidance intent and authorization boundaries.
- Frontend production build and affected backend TypeScript builds.

## API and data guardrails

No mock incidents are returned by the new APIs. Heatmap data comes only from GIS alert records that have coordinates; deleted records are excluded. The API gateway continues to supply the authenticated role headers, and the GIS controller enforces `ADMIN` before accessing operational density data.
