import mongoose, { Schema, Document } from 'mongoose';

export interface IMedia extends Document {
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const mediaSchema = new Schema<IMedia>({
  url: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedBy: { type: String, required: true, index: true },
}, { timestamps: true });

export const Media = mongoose.model<IMedia>('Media', mediaSchema);
