# Officer field validation

- `OFFICER_CHECKIN_RADIUS_METERS`: default **100 metres**.
- `OFFICER_CHECKIN_MAX_ACCURACY_METERS`: default **50 metres**. The existing
  `OFFICER_MAX_GPS_ACCURACY_METERS` is a fallback when the new key is absent.
  Shift GPS rules retain their existing configuration.
- `OFFICER_EVIDENCE_RADIUS_METERS`: defaults to the check-in radius. An explicit
  override remains supported for deployments with a different evidence radius.

Arrival and resolution evidence use the existing Haversine helper. Coordinates
are validated; GeoJSON is always `[longitude, latitude]`. Distances supplied by
clients are never trusted. Invalid accuracy/distance rejects the action before
any state write or RabbitMQ event.

Apply changes with `docker compose up -d --build alert-service`.

Resolution requires a verified check-in belonging to the assigned Officer and at
least one after-treatment photo with valid GPS within the evidence radius and
accuracy threshold. This deliberately rejects older clients that omit photo GPS;
update web/mobile clients to attach `evidence[].location`. `capturedAt` stays
optional for compatibility; omitted capture time is not invented. `uploadedAt`
is the server's resolution-receipt timestamp, not the capture time or media-upload time.

The service persists optional `materialsUsed` and `additionalNotes` (as
`resolutionNotes`), which were previously discarded. Existing model fields are
reused; no schema migration is required.

GPS is device-reported context, not cryptographic proof. These checks cannot
detect spoofed device GPS or prove an image's origin. The native mobile workflow
restricts evidence capture to live camera; Admin must still review the evidence.

Officer web obtains a fresh foreground GPS fix when submitting resolution
(`maximumAge: 0`). Existing uploaded photos receive this submission-location
context, not attested capture GPS. Web does not infer `capturedAt` from a file's
modification time. Permission denial/unavailable GPS stops submission with a
readable error; a verified mobile check-in is still required before resolution.
