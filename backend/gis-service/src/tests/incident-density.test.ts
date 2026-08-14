import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeCategoryCode,
  normalizeSeverityCode,
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

test('incident density summaries normalize severity and category aliases without changing stored records', () => {
  assert.deepEqual(
    summarizeIncidentLocations([
      { status: 'PENDING', category: 'ILLEGAL DUMPING', severity: 'HIGH' },
      { status: 'pending', category: 'illegal-dumping', severity: 'high' },
      { status: 'resolved', category: 'illegal_dumping', severity: 'normal' },
    ]),
    {
      total: 3,
      open: 2,
      resolved: 1,
      closed: 0,
      byCategory: { illegal_dumping: 3 },
      bySeverity: { high: 2, medium: 1 },
    },
  );
  assert.equal(normalizeSeverityCode('unexpected legacy value'), 'unknown');
  assert.equal(normalizeCategoryCode(undefined), 'unclassified');
});
