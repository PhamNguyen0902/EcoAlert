import mongoose, { Schema } from "mongoose";
import type { ServiceAreaData } from "@ecoalert/shared";
const schema = new Schema<
  ServiceAreaData & { createdBy?: string; updatedBy?: string }
>(
  {
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    administrativeLevel: {
      type: String,
      enum: ["WARD", "DISTRICT", "CUSTOM"],
      required: true,
    },
    parentCode: String,
    geometry: {
      type: { type: String, enum: ["Polygon", "MultiPolygon"], required: true },
      coordinates: { type: Schema.Types.Mixed, required: true },
    },
    assignedOfficerIds: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    createdBy: String,
    updatedBy: String,
  },
  { timestamps: true },
);
schema.index({ geometry: "2dsphere" });
schema.index({ code: 1 }, { unique: true });
schema.index({ isActive: 1, assignedOfficerIds: 1 });
export const ServiceArea = mongoose.model("ServiceArea", schema);
