import mongoose, { Document, Schema } from "mongoose";

export type GradingSystemType = "over_20" | "percent" | "grades_ae" | "competency_ana";
export type TermsType = "sequences_6" | "terms_3" | "monthly_9" | "trimesters_3";

export interface ISchoolConfig extends Document {
  // Config par école (stockée dans MASTER DB pour référence)
  school: mongoose.Types.ObjectId; // ref: School
  
  // Système de notation
  gradingSystem: GradingSystemType;
  passingGrade: number; // ex: 10 pour /20, 50 pour %
  
  // Périodes
  termsType: TermsType;
  termsNames?: string[]; // ex: ["Trimestre 1", "Trimestre 2", "Trimestre 3"]
  
  // Matières standard (config template)
  standardSubjects?: Array<{
    name: string;
    code: string;
    coefficient?: number;
  }>;
  
  // Bulletin config
  bulletinFormat: "standard" | "detailed" | "compact";
  includeRankings: boolean;
  
  // Metadata
  metadata?: Record<string, any>; // flex field pour configs futures
}

const schoolConfigSchema = new Schema<ISchoolConfig>(
  {
    school: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      unique: true,
      index: true,
    },
    gradingSystem: {
      type: String,
      enum: ["over_20", "percent", "grades_ae", "competency_ana"],
      default: "over_20",
      required: true,
    },
    passingGrade: { type: Number, default: 10, required: true },
    termsType: {
      type: String,
      enum: ["sequences_6", "terms_3", "monthly_9", "trimesters_3"],
      default: "trimesters_3",
      required: true,
    },
    termsNames: {
      type: [String],
      default: ["Trimestre 1", "Trimestre 2", "Trimestre 3"],
    },
    standardSubjects: [
      {
        name: { type: String, required: true },
        code: { type: String, required: true },
        coefficient: { type: Number, default: 1 },
      },
    ],
    bulletinFormat: {
      type: String,
      enum: ["standard", "detailed", "compact"],
      default: "standard",
    },
    includeRankings: { type: Boolean, default: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model<ISchoolConfig>("SchoolConfig", schoolConfigSchema);
