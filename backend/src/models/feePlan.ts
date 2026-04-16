import mongoose, { Schema, type Document } from "mongoose";

export type FeeFrequency = "one_time" | "monthly" | "termly";
export type FeeCategory =
  | "registration"
  | "tuition"
  | "apee_pta"
  | "transport"
  | "canteen"
  | "uniform_supplies"
  | "exam_fees"
  | "other";

export interface IFeePlan extends Document {
  name: string;
  category: FeeCategory;
  frequency: FeeFrequency;
  amount: number;
  currency: "XAF";
  academicYear: mongoose.Types.ObjectId;
  classes: mongoose.Types.ObjectId[];
  dueDayOfMonth?: number;
  isActive: boolean;
  notes?: string;
}

const feePlanSchema = new Schema<IFeePlan>(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: [
        "registration",
        "tuition",
        "apee_pta",
        "transport",
        "canteen",
        "uniform_supplies",
        "exam_fees",
        "other",
      ],
    },
    frequency: {
      type: String,
      required: true,
      enum: ["one_time", "monthly", "termly"],
      default: "one_time",
    },
    amount: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      enum: ["XAF"],
      default: "XAF",
      required: true,
    },
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
      index: true,
    },
    classes: [{ type: Schema.Types.ObjectId, ref: "Class", required: true }],
    dueDayOfMonth: { type: Number, min: 1, max: 31 },
    isActive: { type: Boolean, default: true },
    notes: { type: String },
  },
  { timestamps: true }
);

feePlanSchema.index({ name: 1, academicYear: 1 }, { unique: true });

export default mongoose.model<IFeePlan>("FeePlan", feePlanSchema);
