#!/bin/sh
set -eu
# Keep daemon-restart support without a restart storm when graph data is absent.
not_ready() {
  echo "$1 Run scripts/osrm/prepare-hcm.ps1, then restart only osrm." >&2
  exec sleep infinity
}
test -s /data/active.txt || not_ready 'HCMC graph not prepared.'
active="$(cat /data/active.txt)"
echo "$active" | grep -Eq '^graphs/[a-f0-9]{64}-[0-9]{8}T[0-9]{6}$' || not_ready 'Invalid graph pointer.'
graph="/data/$active"
test -s "$graph/ecoalert-ready" || not_ready 'HCMC graph is incomplete.'
image="${OSRM_IMAGE:-ghcr.io/project-osrm/osrm-backend:v5.27.1}"
case "$(cat "$graph/ecoalert-ready")" in
  *" car $image") ;;
  *) not_ready 'Graph/image/profile mismatch.';;
esac
sh /scripts/validate-graph.sh "$graph" || not_ready 'HCMC sidecars are incomplete.'
threads="${OSRM_THREADS:-2}"
case "$threads" in ''|*[!0-9]*|0) not_ready 'Invalid OSRM_THREADS';; esac
echo "Serving persistent HCMC graph: $active (MLD, car)"
# INFO logs include request URLs (and therefore officer coordinates).
# Keep operational warnings/errors without recording every routing request.
exec osrm-routed --algorithm mld --mmap --verbosity WARNING --threads "$threads" --ip 0.0.0.0 --port 5000 "$graph/hcm.osrm"
