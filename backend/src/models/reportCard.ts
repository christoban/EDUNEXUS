import mongoose, { Document, Schema } from "mongoose";
import type { ReportPeriod } from "../utils/reporting.ts";

export interface IReportCard extends Document {
  student: mongoose.Types.ObjectId;
  year: mongoose.Types.ObjectId;
  period: ReportPeriod;
  grades: mongoose.Types.ObjectId[];
  aggregates: {
    average: number;
    totalExams: number;
    passedExams: number;
    failedExams: number;
    highestPercentage: number;
    lowestPercentage: number;
  };
  mention: string;
}

const reportCardSchema = new Schema<IReportCard>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
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
    grades: [{ type: Schema.Types.ObjectId, ref: "Grade" }],
    aggregates: {
      average: { type: Number, required: true, min: 0, max: 100 },
      totalExams: { type: Number, required: true, min: 0 },
      passedExams: { type: Number, required: true, min: 0 },
      failedExams: { type: Number, required: true, min: 0 },
      highestPercentage: { type: Number, required: true, min: 0, max: 100 },
      lowestPercentage: { type: Number, required: true, min: 0, max: 100 },
    },
    mention: { type: String, required: true },
  },
  { timestamps: true }
);

reportCardSchema.index({ student: 1, year: 1, period: 1 }, { unique: true });

export default mongoose.model<IReportCard>("ReportCard", reportCardSchema);
