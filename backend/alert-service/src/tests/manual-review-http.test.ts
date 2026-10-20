import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'crypto';
import { signMediaOwnership } from '@ecoalert/shared';
import { app } from '../app';
import { alertRepository } from '../repositories/alert.repository';
import { rabbitMQService } from '../services/rabbitmq.service';

test('POST / accepts signed pending classification; rejects forged role, missing proof and inaccurate GPS', async () => {
  // Real HTTP/auth/DTO/controller/service; persistence and event transport are
  // stubbed. This creates no production report and contacts no external AI.
  const oldJwt = process.env.JWT_SECRET, oldMedia = process.env.SERVICE_AUTH_SECRET;
  process.env.JWT_SECRET = 'manual-review-test-jwt-not-production';
  process.env.SERVICE_AUTH_SECRET = 'manual-review-test-media-not-production';
  const repository = alertRepository as any, rabbit = rabbitMQService as any;
  const oldFind = repository.findOne, oldCreate = repository.create, oldPublish = rabbit.publishEvent;
  repository.findOne = async () => null;
  repository.create = async (data: unknown) => data;
  rabbit.publishEvent = async () => undefined;
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const sign = (role: string) => {
    const input = [{ alg: 'HS256', typ: 'JWT' }, { role, userId: 'review-citizen', exp: Math.floor(Date.now() / 1000) + 60 }]
      .map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
    return `${input}.${createHmac('sha256', process.env.JWT_SECRET!).update(input).digest('base64url')}`;
  };
  const url = 'https://media.example.com/review-original.jpg', time = '2026-10-17T01:00:00.000Z';
  const body = {
    clientReportId: 'field_manual_review_http', title: 'Hiện trường cần kiểm tra', description: 'Người dân bổ sung mô tả để cán bộ rà soát ảnh thực tế.',
    location: { type: 'Point', coordinates: [106.7, 10.8] }, mediaUrls: [url],
    fieldEvidence: [{ photoId: 'review-photo', isPrimary: true, originalUrl: url, originalOwnershipProof: signMediaOwnership('review-citizen', url),
      capturedAt: time, gpsCapturedAt: time, gpsAccuracyMeters: 10, latitude: 10.8, longitude: 106.7 }],
    imageValidation: { decision: 'UNCERTAIN', isEnvironmentalIncident: null, suggestedCategory: null, confidence: null,
      reason: 'Chưa xác định được danh mục phù hợp.', validatedAt: time },
  };
  const request = (payload: unknown, token = sign('CITIZEN')) => fetch(`http://127.0.0.1:${address.port}/`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-user-role': 'CITIZEN' }, body: JSON.stringify(payload),
  });
  try {
    for (const decision of ['UNCERTAIN', 'UNAVAILABLE']) {
      const response = await request({ ...body, imageValidation: { ...body.imageValidation, decision } });
      assert.equal(response.status, 201);
      const data = (await response.json() as any).data;
      assert.equal(data.category, 'UNCLASSIFIED'); assert.equal(data.status, 'pending');
      assert.equal(data.classification.status, 'UNCLASSIFIED');
      assert.equal(data.classification.confirmedBy, null);
      assert.equal(data.imageValidation.decision, decision);
    }
    assert.equal((await request(body, sign('OFFICER'))).status, 403);
    assert.equal((await request(body, 'forged-token')).status, 401);
    assert.equal((await request({ ...body, fieldEvidence: [{ ...body.fieldEvidence[0], originalOwnershipProof: '' }] })).status, 403);
    assert.equal((await request({ ...body, fieldEvidence: [{ ...body.fieldEvidence[0], gpsAccuracyMeters: 80 }] })).status, 422);
    assert.equal((await request({ ...body, mediaUrls: [] })).status, 422);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    repository.findOne = oldFind; repository.create = oldCreate; rabbit.publishEvent = oldPublish;
    if (oldJwt === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldJwt;
    if (oldMedia === undefined) delete process.env.SERVICE_AUTH_SECRET; else process.env.SERVICE_AUTH_SECRET = oldMedia;
  }
});
