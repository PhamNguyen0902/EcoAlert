import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMediaObjectKey } from '../services/s3.service';

test('repeat upload for the same citizen/photo has one S3 object key', () => {
  const key = buildMediaObjectKey('ecoalert/alerts', 'jpg', 'citizen-a', 'field-1:photo-1:original');
  assert.equal(buildMediaObjectKey('ecoalert/alerts', 'jpg', 'citizen-a', 'field-1:photo-1:original'), key);
  assert.notEqual(buildMediaObjectKey('ecoalert/alerts', 'jpg', 'citizen-b', 'field-1:photo-1:original'), key);
  assert.notEqual(buildMediaObjectKey('ecoalert/alerts', 'jpg', 'citizen-a', 'field-1:photo-1:display'), key);
});
