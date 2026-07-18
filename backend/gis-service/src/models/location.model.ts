import mongoose, { Schema, Document } from 'mongoose';

export interface ILocation extends Document {
  alertId: string;
  category: string;
  severity: string;
  status: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
}

const locationSchema = new Schema<ILocation>({
  alertId: { type: String, required: true, unique: true },
  category: { type: String },
  severity: { type: String },
  status: { type: String },
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true },
  },
}, { timestamps: true });

locationSchema.index({ location: '2dsphere' });

export const Location = mongoose.model<ILocation>('Location', locationSchema);
