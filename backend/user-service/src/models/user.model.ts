import mongoose, { Schema } from "mongoose";
import { baseSchemaPlugin, BaseDocument } from "./base.model";
import { UserRole } from "@ecoalert/shared";

export interface IUser extends BaseDocument {
  email: string;
  password?: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  softDelete(userId: string): Promise<this>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, select: false },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    avatar: { type: String },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CITIZEN,
    },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  },
);
userSchema.virtual("firstName").get(function () {
  if (!this.fullName) return "";
  const parts = this.fullName.trim().split(/\s+/);
  return parts[0] || "";
});
userSchema.virtual("lastName").get(function () {
  if (!this.fullName) return "";
  const parts = this.fullName.trim().split(/\s+/);
  return parts.slice(1).join(" ") || "";
});

userSchema.plugin(baseSchemaPlugin);

userSchema.index({ role: 1 });
userSchema.index({ isActive: 1, isDeleted: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
