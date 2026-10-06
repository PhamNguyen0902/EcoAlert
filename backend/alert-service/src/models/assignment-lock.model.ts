import { Schema, model } from "mongoose";
// Bounded lease serializes manual and auto dispatch across service instances.
const schema = new Schema({ _id: String, owner: String, expiresAt: Date });
export const AssignmentLock = model("AssignmentLock", schema);
