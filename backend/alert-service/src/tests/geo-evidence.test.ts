import assert from 'node:assert/strict';
import test from 'node:test';
import { haversineDistanceMeters, isValidLatitude, isValidLongitude } from '../utils/geo-evidence.util';

const latitudeOffset = (meters: number) => meters / 111_195;

test('Haversine distance supports the check-in radius boundary', () => {
  const latitude = 10.7769;
  const longitude = 106.7009;
  assert.ok(haversineDistanceMeters(latitude, longitude, latitude + latitudeOffset(18), longitude) < 20);
  assert.ok(haversineDistanceMeters(latitude, longitude, latitude + latitudeOffset(49), longitude) <= 50);
  assert.ok(haversineDistanceMeters(latitude, longitude, latitude + latitudeOffset(51), longitude) > 50);
  assert.ok(haversineDistanceMeters(latitude, longitude, latitude + latitudeOffset(800), longitude) > 700);
});

test('latitude and longitude validity uses real geographic bounds', () => {
  assert.equal(isValidLatitude(91), false);
  assert.equal(isValidLongitude(-181), false);
  assert.equal(isValidLatitude(10.7769), true);
  assert.equal(isValidLongitude(106.7009), true);
});
