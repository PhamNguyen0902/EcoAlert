import { Schema, Query, Types, Document } from 'mongoose';
import { IBaseDocument } from '@ecoalert/shared';

export interface BaseDocument extends IBaseDocument, Document {
  _id: Types.ObjectId;
}

export const baseSchemaPlugin = (schema: Schema): void => {
  schema.add({
    createdBy: { type: String, default: '' },
    updatedBy: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
  });

  schema.pre(/^find/, function (this: Query<unknown, unknown>, next) {
    const query = this.getFilter();
    if (!query.includeDeleted) {
      this.where({ isDeleted: false });
    } else {
      delete query.includeDeleted;
    }
    next();
  });

  schema.methods.softDelete = function (userId: string) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.updatedBy = userId;
    return this.save();
  };
};
