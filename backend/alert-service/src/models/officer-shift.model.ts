import mongoose, { Schema } from 'mongoose';
import { baseSchemaPlugin, BaseDocument } from './base.model';

export type OfficerShiftStatus = 'ACTIVE' | 'COMPLETED';

export interface IShiftLocation {
  type: 'Point';
  coordinates: [number, number];
  accuracyMeters: number;
}

export interface IOfficerShift extends BaseDocument {
  officerId: string;
  status: OfficerShiftStatus;
  startedAt: Date;
  endedAt?: Date;
  startLocation: IShiftLocation;
  endLocation?: IShiftLocation;
  softDelete(userId: string): Promise<this>;
}

const shiftLocationSchema = new Schema<IShiftLocation>({
  type: { type: String, enum: ['Point'], required: true },
  coordinates: { type: [Number], required: true },
  accuracyMeters: { type: Number, required: true, min: 0 },
}, { _id: false });

const officerShiftSchema = new Schema<IOfficerShift>({
  officerId: { type: String, required: true, index: true },
  status: { type: String, enum: ['ACTIVE', 'COMPLETED'], required: true },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date },
  startLocation: { type: shiftLocationSchema, required: true },
  endLocation: { type: shiftLocationSchema },
}, { timestamps: true });

officerShiftSchema.plugin(baseSchemaPlugin);
// The partial unique index prevents two ACTIVE shifts even under concurrent requests.
officerShiftSchema.index(
  { officerId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE', isDeleted: false } },
);
officerShiftSchema.index({ officerId: 1, startedAt: -1 });

export const OfficerShift = mongoose.model<IOfficerShift>('OfficerShift', officerShiftSchema);
