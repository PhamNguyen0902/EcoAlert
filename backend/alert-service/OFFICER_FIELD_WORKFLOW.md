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

GPS is device-reported context, not cryptographic proof. These checks cannot
detect spoofed device GPS or prove an image's origin. The native mobile workflow
restricts evidence capture to live camera; Admin must still review the evidence.
