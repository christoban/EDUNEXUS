import mongoose, { Document, Schema } from "mongoose";

export type MasterAuthOutcome = "success" | "failure" | "blocked";

export interface IMasterAuthAudit extends Document {
  email?: string | null;
  ip: string;
  userAgent?: string | null;
  outcome: MasterAuthOutcome;
  reason: string;
  path: string;
  method: string;
  createdAt: Date;
}

const masterAuthAuditSchema = new Schema<IMasterAuthAudit>(
  {
    email: { type: String, default: null, index: true },
    ip: { type: String, required: true, index: true },
    userAgent: { type: String, default: null },
    outcome: {
      type: String,
      enum: ["success", "failure", "blocked"],
      required: true,
      index: true,
    },
    reason: { type: String, required: true, index: true },
    path: { type: String, required: true },
    method: { type: String, required: true },
  },
  { timestamps: true }
);

masterAuthAuditSchema.index({ createdAt: -1 });

export default mongoose.model<IMasterAuthAudit>(
  "MasterAuthAudit",
  masterAuthAuditSchema
);
