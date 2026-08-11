import assert from 'node:assert/strict';
import test from 'node:test';
import {
  densityLayerVisibility,
  getDensityPointLatLng,
  incidentReportCode,
  toDensityHeatPoint,
} from './admin-incident-density';

test('admin map modes expose the intended layer combinations', () => {
  assert.deepEqual(densityLayerVisibility('heatmap'), { heatmap: true, incidents: false });
  assert.deepEqual(densityLayerVisibility('incidents'), { heatmap: false, incidents: true });
  assert.deepEqual(densityLayerVisibility('combined'), { heatmap: true, incidents: true });
});

test('real GIS points keep GeoJSON conversion explicit and ignore invalid coordinates', () => {
  assert.deepEqual(getDensityPointLatLng({ lat: 10.762622, lng: 106.660172 }), [10.762622, 106.660172]);
  assert.deepEqual(toDensityHeatPoint({ lat: 10.762622, lng: 106.660172, weight: 1.25 }), [10.762622, 106.660172, 1.25]);
  assert.equal(getDensityPointLatLng({ lat: 91, lng: 106.660172 }), null);
  assert.equal(toDensityHeatPoint({ lat: 10, lng: 181, weight: 1 }), null);
  assert.equal(incidentReportCode('6a7aad1ba781004fdeabab0c'), '#DEABAB0C');
});
