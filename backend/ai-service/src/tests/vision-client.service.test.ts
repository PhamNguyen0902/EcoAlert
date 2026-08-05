import assert from 'node:assert/strict';
import test from 'node:test';
import { envConfig } from '../config/env.config';
import {
  analyzeImageWithVision,
  safeVisionErrorMetadata,
} from '../services/vision-client.service';

test('vision client validates evidence, uploads annotation through Media, and strips base64', async () => {
  const originalSecret = envConfig.internalGatewaySecret;
  const originalVisionUrl = envConfig.visionServiceUrl;
  const originalMediaUrl = envConfig.mediaServiceUrl;
  (envConfig as any).internalGatewaySecret = 'test-internal-secret';
  (envConfig as any).visionServiceUrl = 'http://vision.test';
  (envConfig as any).mediaServiceUrl = 'http://media.test';
  let mediaCalled = false;
  try {
    const result = await analyzeImageWithVision(
      { alertId: 'alert-1', imageUrl: 'https://images.example/a.jpg' },
      {
        postVision: (async (_url: string, _body: unknown, config: any) => {
          assert.equal(config.headers['x-internal-service-token'], 'test-internal-secret');
          return { data: {
            status: 'COMPLETED', detectorModel: 'ecoalert-waste-yolo26n-v1.pt', segmenterModel: null,
            imageWidth: 20, imageHeight: 10, detections: [], objectCounts: [],
            totalDetectedObjects: 0, visibleWasteCoverage: null,
            detectorConfidence: null, segmentationConfidence: null,
            annotatedImageBase64: Buffer.from('jpeg').toString('base64'),
            annotatedImageContentType: 'image/jpeg', processingTimeMs: 12,
            detectionTimeMs: 7, segmentationTimeMs: 0, annotationTimeMs: 2, warnings: [],
          } } as any;
        }) as any,
        postMedia: (async (url: string, _body: unknown, config: any) => {
          mediaCalled = true;
          assert.equal(url, 'http://media.test/internal/vision-upload');
          assert.equal(config.headers['x-internal-service-token'], 'test-internal-secret');
          return { data: { data: { url: 'https://bucket.example/annotation.jpg' } } } as any;
        }) as any,
      },
    );
    assert.equal(mediaCalled, true);
    assert.equal(result.annotatedImageUrl, 'https://bucket.example/annotation.jpg');
    assert.equal('annotatedImageBase64' in result, false);
  } finally {
    (envConfig as any).internalGatewaySecret = originalSecret;
    (envConfig as any).visionServiceUrl = originalVisionUrl;
    (envConfig as any).mediaServiceUrl = originalMediaUrl;
  }
});

test('vision client rejects a generic detector contract', async () => {
  const originalSecret = envConfig.internalGatewaySecret;
  (envConfig as any).internalGatewaySecret = 'test-internal-secret';
  try {
    await assert.rejects(() => analyzeImageWithVision(
      { alertId: 'alert-1', imageUrl: 'https://images.example/a.jpg' },
      {
        postVision: (async () => ({ data: {
          status: 'COMPLETED', detectorModel: 'yolo26n.pt', segmenterModel: null,
          imageWidth: 20, imageHeight: 10,
          detections: [{
            classId: 0, label: 'person', confidence: 0.9,
            bbox: { x: 0, y: 0, width: 10, height: 10 },
            normalizedBbox: { x: 0, y: 0, width: 0.5, height: 1 },
          }],
          objectCounts: [{ label: 'person', count: 1 }], totalDetectedObjects: 1,
          visibleWasteCoverage: null, detectorConfidence: 0.9,
          segmentationConfidence: null, annotatedImageBase64: null,
          annotatedImageContentType: null, processingTimeMs: 12,
          detectionTimeMs: 7, segmentationTimeMs: 0, annotationTimeMs: 2, warnings: [],
        } } as any)) as any,
      },
    ));
  } finally {
    (envConfig as any).internalGatewaySecret = originalSecret;
  }
});

test('annotation upload failure retains structured custom detections', async () => {
  const originalSecret = envConfig.internalGatewaySecret;
  (envConfig as any).internalGatewaySecret = 'test-internal-secret';
  try {
    const result = await analyzeImageWithVision(
      { alertId: 'alert-1', imageUrl: 'https://images.example/a.jpg' },
      {
        postVision: (async () => ({ data: {
          status: 'COMPLETED', detectorModel: 'ecoalert-waste-yolo26n-v1.pt',
          segmenterModel: null, imageWidth: 20, imageHeight: 10,
          detections: [{
            classId: 4, label: 'cardboard', confidence: 0.9,
            bbox: { x: 0, y: 0, width: 10, height: 10 },
            normalizedBbox: { x: 0, y: 0, width: 0.5, height: 1 },
            wasteType: 'PAPER_WASTE',
          }],
          objectCounts: [{ label: 'cardboard', count: 1 }], totalDetectedObjects: 1,
          visibleWasteCoverage: null, detectorConfidence: 0.9,
          segmentationConfidence: null,
          annotatedImageBase64: Buffer.from('jpeg').toString('base64'),
          annotatedImageContentType: 'image/jpeg', processingTimeMs: 12,
          detectionTimeMs: 7, segmentationTimeMs: 0, annotationTimeMs: 2, warnings: [],
        } } as any)) as any,
        postMedia: (async () => { throw new Error('S3 unavailable'); }) as any,
      },
    );
    assert.equal(result.detections[0].label, 'cardboard');
    assert.equal(result.annotatedImageUrl, undefined);
  } finally {
    (envConfig as any).internalGatewaySecret = originalSecret;
  }
});

test('unreachable image request fails cleanly after one retry with safe diagnostics', async () => {
  const originalSecret = envConfig.internalGatewaySecret;
  (envConfig as any).internalGatewaySecret = 'test-internal-secret';
  const networkError = Object.assign(new Error('getaddrinfo ENOTFOUND'), {
    name: 'AxiosError',
    code: 'ENOTFOUND',
    isAxiosError: true,
  });
  let attempts = 0;
  try {
    await assert.rejects(() => analyzeImageWithVision(
      { alertId: 'alert-1', imageUrl: 'https://unreachable.example/a.jpg' },
      {
        postVision: (async () => {
          attempts += 1;
          throw networkError;
        }) as any,
      },
    ), (error: unknown) => {
      assert.equal(error, networkError);
      return true;
    });
    assert.equal(attempts, 2);
    assert.deepEqual(safeVisionErrorMetadata(networkError), {
      errorType: 'AxiosError',
      errorCode: 'ENOTFOUND',
    });
  } finally {
    (envConfig as any).internalGatewaySecret = originalSecret;
  }
});
