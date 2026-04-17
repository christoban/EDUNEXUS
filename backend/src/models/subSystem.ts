import mongoose, { Document, Schema } from "mongoose";

export type SubSystemCode =
  | "FR_GENERAL_SEC"
  | "FR_PRIMAIRE"
  | "FR_TECHNIQUE_SEC"
  | "EN_GENERAL_SEC"
  | "EN_PRIMAIRE"
  | "EN_TECHNIQUE_SEC"
  | "MATERNELLE";

export type GradingScale = "OVER_20" | "PERCENT" | "GRADES_AE" | "COMPETENCY_ANA";
export type PeriodType = "SEQUENCES_6" | "TERMS_3" | "MONTHLY_9";

export interface ISubSystem extends Document {
  code: SubSystemCode;
  name: string;
  gradingScale: GradingScale;
  periodType: PeriodType;
  hasCoefficientBySubject: boolean;
  passThreshold: number;
  bulletinTemplate?: string | null;
  isActive: boolean;
}

const subSystemSchema = new Schema<ISubSystem>(
  {
    code: {
      type: String,
      enum: [
        "FR_GENERAL_SEC",
        "FR_PRIMAIRE",
        "FR_TECHNIQUE_SEC",
        "EN_GENERAL_SEC",
        "EN_PRIMAIRE",
        "EN_TECHNIQUE_SEC",
        "MATERNELLE",
      ],
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    gradingScale: {
      type: String,
      enum: ["OVER_20", "PERCENT", "GRADES_AE", "COMPETENCY_ANA"],
      required: true,
    },
    periodType: {
      type: String,
      enum: ["SEQUENCES_6", "TERMS_3", "MONTHLY_9"],
      required: true,
    },
    hasCoefficientBySubject: { type: Boolean, default: false, required: true },
    passThreshold: { type: Number, required: true },
    bulletinTemplate: { type: String, default: null },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<ISubSystem>("SubSystem", subSystemSchema);
