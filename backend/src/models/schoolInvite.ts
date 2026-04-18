import mongoose, { Document, Schema } from "mongoose";

export type SchoolInviteStatus = "pending" | "accepted" | "expired";

export interface ISchoolInvite extends Document {
  school: mongoose.Types.ObjectId;
  token: string;
  requestedAdminName: string;
  requestedAdminEmail: string;
  status: SchoolInviteStatus;
  expiresAt: Date;
  acceptedAt?: Date | null;
  metadata?: Record<string, unknown>;
}

const schoolInviteSchema = new Schema<ISchoolInvite>(
  {
    school: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    requestedAdminName: { type: String, required: true, trim: true },
    requestedAdminEmail: { type: String, required: true, trim: true, lowercase: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired"],
      default: "pending",
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model<ISchoolInvite>("SchoolInvite", schoolInviteSchema);