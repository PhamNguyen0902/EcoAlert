import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeIncidentDensityCategory,
  normalizeIncidentDensitySeverity,
  summarizeIncidentLocations,
} from '../services/gis.service';

test('incident density summary groups real incident status, category, and severity', () => {
  assert.deepEqual(
    summarizeIncidentLocations([
      { status: 'ASSIGNED', category: 'illegal_dumping', severity: 'high' },
      { status: 'in_progress', category: 'illegal_dumping', severity: 'high' },
      { status: 'closed', category: 'water_pollution', severity: 'low' },
    ]),
    {
      total: 3,
      open: 2,
      resolved: 0,
      closed: 1,
      byCategory: { illegal_dumping: 2, water_pollution: 1 },
      bySeverity: { high: 2, low: 1 },
    },
  );
});

test('incident density summary normalizes legacy category and severity aliases', () => {
  assert.deepEqual(
    summarizeIncidentLocations([
      { status: 'PENDING', category: 'Illegal Dumping', severity: 'HIGH' },
      { status: 'assigned', category: 'illegal-dumping', severity: 'high' },
      { status: 'closed', category: 'ILLEGAL_DUMPING', severity: 'normal' },
    ]),
    {
      total: 3,
      open: 2,
      resolved: 0,
      closed: 1,
      byCategory: { illegal_dumping: 3 },
      bySeverity: { high: 2, medium: 1 },
    },
  );
  assert.equal(normalizeIncidentDensityCategory(' Water Pollution '), 'water_pollution');
  assert.equal(normalizeIncidentDensitySeverity('NORMAL'), 'medium');
});
