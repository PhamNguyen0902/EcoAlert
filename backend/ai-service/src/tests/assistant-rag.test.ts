import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { detectAssistantIntent } from '../assistant/intent-detector';
import { retrieveKnowledge } from '../assistant/knowledge';
import { buildAlertAccessFilter } from '../assistant/authorized-data.retriever';

test('keyword retrieval returns the incident status knowledge source', () => {
  const results = retrieveKnowledge('What does a pending incident status mean?', 'CITIZEN');
  assert.ok(results.some((result) => result.id === 'incident-statuses'));
});

test('keyword retrieval normalizes Vietnamese diacritics', () => {
  const results = retrieveKnowledge('Làm sao để báo cáo sự cố?', 'CITIZEN');
  assert.ok(results.some((result) => result.id === 'reporting-an-incident'));
});

test('write-like requests are detected before any dynamic tool selection', () => {
  assert.equal(
    detectAssistantIntent('Please assign this incident to an officer', 'ADMIN'),
    'WRITE_REQUEST',
  );
  assert.equal(
    detectAssistantIntent('Tôi muốn xóa báo cáo của tôi', 'CITIZEN'),
    'WRITE_REQUEST',
  );
});

test('officer-only workflow guidance is not retrieved for citizens', () => {
  const results = retrieveKnowledge('arrival and treatment workflow', 'CITIZEN');
  assert.ok(!results.some((result) => result.id === 'officer-task-workflow'));
});

test('authorized alert filters never use a client-supplied ownership scope', () => {
  assert.deepEqual(
    buildAlertAccessFilter({ userId: 'citizen-1', role: 'CITIZEN' }),
    { isDeleted: { $ne: true }, citizenId: 'citizen-1' },
  );
  assert.deepEqual(
    buildAlertAccessFilter({ userId: 'officer-1', role: 'OFFICER' }),
    { isDeleted: { $ne: true }, assignedOfficerId: 'officer-1' },
  );
  assert.deepEqual(
    buildAlertAccessFilter({ userId: 'admin-1', role: 'ADMIN' }),
    { isDeleted: { $ne: true } },
  );
});

test('frontend source never references the OpenRouter API key', () => {
  const frontendSource = path.resolve(__dirname, '../../../../frontend/src');
  const pending = [frontendSource];
  let combinedSource = '';

  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(entryPath);
      else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        combinedSource += fs.readFileSync(entryPath, 'utf8');
      }
    }
  }

  assert.equal(combinedSource.includes('OPENROUTER_API_KEY'), false);
});
