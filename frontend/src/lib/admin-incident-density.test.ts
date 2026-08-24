import assert from 'node:assert/strict';
import test from 'node:test';
import {
  densityLayerVisibility,
  getDensityPointLatLng,
  incidentDetailHref,
  incidentReportCode,
  normalizeDensitySummary,
  toDensityHeatPoint,
} from './admin-incident-density';

test('admin map modes expose the intended layer combinations', () => {
  assert.deepEqual(densityLayerVisibility('heatmap'), { heatmap: true, incidents: false });
  assert.deepEqual(densityLayerVisibility('incidents'), { heatmap: false, incidents: true });
  assert.deepEqual(densityLayerVisibility('combined'), { heatmap: true, incidents: true });
});

test('every map-mode transition immediately exposes the target layers', () => {
  const transitions = [
    ['heatmap', 'incidents', { heatmap: false, incidents: true }],
    ['incidents', 'heatmap', { heatmap: true, incidents: false }],
    ['heatmap', 'combined', { heatmap: true, incidents: true }],
    ['combined', 'heatmap', { heatmap: true, incidents: false }],
    ['incidents', 'combined', { heatmap: true, incidents: true }],
    ['combined', 'incidents', { heatmap: false, incidents: true }],
  ] as const;

  for (const [from, to, expectedVisibility] of transitions) {
    assert.deepEqual(
      densityLayerVisibility(to),
      expectedVisibility,
      `${from} -> ${to} should expose the target layer combination immediately`,
    );
  }
});

test('real GIS points keep GeoJSON conversion explicit and ignore invalid coordinates', () => {
  assert.deepEqual(getDensityPointLatLng({ lat: 10.762622, lng: 106.660172 }), [10.762622, 106.660172]);
  assert.deepEqual(toDensityHeatPoint({ lat: 10.762622, lng: 106.660172, weight: 1.25 }), [10.762622, 106.660172, 1.25]);
  assert.equal(getDensityPointLatLng({ lat: 91, lng: 106.660172 }), null);
  assert.equal(toDensityHeatPoint({ lat: 10, lng: 181, weight: 1 }), null);
  assert.equal(incidentReportCode('6a7aad1ba781004fdeabab0c'), '#DEABAB0C');
  assert.equal(incidentDetailHref('report-123'), '/admin/reports/report-123');
});

test('operational summaries merge severity and category aliases into canonical groups', () => {
  assert.deepEqual(
    normalizeDensitySummary({
      bySeverity: { HIGH: 1, high: 2, normal: 3 },
      byCategory: { 'Illegal Dumping': 1, illegal_dumping: 2, 'illegal-dumping': 3 },
    }),
    {
      bySeverity: [['high', 3], ['medium', 3]],
      byCategory: [['illegal_dumping', 6]],
    },
  );
});
