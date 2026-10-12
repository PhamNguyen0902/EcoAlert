"""Cut only the configured HCMC polygon from an existing Vietnam PBF, offline."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform

ROOT = Path('/data')
SOURCE = Path('/source/vietnam-latest.osm.pbf')


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def run(*args):
    print('Running:', ' '.join(map(str, args)), flush=True)
    subprocess.run(args, check=True)


def main():
    config = json.loads(Path('/scripts/hcm-region.json').read_text())
    boundary_file = ROOT / 'sources/geoBoundaries-VNM-ADM1.geojson'
    if not SOURCE.is_file() or not boundary_file.is_file():
        raise RuntimeError('Missing input PBF/boundary. Run scripts/osrm/prepare-hcm.ps1 first.')
    if digest(boundary_file) != config['boundarySha256']:
        raise RuntimeError('Boundary checksum mismatch. Refusing an unverified routing region.')
    feature_list = json.loads(boundary_file.read_text())['features']
    matches = [f for f in feature_list if f['properties'].get(config['boundaryProperty']) == config['boundaryValue']]
    if len(matches) != 1:
        raise RuntimeError('Boundary must select exactly one municipality.')
    geometry = shape(matches[0]['geometry'])
    if not geometry.is_valid or geometry.geom_type not in ('Polygon', 'MultiPolygon'):
        raise RuntimeError('Invalid municipality polygon.')
    # A metre-based buffer in UTM 48N, not a hand-picked lat/lng bounding box.
    to_metric = Transformer.from_crs('EPSG:4326', config['metricCrs'], always_xy=True).transform
    to_wgs84 = Transformer.from_crs(config['metricCrs'], 'EPSG:4326', always_xy=True).transform
    if not 5000 <= config['bufferMeters'] <= 10000:
        raise RuntimeError('Use a documented 5–10 km buffer.')
    buffered = transform(to_wgs84, transform(to_metric, geometry).buffer(config['bufferMeters'], resolution=8))
    coverage = {'type': 'Feature', 'properties': config, 'geometry': mapping(buffered)}
    coverage_text = json.dumps(coverage, sort_keys=True, separators=(',', ':'))
    source_sha = digest(SOURCE)
    fingerprint = hashlib.sha256((source_sha + coverage_text + 'smart:restriction:v1').encode()).hexdigest()
    manifest_path = ROOT / 'extract-manifest.json'
    if manifest_path.is_file() and (ROOT / 'hcm.osm.pbf').is_file() and (ROOT / 'coverage.geojson').is_file():
        old = json.loads(manifest_path.read_text())
        if old.get('fingerprint') == fingerprint and old.get('pbfSha256') == digest(ROOT / 'hcm.osm.pbf') and (ROOT / 'coverage.geojson').read_text() == coverage_text and os.environ.get('OSRM_FORCE') != '1':
            run('osmium', 'fileinfo', '-e', str(ROOT / 'hcm.osm.pbf'))
            print('HCMC input is already valid; no extraction required.', flush=True)
            return
    job = ROOT / ('extract-' + time.strftime('%Y%m%dT%H%M%S') + '-' + str(os.getpid()))
    job.mkdir()
    polygon_path = job / 'coverage.geojson'
    polygon_path.write_text(coverage_text)
    pbf = job / 'hcm.osm.pbf'
    # Complete roads and turn restrictions at the border, without pulling huge
    # country boundaries/multipolygon relations back into this city extract.
    run('osmium', 'extract', '--verbose', '--polygon', str(polygon_path),
        '--strategy', 'smart', '-S', 'types=restriction',
        '--set-bounds', '--output-header=osmosis_replication_timestamp!',
        str(SOURCE), '--output', str(pbf))
    run('osmium', 'fileinfo', '-e', str(pbf))
    run('osmium', 'check-refs', str(pbf))
    if not pbf.stat().st_size:
        raise RuntimeError('Empty HCMC PBF.')
    peak_file = Path('/sys/fs/cgroup/memory.peak')
    manifest = {**config, 'source': 'Geofabrik Vietnam / OpenStreetMap contributors (ODbL)',
                'sourcePbfSha256': source_sha, 'fingerprint': fingerprint,
                'pbfSha256': digest(pbf), 'pbfBytes': pbf.stat().st_size,
                'coverageBounds': list(buffered.bounds), 'areaKm2': transform(to_metric, buffered).area / 1e6,
                'peakMemoryBytes': int(peak_file.read_text()) if peak_file.is_file() else None}
    # Publish only after every command succeeds; existing graphs are untouched.
    pbf.replace(ROOT / 'hcm.osm.pbf')
    polygon_path.replace(ROOT / 'coverage.geojson')
    candidate = job / 'extract-manifest.json'
    candidate.write_text(json.dumps(manifest, indent=2) + '\n')
    candidate.replace(manifest_path)
    print(json.dumps(manifest, indent=2), flush=True)


if __name__ == '__main__':
    main()
