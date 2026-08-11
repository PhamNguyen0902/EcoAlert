import { ConflictError, ForbiddenError } from '@ecoalert/shared';
import { envConfig } from '../config/env.config';
import { ShiftLocationDto } from '../dtos/alert.dto';
import { Alert } from '../models/alert.model';
import { OfficerShift } from '../models/officer-shift.model';
import type { WorkflowActor } from './alert.service';
import { userDirectoryService, UserDirectoryItem } from './user-directory.service';

export type WorkloadLevel = 'NORMAL' | 'MODERATE' | 'HIGH';

/** JSON-safe active-shift shape used by the Admin availability read model. */
interface OfficerShiftSummary {
  _id: unknown;
  officerId: string;
  status: 'ACTIVE' | 'COMPLETED';
  startedAt: Date;
  endedAt?: Date;
  startLocation: { type: 'Point'; coordinates: [number, number]; accuracyMeters: number };
  endLocation?: { type: 'Point'; coordinates: [number, number]; accuracyMeters: number };
}

export interface OfficerAvailability {
  officer: Pick<UserDirectoryItem, '_id' | 'fullName' | 'email' | 'role'>;
  shiftStatus: 'ON_SHIFT' | 'OFF_SHIFT';
  activeTaskCount: number;
  assignedCount: number;
  inProgressCount: number;
  workloadLevel: WorkloadLevel;
  currentShift?: OfficerShiftSummary | null;
}

const requireOfficer = (actor: WorkflowActor) => {
  if (actor.role?.toUpperCase() !== 'OFFICER') {
    throw new ForbiddenError('Only Officers can manage their own shifts');
  }
};

const toLocation = (data: ShiftLocationDto) => ({
  type: 'Point' as const,
  coordinates: [data.longitude, data.latitude] as [number, number],
  accuracyMeters: data.accuracyMeters,
});

const workloadLevelFor = (activeTaskCount: number): WorkloadLevel => {
  if (activeTaskCount >= envConfig.officerWorkloadHighThreshold) return 'HIGH';
  if (activeTaskCount >= envConfig.officerWorkloadModerateThreshold) return 'MODERATE';
  return 'NORMAL';
};

export class OfficerShiftService {
  async startShift(actor: WorkflowActor, location: ShiftLocationDto) {
    requireOfficer(actor);
    if (location.accuracyMeters > envConfig.officerMaxGpsAccuracyMeters) {
      throw new ConflictError('GPS accuracy is insufficient to start a shift. Please retry in a clearer location.');
    }
    try {
      return await OfficerShift.create({
        officerId: actor.id,
        status: 'ACTIVE',
        startedAt: new Date(),
        startLocation: toLocation(location),
        createdBy: actor.id,
      });
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 11000) {
        throw new ConflictError('You already have an active shift');
      }
      throw error;
    }
  }

  async endShift(actor: WorkflowActor, location: ShiftLocationDto) {
    requireOfficer(actor);
    if (location.accuracyMeters > envConfig.officerMaxGpsAccuracyMeters) {
      throw new ConflictError('GPS accuracy is insufficient to end a shift. Please retry in a clearer location.');
    }
    const endedAt = new Date();
    const shift = await OfficerShift.findOneAndUpdate(
      { officerId: actor.id, status: 'ACTIVE', isDeleted: false },
      { $set: { status: 'COMPLETED', endedAt, endLocation: toLocation(location), updatedBy: actor.id } },
      { new: true, runValidators: true },
    );
    if (!shift) throw new ConflictError('No active shift exists to end');
    return shift;
  }

  async getCurrentShift(actor: WorkflowActor) {
    requireOfficer(actor);
    return OfficerShift.findOne({ officerId: actor.id, status: 'ACTIVE', isDeleted: false }).sort({ startedAt: -1 });
  }

  async getShiftHistory(actor: WorkflowActor, limit = 20) {
    requireOfficer(actor);
    return OfficerShift.find({ officerId: actor.id, isDeleted: false }).sort({ startedAt: -1 }).limit(limit);
  }

  async getAvailability(actor: WorkflowActor): Promise<OfficerAvailability[]> {
    if (actor.role?.toUpperCase() !== 'ADMIN') {
      throw new ForbiddenError('Only Admins can view Officer availability');
    }
    const [officers, shifts, workloadRows] = await Promise.all([
      userDirectoryService.listOfficers(actor),
      OfficerShift.find({ status: 'ACTIVE', isDeleted: false }).lean(),
      Alert.aggregate<{ _id: string; assignedCount: number; inProgressCount: number }>([
        { $match: { isDeleted: false, status: { $in: [/^assigned$/i, /^in_progress$/i] }, assignedOfficerId: { $exists: true, $ne: null } } },
        { $group: {
          _id: '$assignedOfficerId',
          assignedCount: { $sum: { $cond: [{ $regexMatch: { input: '$status', regex: /^assigned$/i } }, 1, 0] } },
          inProgressCount: { $sum: { $cond: [{ $regexMatch: { input: '$status', regex: /^in_progress$/i } }, 1, 0] } },
        } },
      ]),
    ]);
    const shiftsByOfficer = new Map(shifts.map((shift) => [shift.officerId, shift]));
    const workloadByOfficer = new Map(workloadRows.map((row) => [String(row._id), row]));
    return officers.map((officer) => {
      const workload = workloadByOfficer.get(officer._id);
      const assignedCount = workload?.assignedCount || 0;
      const inProgressCount = workload?.inProgressCount || 0;
      const activeTaskCount = assignedCount + inProgressCount;
      const currentShift = shiftsByOfficer.get(officer._id) || null;
      return {
        officer,
        shiftStatus: (currentShift ? 'ON_SHIFT' : 'OFF_SHIFT') as 'ON_SHIFT' | 'OFF_SHIFT',
        assignedCount,
        inProgressCount,
        activeTaskCount,
        workloadLevel: workloadLevelFor(activeTaskCount),
        currentShift: currentShift as unknown as OfficerShiftSummary | null,
      };
    }).sort((left, right) => {
      if (left.shiftStatus !== right.shiftStatus) return left.shiftStatus === 'ON_SHIFT' ? -1 : 1;
      return left.activeTaskCount - right.activeTaskCount || left.officer.fullName.localeCompare(right.officer.fullName);
    });
  }
}

export const officerShiftService = new OfficerShiftService();
export const getWorkloadLevel = workloadLevelFor;
