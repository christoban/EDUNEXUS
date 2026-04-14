import mongoose, { Schema, Document } from "mongoose";

export type TimetableGenerationStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export interface ITimetableGeneration extends Document {
  class: mongoose.Types.ObjectId;
  academicYear: mongoose.Types.ObjectId;
  status: TimetableGenerationStatus;
  message?: string;
  timetable?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const timetableGenerationSchema = new Schema(
  {
    class: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
    },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed"],
      default: "queued",
      required: true,
    },
    message: { type: String },
    timetable: { type: Schema.Types.ObjectId, ref: "Timetable", default: null },
  },
  { timestamps: true }
);

export default mongoose.model<ITimetableGeneration>(
  "TimetableGeneration",
  timetableGenerationSchema
);