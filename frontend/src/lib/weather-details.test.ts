import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatProviderLocalTime,
  isValidWeatherCoordinate,
  parseWeatherCoordinates,
  providerLocalDateKey,
  weatherAqiLabelKey,
  weatherDetailsSearch,
} from './weather-details';

test('weather detail coordinates round safely and reject invalid values', () => {
  assert.deepEqual(
    parseWeatherCoordinates(new URLSearchParams('lat=10.82314&lng=106.62976')),
    { lat: 10.823, lng: 106.63 },
  );
  assert.equal(
    parseWeatherCoordinates(new URLSearchParams('lat=200&lng=106.63')),
    null,
  );
  assert.equal(isValidWeatherCoordinate(0, 0), true);
});

test('weather detail URL retains the exact resolved coordinate pair', () => {
  assert.equal(
    weatherDetailsSearch({ lat: 10.82314, lng: 106.62976 }),
    '?lat=10.823&lng=106.63',
  );
});

test('forecast time and day use the provider timezone rather than browser timezone', () => {
  assert.equal(
    formatProviderLocalTime('2026-08-11T06:30:00.000Z', 25_200, 'en-GB'),
    '13:30',
  );
  assert.equal(
    providerLocalDateKey('2026-08-11T20:30:00.000Z', 25_200),
    '2026-08-12',
  );
});

test('AQI display follows the same provider index interpretation as Mobile', () => {
  assert.equal(weatherAqiLabelKey(1), 'weather.aqi_good');
  assert.equal(weatherAqiLabelKey(3), 'weather.aqi_moderate');
  assert.equal(weatherAqiLabelKey(9), 'weather.aqi_unknown');
});
