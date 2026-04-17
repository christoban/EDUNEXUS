import mongoose, { Document, Schema } from "mongoose";

export type AcademicPeriodType = "SEQUENCE" | "TERM" | "MONTH";

export interface IAcademicPeriod extends Document {
  academicYear: mongoose.Types.ObjectId;
  section: mongoose.Types.ObjectId;
  type: AcademicPeriodType;
  number: number;
  trimester?: number | null;
  startDate: Date;
  endDate: Date;
  isBulletinPeriod: boolean;
  isCouncilPeriod: boolean;
}

const academicPeriodSchema = new Schema<IAcademicPeriod>(
  {
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
      index: true,
    },
    section: {
      type: Schema.Types.ObjectId,
      ref: "Section",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["SEQUENCE", "TERM", "MONTH"],
      required: true,
    },
    number: { type: Number, required: true, min: 1, max: 12 },
    trimester: { type: Number, min: 1, max: 3, default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isBulletinPeriod: { type: Boolean, default: false, required: true },
    isCouncilPeriod: { type: Boolean, default: false, required: true },
  },
  { timestamps: true }
);

academicPeriodSchema.index({ academicYear: 1, section: 1, type: 1, number: 1 }, { unique: true });

export default mongoose.model<IAcademicPeriod>("AcademicPeriod", academicPeriodSchema);
