#!/bin/sh
set -eu
base="$1/hcm.osrm"
# OSRM v5 MLD has no plain .osrm file; these sidecars are the actual graph.
for suffix in properties timestamp names geometry nbg_nodes edges ebg_nodes \
  ramIndex fileIndex datasource_names icd tld tls turn_duration_penalties \
  turn_weight_penalties turn_penalties_index partition cells cell_metrics mldgr; do
  test -s "$base.$suffix" || { echo "Incomplete graph: missing $base.$suffix" >&2; exit 1; }
done
test -s "$1/coverage.geojson" && test -s "$1/extract-manifest.json"
