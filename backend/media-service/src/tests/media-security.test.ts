import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'crypto';
import { internalServiceHeaders } from '@ecoalert/shared';
import { app } from '../app';
import { detectImageType } from '../controllers/upload.controller';
import { visionService } from '../services/vision.service';

const signJwt = (userId: string, role: string, secret: string): string => {
  const input = [
    { alg: 'HS256', typ: 'JWT' },
    { userId, role, exp: Math.floor(Date.now() / 1000) + 60 },
  ]
    .map((v) => Buffer.from(JSON.stringify(v)).toString('base64url'))
    .join('.');
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
};

test('detectImageType validates JPEG, PNG, WEBP magic bytes and rejects SVG/text', () => {
  assert.deepEqual(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), {
    mime: 'image/jpeg',
    ext: 'jpg',
  });
  assert.deepEqual(
    detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])),
    { mime: 'image/png', ext: 'png' },
  );
  assert.deepEqual(
    detectImageType(Buffer.from('RIFF1234WEBPxxxx', 'ascii')),
    { mime: 'image/webp', ext: 'webp' },
  );
  assert.equal(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
});

test('media /upload and /analyze-url enforce JWT or internal auth, block SVG uploads, and block SSRF URLs', async () => {
  const prevJwt = process.env.JWT_SECRET;
  const prevServiceSecret = process.env.SERVICE_AUTH_SECRET;
  const prevBucket = process.env.AWS_S3_BUCKET_NAME;
  const prevRegion = process.env.AWS_REGION;
  process.env.JWT_SECRET = 'test-media-security-secret-32chars';
  process.env.SERVICE_AUTH_SECRET = 'test-media-service-secret-32chars';
  process.env.AWS_S3_BUCKET_NAME = 'ecoalert-test-bucket';
  process.env.AWS_REGION = 'ap-southeast-1';

  const originalPredict = visionService.predict;
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const citizenToken = signJwt('citizen-1', 'CITIZEN', process.env.JWT_SECRET);

    // 1. Unauthenticated upload with spoofed x-user-id must return 401
    const unauthUploadForm = new FormData();
    unauthUploadForm.append('image', new Blob([Buffer.from('<svg/>')], { type: 'image/svg+xml' }), 'xss.svg');
    const unauthUploadRes = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'x-user-id': 'spoofed-user' },
      body: unauthUploadForm,
    });
    assert.equal(unauthUploadRes.status, 401);

    // 2. Authenticated SVG upload must be rejected with 400 (no Stored XSS)
    const svgForm = new FormData();
    svgForm.append('image', new Blob([Buffer.from('<svg onload="alert(1)"/>')], { type: 'image/svg+xml' }), 'xss.svg');
    const svgRes = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { authorization: `Bearer ${citizenToken}` },
      body: svgForm,
    });
    assert.equal(svgRes.status, 400);

    // 3. Authenticated spoofed JPEG (text bytes claiming image/jpeg) must be rejected with 400
    const fakeJpegForm = new FormData();
    fakeJpegForm.append('image', new Blob([Buffer.from('not-an-image-bytes-here')], { type: 'image/jpeg' }), 'fake.jpg');
    const fakeJpegRes = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { authorization: `Bearer ${citizenToken}` },
      body: fakeJpegForm,
    });
    assert.equal(fakeJpegRes.status, 400);

    // 4. Unauthenticated /analyze-url fails with 401
    const unauthAnalyze = await fetch(`${baseUrl}/analyze-url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageUrl: 'https://ecoalert-test-bucket.s3.ap-southeast-1.amazonaws.com/ecoalert/a.jpg' }),
    });
    assert.equal(unauthAnalyze.status, 401);

    // 5. SSRF URLs (metadata, http://, file://, wrong host, wrong S3 path) rejected with 400 even with valid JWT or valid internal signature
    for (const badUrl of [
      'http://169.254.169.254/latest/meta-data/',
      'file:///etc/passwd',
      'http://osrm:5000/route/v1/driving/1,2;3,4',
      'https://evil.example.com/ecoalert/a.jpg',
      'https://ecoalert-test-bucket.s3.ap-southeast-1.amazonaws.com/other-prefix/a.jpg',
    ]) {
      const jwtRes = await fetch(`${baseUrl}/analyze-url`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${citizenToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ imageUrl: badUrl }),
      });
      assert.equal(jwtRes.status, 400);

      const body = { imageUrl: badUrl };
      const internalRes = await fetch(`${baseUrl}/analyze-url`, {
        method: 'POST',
        headers: internalServiceHeaders('ai-service', '/analyze-url', body),
        body: JSON.stringify(body),
      });
      assert.equal(internalRes.status, 400);
    }
  } finally {
    visionService.predict = originalPredict;
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevJwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevJwt;
    if (prevServiceSecret === undefined) delete process.env.SERVICE_AUTH_SECRET;
    else process.env.SERVICE_AUTH_SECRET = prevServiceSecret;
    if (prevBucket === undefined) delete process.env.AWS_S3_BUCKET_NAME;
    else process.env.AWS_S3_BUCKET_NAME = prevBucket;
    if (prevRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = prevRegion;
  }
});
