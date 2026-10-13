import assert from 'node:assert/strict';
import test from 'node:test';
import { createAlertSchema } from '../dtos/alert.dto';

const reportPayload = {
  title: 'Rác thải ven đường',
  description: 'Có nhiều túi rác chắn lối đi của người dân.',
  mediaUrls: ['https://media.example.com/original.jpg'],
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
    fieldEvidence: [{
      originalUrl: 'https://media.example.com/original.jpg',
      displayUrl: 'https://media.example.com/display.jpg',
      capturedAt: '2026-10-01T08:30:00.000Z',
      gpsAccuracyMeters: 12.5,
    }],
  });

  assert.equal(result.captureMetadata?.method, 'LIVE_CAMERA');
  assert.equal(result.captureMetadata?.gpsAccuracyMeters, 12.5);
  assert.equal(result.fieldEvidence?.[0].originalUrl, 'https://media.example.com/original.jpg');
  assert.equal(result.fieldEvidence?.[0].displayUrl, 'https://media.example.com/display.jpg');
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

test('rejects display evidence that does not keep its original image in mediaUrls', () => {
  assert.throws(() => createAlertSchema.parse({
    ...reportPayload,
    fieldEvidence: [{
      originalUrl: 'https://media.example.com/not-the-ai-source.jpg',
      displayUrl: 'https://media.example.com/display.jpg',
      capturedAt: '2026-10-01T08:30:00.000Z',
      gpsAccuracyMeters: 12.5,
    }],
  }));
});

test('accepts optional citizen taxonomy correction without replacing AI provenance', () => {
  const payload = createAlertSchema.parse({
    ...reportPayload,
    category: 'illegal_construction_waste',
    classification: { selectedCategory: 'illegal_construction_waste', decision: 'CORRECT' },
    imageValidation: { decision: 'UNCERTAIN', confidence: 0.75, suggestedCategory: 'illegal_dumping', reason: 'AI gợi ý cần xác nhận.', validatedAt: '2026-10-13T00:00:00.000Z' },
  });
  assert.equal(payload.classification?.selectedCategory, 'illegal_construction_waste');
  assert.equal(payload.imageValidation?.suggestedCategory, 'illegal_dumping');
  assert.throws(() => createAlertSchema.parse({ ...reportPayload, category: 'UNCLASSIFIED' }));
  assert.equal(createAlertSchema.parse(reportPayload).category, undefined);
});
