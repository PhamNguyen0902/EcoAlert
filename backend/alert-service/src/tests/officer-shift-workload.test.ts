import assert from 'node:assert/strict';
import test from 'node:test';
import { getWorkloadLevel } from '../services/officer-shift.service';

test('officer workload levels use assigned plus in-progress task totals', () => {
  assert.equal(getWorkloadLevel(0), 'NORMAL');
  assert.equal(getWorkloadLevel(2), 'NORMAL');
  assert.equal(getWorkloadLevel(3), 'MODERATE');
  assert.equal(getWorkloadLevel(4), 'MODERATE');
  assert.equal(getWorkloadLevel(5), 'HIGH');
});
