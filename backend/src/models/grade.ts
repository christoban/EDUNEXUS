import mongoose, { Document, Schema } from "mongoose";
import type { ReportPeriod } from "../utils/reporting.ts";

export interface IGrade extends Document {
  exam: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  score: number;
  maxScore: number;
  percentage: number;
  scoreOn20: number;
  coefficient: number;
  gradeLabel?: string | null;
  gradingScale?: "OVER_20" | "PERCENT" | "GRADES_AE" | "COMPETENCY_ANA";
  hasCoefficientBySubjectAtSource?: boolean;
  passThresholdOn20AtSource?: number;
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
    scoreOn20: { type: Number, required: true, min: 0, max: 20, index: true },
    coefficient: { type: Number, required: true, min: 1, default: 1 },
    gradeLabel: { type: String, default: null },
    gradingScale: {
      type: String,
      enum: ["OVER_20", "PERCENT", "GRADES_AE", "COMPETENCY_ANA"],
      default: "OVER_20",
    },
    hasCoefficientBySubjectAtSource: { type: Boolean, default: false },
    passThresholdOn20AtSource: { type: Number, min: 0, max: 20, default: 10 },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    year: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
      index: true,
    },
    period: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

gradeSchema.index({ exam: 1, student: 1, year: 1, period: 1 }, { unique: true });

export default mongoose.model<IGrade>("Grade", gradeSchema);
