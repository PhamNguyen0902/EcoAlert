#!/bin/sh
set -eu
cd /data
test -s hcm.osm.pbf && test -s coverage.geojson && test -s extract-manifest.json || {
  echo 'HCMC input missing. Run scripts/osrm/prepare-hcm.ps1; Vietnam-wide extraction is disabled.' >&2
  exit 1
}
# Also protects callers that bypass the PowerShell single-job lock.
mkdir .graph-prepare-lock 2>/dev/null || { echo 'Another graph job or stale lock exists; inspect it before retrying.' >&2; exit 1; }
trap 'rmdir /data/.graph-prepare-lock' EXIT
image="${OSRM_IMAGE:-ghcr.io/project-osrm/osrm-backend:v5.27.1}"
threads="${OSRM_THREADS:-2}"
case "$threads" in ''|*[!0-9]*|0) echo 'Invalid OSRM_THREADS' >&2; exit 1;; esac
fingerprint="$( { sha256sum hcm.osm.pbf coverage.geojson /scripts/prepare.sh; printf '%s\n' "car $image"; } | sha256sum | cut -d ' ' -f1)"
if test -s active.txt && test "${OSRM_FORCE:-0}" != 1; then
  active="$(cat active.txt)"
  echo "$active" | grep -Eq '^graphs/[a-f0-9]{64}-[0-9]{8}T[0-9]{6}$' || { echo 'Invalid active graph pointer.' >&2; exit 1; }
  if test -s "$active/ecoalert-ready" && test "$(cat "$active/ecoalert-ready")" = "$fingerprint car $image"; then
    sh /scripts/validate-graph.sh "/data/$active"
    osrm-routed --algorithm mld --mmap --trial=on "/data/$active/hcm.osrm"
    echo 'Existing HCMC graph is valid; extract/partition/customize skipped.'
    exit 0
  fi
fi
job="build-$(date -u +%Y%m%dT%H%M%S)-$$"
mkdir "$job"
cd "$job"
cp ../hcm.osm.pbf hcm.osm.pbf
cp ../coverage.geojson ../extract-manifest.json .
echo '[1/3] osrm-extract HCMC (car profile)'
osrm-extract -p /opt/car.lua --disable-location-cache --threads "$threads" hcm.osm.pbf
echo '[2/3] osrm-partition HCMC (MLD)'
osrm-partition --threads "$threads" hcm.osrm
echo '[3/3] osrm-customize HCMC (MLD)'
osrm-customize --threads "$threads" hcm.osrm
sh /scripts/validate-graph.sh "/data/$job"
osrm-routed --algorithm mld --mmap --trial=on "/data/$job/hcm.osrm"
if test -r /sys/fs/cgroup/memory.peak; then
  printf 'peakMemoryBytes=%s\n' "$(cat /sys/fs/cgroup/memory.peak)" | tee preparation-metrics.txt
fi
printf '%s\n' "$fingerprint car $image" > ecoalert-ready
cd /data
mkdir -p graphs
target="graphs/$fingerprint-$(date -u +%Y%m%dT%H%M%S)"
mv "$job" "$target"
# Keep every prior graph; only publish a tiny pointer after validation succeeds.
printf '%s\n' "$target" > active.next
mv -f active.next active.txt
echo "HCMC MLD car graph ready: $target. No preprocessing runs at startup."
