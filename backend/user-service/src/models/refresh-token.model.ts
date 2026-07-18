import mongoose, { Schema, Types } from 'mongoose';
import { baseSchemaPlugin, BaseDocument } from './base.model';

export interface IRefreshToken extends BaseDocument {
  token: string;
  userId: Types.ObjectId | string;
  expiresAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>({
  token: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

refreshTokenSchema.plugin(baseSchemaPlugin);
refreshTokenSchema.index({ token: 1 }, { unique: true });
refreshTokenSchema.index({ userId: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);
