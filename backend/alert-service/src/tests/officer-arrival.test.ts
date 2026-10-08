import test from 'node:test';
import assert from 'node:assert/strict';
import { AlertStatus } from '@ecoalert/shared';
import { Alert } from '../models/alert.model';
import { alertRepository } from '../repositories/alert.repository';
import { alertService } from '../services/alert.service';
import { rabbitMQService } from '../services/rabbitmq.service';
import { envConfig } from '../config/env.config';

const id = '507f1f77bcf86cd799439011';
const actor = { id: 'officer-a', role: 'OFFICER' };
const lat = 10.7769, lng = 106.7009;
test('field arrival authorization, status, accuracy and actual server distance', async t => {
  const originals = { find: alertRepository.findById, update: alertRepository.findOneAndUpdate, publish: rabbitMQService.publishEvent };
  let writes = 0;
  let eventNames: string[] = [];
  let stored: { distanceFromIncidentMeters: number; verified: boolean; location: { coordinates: number[] }; checkedInAt: Date } | undefined;
  let arrivedAt: Date | undefined;
  let task = new Alert({ _id: id, status: AlertStatus.ASSIGNED, assignedOfficerId: actor.id, location: {type:'Point',coordinates:[lng,lat]} });
  try {
    alertRepository.findById = async () => task;
    alertRepository.findOneAndUpdate = async (_filter, update) => {
      writes++;
      stored = update.$set?.checkIn as typeof stored;
      arrivedAt = update.$set?.arrivedAt as Date;
      return task;
    };
    rabbitMQService.publishEvent = async name => { eventNames.push(name); };
    const good = {latitude:lat + 40/111195,longitude:lng,accuracyMeters:8};
    await t.test('another officer cannot start or check in', async () => {
      await assert.rejects(alertService.startHandling(id, {id:'officer-b',role:'OFFICER'}), /phân công/);
      await assert.rejects(alertService.confirmArrival(id, {id:'officer-b',role:'OFFICER'}, good), /phân công/);
      assert.equal(writes,0);
    });
    await t.test('check-in before IN_PROGRESS fails', async () => {
      await assert.rejects(alertService.confirmArrival(id, actor, good), /đang xử lý/);
      assert.equal(writes,0);
    });
    await t.test('ASSIGNED starts through guarded update and emits events', async () => {
      alertRepository.findOneAndUpdate = async (filter, update) => {
        assert.equal(filter.assignedOfficerId,actor.id);
        assert.equal(update.$set?.status,AlertStatus.IN_PROGRESS);
        task.status = AlertStatus.IN_PROGRESS;
        return task;
      };
      await alertService.startHandling(id,actor);
      assert.equal(task.status,AlertStatus.IN_PROGRESS);
      assert.equal(eventNames.length,2);
      alertRepository.findOneAndUpdate = async (_filter, update) => {
        writes++;
        stored = update.$set?.checkIn as typeof stored;
        arrivedAt = update.$set?.arrivedAt as Date;
        return task;
      };
    });
    await t.test('poor GPS accuracy rejected without write/event', async () => {
      eventNames = [];
      await assert.rejects(alertService.confirmArrival(id,actor,{...good,accuracyMeters:envConfig.officerCheckinMaxAccuracyMeters+1}), /chính xác GPS/);
      assert.equal(writes,0); assert.equal(eventNames.length,0);
    });
    await t.test('too far rejected without verified state', async () => {
      await assert.rejects(alertService.confirmArrival(id,actor,{...good,latitude:lat+(envConfig.officerCheckinRadiusMeters+200)/111195}), /cách vị trí/);
      assert.equal(writes,0);
    });
    await t.test('invalid and nonfinite coordinates rejected', async () => {
      for (const latitude of [91,Number.NaN]) await assert.rejects(alertService.confirmArrival(id,actor,{...good,latitude}), /GPS không hợp lệ/);
      assert.equal(writes,0);
    });
    await t.test('valid GPS stores nonfake distance, GeoJSON, server time and true verification', async () => {
      await alertService.confirmArrival(id,actor,good);
      assert.ok(stored); assert.ok(stored.distanceFromIncidentMeters>39 && stored.distanceFromIncidentMeters<41);
      assert.equal(stored.verified,true);
      assert.deepEqual(stored.location.coordinates,[lng,good.latitude]);
      assert.equal(stored.checkedInAt,arrivedAt);
      assert.equal(eventNames.length,2);
    });
  } finally {
    alertRepository.findById = originals.find; alertRepository.findOneAndUpdate = originals.update; rabbitMQService.publishEvent = originals.publish;
  }
});
