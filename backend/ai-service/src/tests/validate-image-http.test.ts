import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { app, resetValidateImageRateLimiter } from '../app';
import * as semantic from '../services/openrouter.service';

const signJwt = (userId: string, role: string, secret: string): string => {
  const input = [
    { alg: 'HS256', typ: 'JWT' },
    { userId, role, exp: Math.floor(Date.now() / 1000) + 60 },
  ]
    .map((v) => Buffer.from(JSON.stringify(v)).toString('base64url'))
    .join('.');
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
};

test('validate-image & analyze enforce auth + S3 allowlist + rate limit and preserve 503/402 contract', async () => {
  const prevJwt = process.env.JWT_SECRET;
  const prevRegion = process.env.AWS_REGION;
  const prevBucket = process.env.AWS_S3_BUCKET_NAME;
  const prevRate = process.env.AI_VALIDATE_RATE_LIMIT_MAX;
  process.env.JWT_SECRET = 'test-ai-validate-secret-32-chars-ok';
  process.env.AWS_REGION = 'ap-southeast-1';
  process.env.AWS_S3_BUCKET_NAME = 'ecoalert-test-bucket';
  delete process.env.AI_VALIDATE_RATE_LIMIT_MAX;
  resetValidateImageRateLimiter();

  const provider = semantic as any;
  const original = provider.analyzeIncidentWithOpenRouter;
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address() as { port: number };
  const validUrl = 'https://ecoalert-test-bucket.s3.ap-southeast-1.amazonaws.com/ecoalert/test.jpg';
  const token = signJwt('citizen-1', 'CITIZEN', process.env.JWT_SECRET);
  const postValidate = (imageUrl = validUrl, authToken: string | null = token) =>
    fetch(`http://127.0.0.1:${address.port}/validate-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ imageUrl }),
    });

  try {
    assert.equal((await postValidate(validUrl, null)).status, 401);
    const unauthAnalyze = await fetch(`http://127.0.0.1:${address.port}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: validUrl }),
    });
    assert.equal(unauthAnalyze.status, 401);

    assert.equal((await postValidate('https://example.com/test.jpg')).status, 400);
    assert.equal(
      (await postValidate('https://ecoalert-test-bucket.s3.ap-southeast-1.amazonaws.com/other/test.jpg')).status,
      400,
    );

    provider.analyzeIncidentWithOpenRouter = async () => ({
      category: 'illegal_dumping',
      categoryConfidence: 0.85,
      classificationStatus: 'AI_SUGGESTED',
      analysisMode: 'IMAGE_AND_TEXT',
      massEstimate: { available: true, minKg: 2, maxKg: 5 },
    });
    const success = await postValidate();
    assert.equal(success.status, 200);
    const body = (await success.json()) as any;
    assert.equal(body.data.category, 'illegal_dumping');
    assert.equal(body.data.massEstimate.minKg, 2);

    provider.analyzeIncidentWithOpenRouter = async () => {
      throw Object.assign(new Error('upstream failure'), { status: 503 });
    };
    const failed = await postValidate();
    assert.equal(failed.status, 503);
    assert.equal(((await failed.json()) as any).success, false);

    provider.analyzeIncidentWithOpenRouter = async () => {
      throw Object.assign(new Error('sensitive provider message must not leak'), { status: 402 });
    };
    const billing = await postValidate();
    const billingBody = (await billing.json()) as any;
    assert.equal(billing.status, 503);
    assert.equal(billingBody.code, 'AI_PROVIDER_BILLING_REQUIRED');
    assert.equal(billingBody.providerStatus, 402);
    assert.doesNotMatch(JSON.stringify(billingBody), /sensitive provider/);

    process.env.AI_VALIDATE_RATE_LIMIT_MAX = '1';
    const rateLimited = await postValidate();
    assert.equal(rateLimited.status, 429);
  } finally {
    resetValidateImageRateLimiter();
    provider.analyzeIncidentWithOpenRouter = original;
    server.closeAllConnections?.();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    if (prevJwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevJwt;
    if (prevRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = prevRegion;
    if (prevBucket === undefined) delete process.env.AWS_S3_BUCKET_NAME;
    else process.env.AWS_S3_BUCKET_NAME = prevBucket;
    if (prevRate === undefined) delete process.env.AI_VALIDATE_RATE_LIMIT_MAX;
    else process.env.AI_VALIDATE_RATE_LIMIT_MAX = prevRate;
  }
});
