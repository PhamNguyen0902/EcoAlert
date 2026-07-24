import mongoose, { Schema } from 'mongoose';
import { baseSchemaPlugin, BaseDocument } from './base.model';

export interface ICategory extends BaseDocument {
  name: string;
  code: string;
  description?: string;
  icon?: string;
  defaultSeverity: string;
  isActive: boolean;
  softDelete(userId: string): Promise<this>;
}

const categorySchema = new Schema<ICategory>({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  description: { type: String, trim: true },
  icon: { type: String, trim: true, default: 'AlertTriangle' },
  defaultSeverity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

categorySchema.plugin(baseSchemaPlugin);
categorySchema.index({ code: 1, isActive: 1 });

export const Category = mongoose.model<ICategory>('Category', categorySchema);
