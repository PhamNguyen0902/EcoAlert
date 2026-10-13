import assert from 'node:assert/strict';
import test from 'node:test';
import { app } from '../app';
import * as semantic from '../services/openrouter.service';

test('validate-image HTTP contract keeps category/mass and explicitly returns 503 on provider failure', async () => {
  const provider = semantic as any;
  const original = provider.analyzeIncidentWithOpenRouter;
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const request = () => fetch(`http://127.0.0.1:${address.port}/validate-image`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl: 'https://example.com/test.jpg' }),
  });
  try {
    provider.analyzeIncidentWithOpenRouter = async () => ({ category: 'illegal_dumping', categoryConfidence: 0.85, classificationStatus: 'AI_SUGGESTED', analysisMode: 'IMAGE_AND_TEXT', massEstimate: { available: true, minKg: 2, maxKg: 5 } });
    const success = await request();
    assert.equal(success.status, 200);
    const body = await success.json() as any;
    assert.equal(body.data.category, 'illegal_dumping');
    assert.equal(body.data.massEstimate.minKg, 2);
    provider.analyzeIncidentWithOpenRouter = async () => { throw Object.assign(new Error('upstream failure'), { status: 503 }); };
    const failed = await request();
    assert.equal(failed.status, 503);
    assert.equal((await failed.json() as any).success, false);
  } finally {
    provider.analyzeIncidentWithOpenRouter = original;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
