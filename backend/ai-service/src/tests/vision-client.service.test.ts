import assert from 'node:assert/strict';
import test from 'node:test';
import { envConfig } from '../config/env.config';
import { analyzeImageWithVision } from '../services/vision-client.service';

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
            status: 'COMPLETED', detectorModel: 'yolo26n.pt', segmenterModel: null,
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
