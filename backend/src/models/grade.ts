import mongoose, { Document, Schema } from "mongoose";
import type { ReportPeriod } from "../utils/reporting.ts";

export interface IGrade extends Document {
  exam: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  score: number;
  maxScore: number;
  percentage: number;
  subject: mongoose.Types.ObjectId;
  year: mongoose.Types.ObjectId;
  period: ReportPeriod;
}

const gradeSchema = new Schema<IGrade>(
  {
    exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    score: { type: Number, required: true, min: 0 },
    maxScore: { type: Number, required: true, min: 1 },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    year: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
      index: true,
    },
    period: {
      type: String,
      enum: ["term1", "term2", "term3", "annual"],
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

gradeSchema.index({ exam: 1, student: 1, year: 1, period: 1 }, { unique: true });

export default mongoose.model<IGrade>("Grade", gradeSchema);
