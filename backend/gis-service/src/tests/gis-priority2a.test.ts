import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { app } from '../app';
import { Location } from '../models/location.model';
import { gisService } from '../services/gis.service';

const signJwt = (userId: string, role: string, secret: string): string => {
  const input = [
    { alg: 'HS256', typ: 'JWT' },
    { userId, role, exp: Math.floor(Date.now() / 1000) + 60 },
  ]
    .map((v) => Buffer.from(JSON.stringify(v)).toString('base64url'))
    .join('.');
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
};

test('saveLocation supports alertId fallback, avoids wiping fields on partial delete, upserts with valid Point, and rethrows DB errors', async () => {
  const model = Location as any;
  const origFindOneAndUpdate = model.findOneAndUpdate;
  const calls: Array<{ filter: any; update: any; options: any }> = [];
  try {
    model.findOneAndUpdate = async (filter: any, update: any, options: any) => {
      calls.push({ filter, update, options });
      return {};
    };

    await gisService.saveLocation({
      alertId: 'alert-123',
      status: 'deleted',
      isDeleted: true,
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].filter, { alertId: 'alert-123' });
    assert.deepEqual(calls[0].update, { $set: { status: 'deleted', isDeleted: true } });
    assert.deepEqual(calls[0].options, { upsert: false, new: true });

    await gisService.saveLocation({
      _id: 'alert-456',
      status: 'pending',
      category: 'illegal_dumping',
      location: { type: 'Point', coordinates: [106.7, 10.77] },
    });
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].filter, { alertId: 'alert-456' });
    assert.equal(calls[1].options.upsert, true);
    assert.deepEqual(calls[1].update.$setOnInsert, { alertId: 'alert-456' });
    assert.deepEqual(calls[1].update.$set.location.coordinates, [106.7, 10.77]);

    model.findOneAndUpdate = async () => {
      throw new Error('Mongo write failed');
    };
    await assert.rejects(
      gisService.saveLocation({ _id: 'alert-err', status: 'pending' }),
      /Mongo write failed/,
    );
  } finally {
    model.findOneAndUpdate = origFindOneAndUpdate;
  }
});

test('getHeatmapDrilldown uses $facet so summary.total reflects all matches rather than 50-item display slice', async () => {
  const model = Location as any;
  const origAggregate = model.aggregate;
  let capturedPipeline: any[] = [];
  try {
    model.aggregate = async (pipeline: any[]) => {
      capturedPipeline = pipeline;
      const fiftyIncidents = Array.from({ length: 50 }, (_, idx) => ({
        alertId: `a-${idx}`,
        category: 'illegal_dumping',
        severity: 'high',
        status: 'pending',
        location: { coordinates: [106.7, 10.77] },
        distanceMeters: idx,
      }));
      const seventyFiveAll = Array.from({ length: 75 }, () => ({
        category: 'illegal_dumping',
        severity: 'high',
        status: 'pending',
      }));
      return [{ incidents: fiftyIncidents, allLocations: seventyFiveAll }];
    };

    const result = await gisService.getHeatmapDrilldown(106.7, 10.77, 1000, {});
    assert.equal(Boolean(capturedPipeline.find((stage) => '$facet' in stage)), true);
    assert.equal(result.incidents.length, 50);
    assert.equal(result.summary.total, 75);
  } finally {
    model.aggregate = origAggregate;
  }
});

test('/nearby and /radius reject invalid bounds/empty coordinates and oversized distance/radius with 400', async () => {
  const prevSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-gis-priority2a-secret-32chars';
  const origGetNearby = gisService.getNearby;
  const origGetRadius = gisService.getRadius;
  let nearbyCalls = 0;
  let radiusCalls = 0;

  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    gisService.getNearby = async () => {
      nearbyCalls++;
      return [] as any;
    };
    gisService.getRadius = async () => {
      radiusCalls++;
      return [] as any;
    };
    const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const headers = { authorization: `Bearer ${signJwt('citizen-1', 'CITIZEN', process.env.JWT_SECRET)}` };

    for (const path of [
      '/nearby?lat=95&lng=106.7',
      '/nearby?lat=&lng=',
      '/nearby?lat=10.77&lng=106.7&maxDistance=999999',
      '/radius?lat=10.77&lng=181',
      '/radius?lat=&lng=106.7',
      '/radius?lat=10.77&lng=106.7&radius=500',
    ]) {
      const res = await fetch(`${baseUrl}${path}`, { headers });
      assert.equal(res.status, 400, `Expected 400 for ${path}`);
    }
    assert.equal(nearbyCalls, 0);
    assert.equal(radiusCalls, 0);

    const okNearby = await fetch(`${baseUrl}/nearby?lat=10.77&lng=106.7&maxDistance=5000`, { headers });
    const okRadius = await fetch(`${baseUrl}/radius?lat=10.77&lng=106.7&radius=10`, { headers });
    assert.equal(okNearby.status, 200);
    assert.equal(okRadius.status, 200);
    assert.equal(nearbyCalls, 1);
    assert.equal(radiusCalls, 1);
  } finally {
    gisService.getNearby = origGetNearby;
    gisService.getRadius = origGetRadius;
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  }
});
