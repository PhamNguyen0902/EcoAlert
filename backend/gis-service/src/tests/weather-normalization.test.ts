import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateDailyForecast,
  normalizeForecastEntries,
  providerLocalDateKey,
} from '../services/weather-normalization';

const entry = (
  timestamp: number,
  temperature: number,
  precipitationProbability = 0.25,
) => ({
  dt: timestamp,
  main: {
    temp: temperature,
    feels_like: temperature + 1,
    temp_min: temperature - 2,
    temp_max: temperature + 2,
  },
  weather: [{ main: 'Rain', description: 'light rain', icon: '10d' }],
  pop: precipitationProbability,
});

test('normalizes valid periods chronologically and ignores invalid entries', () => {
  const first = Date.UTC(2026, 7, 3, 0) / 1000;
  const periods = normalizeForecastEntries([
    entry(first + 10_800, 30, 1),
    { dt: first + 5_400, main: { temp: 'bad' }, weather: [] },
    entry(first, 28, 0),
    entry(first + 21_600, 31, 2),
  ]);

  assert.equal(periods.length, 3);
  assert.deepEqual(
    periods.map((period) => period.temperature),
    [28, 30, 31],
  );
  assert.deepEqual(
    periods.map((period) => period.precipitationProbability),
    [0, 100, 0],
  );
  assert.ok(
    periods.every(
      (period) =>
        period.precipitationProbability >= 0 &&
        period.precipitationProbability <= 100,
    ),
  );
});

test('aggregates unique provider-local days with valid min/max values', () => {
  const timezoneOffsetSeconds = 7 * 60 * 60;
  const start = Date.UTC(2026, 7, 2, 21) / 1000;
  const source = Array.from({ length: 48 }, (_, index) =>
    entry(start + index * 10_800, 24 + (index % 8), (index % 5) / 4),
  );
  const periods = normalizeForecastEntries(source);
  const daily = aggregateDailyForecast(periods, timezoneOffsetSeconds, 5);

  assert.equal(daily.length, 5);
  assert.equal(new Set(daily.map((day) => day.date)).size, daily.length);
  assert.ok(daily.every((day) => day.minTemperature <= day.maxTemperature));
  assert.ok(
    daily.every(
      (day) =>
        day.precipitationProbability >= 0 &&
        day.precipitationProbability <= 100,
    ),
  );
  assert.equal(
    daily[0]?.date,
    providerLocalDateKey(start, timezoneOffsetSeconds),
  );
});
