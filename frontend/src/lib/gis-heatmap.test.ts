import assert from 'node:assert/strict';
import test from 'node:test';
import type { Alert } from '@/types';
import {
  buildHeatPoints,
  filterIncidentsForMap,
  getNormalizedSeverityWeight,
  getSeverityWeight,
  normalizeMapCategory,
} from './gis-heatmap';

const createAlert = (overrides: Partial<Alert> = {}): Alert => ({
  _id: 'alert-1',
  title: 'Canal pollution',
  description: 'Polluted water near a residential area',
  status: 'verified',
  category: 'water_pollution',
  severity: 'medium',
  mediaUrls: [],
  location: { type: 'Point', coordinates: [106.74335, 10.84343] },
  address: 'Thu Duc City',
  citizenId: 'citizen-1',
  resolutionEvidence: [],
  statusHistory: [],
  timeline: [],
  isDeleted: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
});

test('buildHeatPoints reverses GeoJSON coordinates and normalizes intensity', () => {
  const points = buildHeatPoints([
    createAlert({ severity: 'critical' }),
  ]);

  assert.deepEqual(points, [[10.84343, 106.74335, 1]]);
});

test('severity weights are ordered critical > high > medium > low', () => {
  assert.ok(getSeverityWeight('critical') > getSeverityWeight('high'));
  assert.ok(getSeverityWeight('high') > getSeverityWeight('medium'));
  assert.ok(getSeverityWeight('medium') > getSeverityWeight('low'));
  assert.equal(getNormalizedSeverityWeight('low'), 0.2);
});

test('invalid coordinates are ignored while zero coordinates remain valid', () => {
  const points = buildHeatPoints([
    createAlert({ _id: 'invalid-latitude', location: { type: 'Point', coordinates: [106, 91] } }),
    createAlert({ _id: 'invalid-longitude', location: { type: 'Point', coordinates: [181, 10] } }),
    createAlert({ _id: 'not-finite', location: { type: 'Point', coordinates: [106, Number.NaN] } }),
    createAlert({ _id: 'zero', location: { type: 'Point', coordinates: [0, 0] }, severity: 'low' }),
  ]);

  assert.deepEqual(points, [[0, 0, 0.2]]);
});

test('shared search, severity, category, and status filters drive heatmap inputs', () => {
  const incidents = [
    createAlert({ _id: 'active-high', severity: 'high', status: 'in_progress' }),
    createAlert({ _id: 'resolved-high', severity: 'high', status: 'resolved' }),
    createAlert({ _id: 'active-low', severity: 'low', category: 'flooding', status: 'pending' }),
  ];
  const filtered = filterIncidentsForMap(incidents, {
    search: 'canal',
    severity: 'high',
    category: 'water_pollution',
    status: 'active',
  });

  assert.deepEqual(filtered.map((incident) => incident._id), ['active-high']);
  assert.equal(buildHeatPoints(filtered).length, 1);
});

test('category keys normalize API casing, spaces, underscores, and hyphens', () => {
  assert.equal(normalizeMapCategory('AIR POLLUTION'), 'air_pollution');
  assert.equal(normalizeMapCategory('air-pollution'), 'air_pollution');
  assert.equal(normalizeMapCategory(' air_pollution '), 'air_pollution');

  const filtered = filterIncidentsForMap(
    [createAlert({ category: 'WATER POLLUTION' as Alert['category'] })],
    {
      search: '',
      severity: 'all',
      category: 'water_pollution',
      status: 'all',
    },
  );
  assert.equal(filtered.length, 1);
});

test('empty incident data produces an empty heat point collection', () => {
  assert.deepEqual(buildHeatPoints([]), []);
});
