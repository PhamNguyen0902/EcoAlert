import assert from 'node:assert/strict';
import test from 'node:test';
import { createAlertSchema } from '../dtos/alert.dto';

const reportPayload = {
  title: 'Rác thải ven đường',
  description: 'Có nhiều túi rác chắn lối đi của người dân.',
  mediaUrls: ['https://media.example.com/field-capture.jpg'],
  location: { type: 'Point' as const, coordinates: [106.7009, 10.7769] as [number, number] },
};

test('accepts optional live-camera capture metadata without requiring it for legacy reports', () => {
  assert.equal(createAlertSchema.parse(reportPayload).captureMetadata, undefined);

  const result = createAlertSchema.parse({
    ...reportPayload,
    captureMetadata: {
      method: 'LIVE_CAMERA',
      capturedAt: '2026-10-01T08:30:00.000Z',
      gpsAccuracyMeters: 12.5,
      locationSource: 'DEVICE_GPS',
    },
  });

  assert.equal(result.captureMetadata?.method, 'LIVE_CAMERA');
  assert.equal(result.captureMetadata?.gpsAccuracyMeters, 12.5);
});

test('rejects capture metadata that does not describe a live device capture', () => {
  assert.throws(() => createAlertSchema.parse({
    ...reportPayload,
    captureMetadata: {
      method: 'GALLERY',
      capturedAt: '2026-10-01T08:30:00.000Z',
      gpsAccuracyMeters: 12.5,
      locationSource: 'DEVICE_GPS',
    },
  }));
});
