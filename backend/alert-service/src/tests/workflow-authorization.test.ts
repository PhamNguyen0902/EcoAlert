import assert from 'node:assert/strict';
import test from 'node:test';
import { AlertCategory, AlertStatus, Severity, signMediaOwnership } from '@ecoalert/shared';
import { alertRepository } from '../repositories/alert.repository';
import { rabbitMQService } from '../services/rabbitmq.service';
import { alertService, WorkflowActor } from '../services/alert.service';
import { createAlertSchema } from '../dtos/alert.dto';

const alertId = '507f1f77bcf86cd799439011';
const citizen: WorkflowActor = { id: 'citizen-1', role: 'CITIZEN' };
const officerA: WorkflowActor = { id: 'officer-a', role: 'OFFICER' };
const officerB: WorkflowActor = { id: 'officer-b', role: 'OFFICER' };
const admin: WorkflowActor = { id: 'admin-1', role: 'ADMIN' };

test('signed Citizen manual-review reports preserve UNCERTAIN/UNAVAILABLE and enter UNCLASSIFIED without inventing a final category', async () => {
  const repository = alertRepository as any;
  const rabbit = rabbitMQService as any;
  const oldFind = repository.findOne, oldCreate = repository.create, oldPublish = rabbit.publishEvent;
  const oldSecret = process.env.SERVICE_AUTH_SECRET;
  process.env.SERVICE_AUTH_SECRET = 'test-only-manual-review-secret-123';
  try {
    repository.findOne = async () => null;
    repository.create = async (data: any) => data;
    rabbit.publishEvent = async () => undefined;
    for (const decision of ['UNCERTAIN', 'UNAVAILABLE'] as const) {
      const url = `https://media.example.com/${decision}.jpg`;
      const timestamp = '2026-10-17T01:00:00.000Z';
      const parsed = createAlertSchema.parse({
        clientReportId: `field_review_${decision}`, title: 'Hiện trường cần rà soát', description: 'Người dân gửi ảnh và vị trí để cán bộ kiểm tra thực tế.',
        location: { type: 'Point', coordinates: [106.7, 10.8] }, mediaUrls: [url],
        captureMetadata: { method: 'LIVE_CAMERA', capturedAt: timestamp, gpsCapturedAt: timestamp, gpsAccuracyMeters: 10, locationSource: 'DEVICE_GPS' },
        fieldEvidence: [{ photoId: 'photo-review', isPrimary: true, originalUrl: url,
          originalOwnershipProof: signMediaOwnership(citizen.id, url), capturedAt: timestamp,
          gpsCapturedAt: timestamp, gpsAccuracyMeters: 10, latitude: 10.8, longitude: 106.7 }],
        imageValidation: { decision, isEnvironmentalIncident: null, suggestedCategory: null,
          confidence: null, reason: 'Chờ cán bộ rà soát, chưa có kết luận AI.', validatedAt: timestamp },
      });
      const created = await alertService.createAlert(citizen, parsed);
      assert.equal(created.status, AlertStatus.PENDING);
      assert.equal(created.category, 'UNCLASSIFIED');
      assert.equal(created.classification?.status, 'UNCLASSIFIED');
      assert.equal(created.classification?.finalCategory, null);
      assert.equal(created.classification?.confirmedBy, null);
      assert.equal(created.imageValidation?.decision, decision);
      await assert.rejects(alertService.createAlert(officerA, parsed));
      await assert.rejects(alertService.createAlert(citizen, { ...parsed, fieldEvidence: [{ ...parsed.fieldEvidence![0], originalOwnershipProof: undefined }] }));
      assert.equal(createAlertSchema.safeParse({ ...parsed, fieldEvidence: [{ ...parsed.fieldEvidence![0], gpsAccuracyMeters: 70 }] }).success, false);
      assert.equal(createAlertSchema.safeParse({ ...parsed, mediaUrls: [] }).success, false);
    }
    const suggestion = createAlertSchema.parse({ title: 'Gợi ý chưa xác nhận', description: 'Có gợi ý danh mục nhưng người dân chưa chọn.', mediaUrls: ['https://media.example.com/ai.jpg'],
      location: { type: 'Point', coordinates: [106.7, 10.8] },
      imageValidation: { decision: 'UNCERTAIN', suggestedCategory: AlertCategory.ILLEGAL_DUMPING, confidence: .8, reason: 'Gợi ý AI chưa được người dân xác nhận.', validatedAt: new Date() } });
    const created = await alertService.createAlert(citizen, suggestion);
    assert.equal(created.classification?.status, 'UNCLASSIFIED');
    assert.equal(created.classification?.aiSuggestedCategory, AlertCategory.ILLEGAL_DUMPING);
    assert.equal(created.classification?.citizenSelectedCategory, null);
  } finally {
    repository.findOne = oldFind; repository.create = oldCreate; rabbit.publishEvent = oldPublish;
    if (oldSecret === undefined) delete process.env.SERVICE_AUTH_SECRET; else process.env.SERVICE_AUTH_SECRET = oldSecret;
  }
});

test('only Admin can verify, assign, or close', async () => {
  await assert.rejects(alertService.updateStatus(alertId, citizen, { status: AlertStatus.VERIFIED }));
  await assert.rejects(alertService.updateStatus(alertId, officerA, { status: AlertStatus.VERIFIED }));
  await assert.rejects(alertService.assignOfficer(alertId, citizen, { officerId: alertId }));
  await assert.rejects(alertService.assignOfficer(alertId, officerA, { officerId: alertId }));
  await assert.rejects(alertService.closeIncident(alertId, officerA, {}));
});

test('an Officer cannot start another Officer task or resolve before a verified check-in', async () => {
  const repository = alertRepository as any;
  const originalFindById = repository.findById;
  try {
    repository.findById = async () => ({
      _id: alertId,
      status: AlertStatus.ASSIGNED,
      assignedOfficerId: officerB.id,
      location: { type: 'Point', coordinates: [106.7, 10.7] },
    });
    await assert.rejects(alertService.startHandling(alertId, officerA));

    repository.findById = async () => ({
      _id: alertId,
      status: AlertStatus.IN_PROGRESS,
      assignedOfficerId: officerA.id,
      location: { type: 'Point', coordinates: [106.7, 10.7] },
    });
    await assert.rejects(alertService.resolveIncident(alertId, officerA, {
      resolutionSummary: 'Removed debris', treatmentMethod: 'Collection', evidence: [{ url: 'https://example.com/after.jpg' }],
    }));
  } finally { repository.findById = originalFindById; }
});

test('Admin can close a valid resolved incident with after evidence', async () => {
  const repository = alertRepository as any;
  const rabbit = rabbitMQService as any;
  const originalFindById = repository.findById;
  const originalFindOneAndUpdate = repository.findOneAndUpdate;
  const originalPublish = rabbit.publishEvent;
  try {
    const resolvedAlert = {
      _id: { toString: () => alertId }, title: 'Resolved waste', citizenId: citizen.id,
      status: AlertStatus.RESOLVED, assignedOfficerId: officerA.id, resolvedBy: officerA.id,
      resolvedAt: new Date(), resolutionEvidence: [{ url: 'https://example.com/after.jpg' }],
      toObject: () => ({ status: AlertStatus.CLOSED }),
    };
    repository.findById = async () => resolvedAlert;
    repository.findOneAndUpdate = async () => ({ ...resolvedAlert, status: AlertStatus.CLOSED });
    rabbit.publishEvent = async () => undefined;
    const result = await alertService.closeIncident(alertId, admin, { reviewNote: 'Evidence reviewed' });
    assert.equal(result.status, AlertStatus.CLOSED);
  } finally {
    repository.findById = originalFindById;
    repository.findOneAndUpdate = originalFindOneAndUpdate;
    rabbit.publishEvent = originalPublish;
  }
});

test('a citizen image confirmation stores human category separately from AI evidence', async () => {
  const repository = alertRepository as any;
  const rabbit = rabbitMQService as any;
  const originalFindOne = repository.findOne;
  const originalCreate = repository.create;
  const originalPublish = rabbit.publishEvent;
  try {
    let created: any;
    repository.findOne = async () => null;
    repository.create = async (value: any) => { created = value; return value; };
    rabbit.publishEvent = async () => undefined;
    await alertService.createAlert(citizen, {
      title: 'Waste on footpath', description: 'Several bags were dumped beside the public footpath.', severity: Severity.LOW,
      location: { type: 'Point', coordinates: [106.7, 10.7] }, mediaUrls: ['https://example.com/before.jpg'],
      imageValidation: { decision: 'VALID', isEnvironmentalIncident: true, confidence: 0.92, suggestedCategory: AlertCategory.ILLEGAL_DUMPING, reason: 'Waste is visible.', model: 'test-model', validatedAt: new Date() },
      classification: { selectedCategory: AlertCategory.FLOODING, decision: 'CORRECT' },
    });
    assert.equal(created.classification.status, 'USER_CORRECTED');
    assert.equal(created.classification.aiSuggestedCategory, AlertCategory.ILLEGAL_DUMPING);
    assert.equal(created.category, AlertCategory.FLOODING);
  } finally {
    repository.findOne = originalFindOne;
    repository.create = originalCreate;
    rabbit.publishEvent = originalPublish;
  }
});

test('field report retries reuse one alert and reject media signed for another citizen', async () => {
  const repository = alertRepository as any;
  const rabbit = rabbitMQService as any;
  const oldFind = repository.findOne, oldCreate = repository.create, oldPublish = rabbit.publishEvent;
  const oldSecret = process.env.SERVICE_AUTH_SECRET;
  process.env.SERVICE_AUTH_SECRET = 'test-only-media-ownership-secret-123';
  try {
    let stored: any, creates = 0, publishes = 0;
    repository.findOne = async (filter: any) => stored?.citizenId === filter.citizenId && stored?.clientReportId === filter.clientReportId ? stored : null;
    repository.create = async (value: any) => { creates++; stored = value; return value; };
    rabbit.publishEvent = async () => { publishes++; };
    const url = 'https://media.example.com/one.jpg';
    const data = { title: 'Waste beside street', description: 'Several waste bags obstruct the pavement.',
      clientReportId: 'field_123456789', location: { type: 'Point' as const, coordinates: [106.7, 10.7] as [number, number] },
      mediaUrls: [url], fieldEvidence: [{ photoId: 'photo-1', isPrimary: true, originalUrl: url,
        originalOwnershipProof: signMediaOwnership(citizen.id, url), capturedAt: new Date().toISOString(),
        gpsCapturedAt: new Date().toISOString(), gpsAccuracyMeters: 10, latitude: 10.7, longitude: 106.7 }] };
    await alertService.createAlert(citizen, data);
    await alertService.createAlert(citizen, data);
    assert.equal(creates, 1); assert.equal(publishes, 1);
    stored = null;
    await assert.rejects(alertService.createAlert(citizen, { ...data, clientReportId: 'field_987654321',
      fieldEvidence: [{ ...data.fieldEvidence[0], originalOwnershipProof: signMediaOwnership('other-user', url) }] }));
    assert.equal(creates, 1);
  } finally {
    repository.findOne = oldFind; repository.create = oldCreate; rabbit.publishEvent = oldPublish;
    if (oldSecret === undefined) delete process.env.SERVICE_AUTH_SECRET; else process.env.SERVICE_AUTH_SECRET = oldSecret;
  }
});
