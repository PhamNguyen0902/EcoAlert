import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { VisionService } from '../services/vision.service';

test('media forwards merged legacy detections, sources and degradation unchanged', async () => {
  const prediction = { status: 'ok', requiresManualReview: true, degraded: true,
    model_errors: { ecoalert_general: 'failed' }, detections: [{ materialClass: 'plastic',
      suggestedCategory: 'other', confidence: .81, bbox: [0, 1, 20, 30],
      model_id: 'asian_waste', original_class_name: 'Plastic', original_class_id: 7,
      sources: [{ model_id: 'asian_waste', original_class_name: 'Plastic', original_class_id: 7, confidence: .81, bbox: [0, 1, 20, 30] }] }] };
  const original = axios.post;
  let calledUrl = '';
  axios.post = (async (url: string) => { calledUrl = url; return { data: prediction }; }) as typeof axios.post;
  try {
    const value = await new VisionService().predict({ buffer: Buffer.from('image'), originalname: 'test.jpg', mimetype: 'image/jpeg' } as Express.Multer.File);
    assert.ok(calledUrl.endsWith('/predict'));
    assert.deepEqual(value, prediction);
  } finally { axios.post = original; }
});

test('malformed Vision response and timeout remain errors, not no_detection', async () => {
  const original = axios.post;
  const file = { buffer: Buffer.from('image'), originalname: 'test.jpg', mimetype: 'image/jpeg' } as Express.Multer.File;
  try {
    axios.post = (async () => ({ data: { detections: [] } })) as typeof axios.post;
    assert.equal((await new VisionService().predict(file))?.errorCode, 'INVALID_VISION_RESPONSE');
    axios.post = (async () => { throw Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }); }) as typeof axios.post;
    const result = await new VisionService().predict(file);
    assert.equal(result?.status, 'error');
    assert.equal(result?.errorCode, 'VISION_TIMEOUT');
  } finally { axios.post = original; }
});

test('retries on 503 with a fresh FormData instance and recovers or exhausts cleanly', async () => {
  const original = axios.post;
  const file = { buffer: Buffer.from('image'), originalname: 'test.jpg', mimetype: 'image/jpeg' } as Express.Multer.File;
  try {
    let calls = 0;
    const formInstances: unknown[] = [];
    axios.post = (async (_url: string, body: unknown) => {
      calls++;
      formInstances.push(body);
      if (calls === 1) {
        throw Object.assign(new Error('busy'), { response: { status: 503, headers: { 'retry-after': '0.05' } } });
      }
      return { data: { status: 'no_detection', detections: [], requiresManualReview: false } };
    }) as typeof axios.post;

    const recovered = await new VisionService({ maxRetries: 2, baseDelayMs: 5 }).predict(file);
    assert.equal(calls, 2);
    assert.notEqual(formInstances[0], formInstances[1]);
    assert.equal(recovered?.status, 'no_detection');

    calls = 0;
    axios.post = (async () => {
      calls++;
      throw Object.assign(new Error('busy'), { response: { status: 503, headers: {} } });
    }) as typeof axios.post;

    const exhausted = await new VisionService({ maxRetries: 2, baseDelayMs: 5 }).predict(file);
    assert.equal(calls, 3);
    assert.equal(exhausted?.status, 'error');
    assert.equal(exhausted?.errorCode, 'VISION_UNAVAILABLE');
    assert.equal(exhausted?.requiresManualReview, true);
  } finally {
    axios.post = original;
  }
});
