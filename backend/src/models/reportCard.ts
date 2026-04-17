import mongoose, { Document, Schema } from "mongoose";
import type { ReportPeriod } from "../utils/reporting.ts";

export interface IReportCard extends Document {
  student: mongoose.Types.ObjectId;
  year: mongoose.Types.ObjectId;
  period: ReportPeriod;
  periodCode: string;
  periodLabel: string;
  periodRef?: mongoose.Types.ObjectId | null;
  councilPeriod: boolean;
  templateType: "FR" | "EN" | "PRIMARY" | "KINDERGARTEN";
  grades: mongoose.Types.ObjectId[];
  aggregates: {
    average: number;
    averageScoreOn20: number;
    totalExams: number;
    passedExams: number;
    failedExams: number;
    highestPercentage: number;
    lowestPercentage: number;
  };
  bulletinMeta: {
    rank: number;
    classSize: number;
    classAverage: number;
    classHighest: number;
    classLowest: number;
    absences: number;
    lateCount: number;
    councilDecision?: string;
    signatures: {
      classTeacher: string;
      principal: string;
    };
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
      required: true,
      index: true,
    },
    periodCode: { type: String, required: true, index: true },
    periodLabel: { type: String, required: true },
    periodRef: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      default: null,
      index: true,
    },
    councilPeriod: { type: Boolean, required: true, default: false },
    templateType: {
      type: String,
      enum: ["FR", "EN", "PRIMARY", "KINDERGARTEN"],
      required: true,
      default: "FR",
    },
    grades: [{ type: Schema.Types.ObjectId, ref: "Grade" }],
    aggregates: {
      average: { type: Number, required: true, min: 0, max: 100 },
      averageScoreOn20: { type: Number, required: true, min: 0, max: 20 },
      totalExams: { type: Number, required: true, min: 0 },
      passedExams: { type: Number, required: true, min: 0 },
      failedExams: { type: Number, required: true, min: 0 },
      highestPercentage: { type: Number, required: true, min: 0, max: 100 },
      lowestPercentage: { type: Number, required: true, min: 0, max: 100 },
    },
    bulletinMeta: {
      rank: { type: Number, required: true, min: 1, default: 1 },
      classSize: { type: Number, required: true, min: 1, default: 1 },
      classAverage: { type: Number, required: true, min: 0, max: 100, default: 0 },
      classHighest: { type: Number, required: true, min: 0, max: 100, default: 0 },
      classLowest: { type: Number, required: true, min: 0, max: 100, default: 0 },
      absences: { type: Number, required: true, min: 0, default: 0 },
      lateCount: { type: Number, required: true, min: 0, default: 0 },
      councilDecision: { type: String, default: "" },
      signatures: {
        classTeacher: { type: String, required: true, default: "________________" },
        principal: { type: String, required: true, default: "________________" },
      },
    },
    mention: { type: String, required: true },
  },
  { timestamps: true }
);

reportCardSchema.index({ student: 1, year: 1, periodCode: 1 }, { unique: true });

export default mongoose.model<IReportCard>("ReportCard", reportCardSchema);
