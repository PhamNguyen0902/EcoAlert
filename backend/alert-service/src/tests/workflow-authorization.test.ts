import assert from 'node:assert/strict';
import test from 'node:test';
import { AlertCategory, AlertStatus, Severity } from '@ecoalert/shared';
import { alertRepository } from '../repositories/alert.repository';
import { rabbitMQService } from '../services/rabbitmq.service';
import { alertService, WorkflowActor } from '../services/alert.service';

const alertId = '507f1f77bcf86cd799439011';
const citizen: WorkflowActor = { id: 'citizen-1', role: 'CITIZEN' };
const officerA: WorkflowActor = { id: 'officer-a', role: 'OFFICER' };
const officerB: WorkflowActor = { id: 'officer-b', role: 'OFFICER' };
const admin: WorkflowActor = { id: 'admin-1', role: 'ADMIN' };

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
