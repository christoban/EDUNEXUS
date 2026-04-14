import mongoose, { Schema, Document } from "mongoose";

export interface IActivityLog extends Document {
  user: string; // Who did it?
  action: string; // "Created Exam", "Registered Student"
  details?: string; // optional additional details
  createdAt: Date;
}

// types don't need to be defined in the schema more so here where we define user as string instead of objectId
const activitiesLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    action: { type: String, required: true },
    details: { type: String },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IActivityLog>(
  "ActivitiesLog",
  activitiesLogSchema
);