import mongoose, { Document, Schema } from "mongoose";

export interface ISchoolSettings extends Document {
  schoolName: string;
  schoolMotto: string;
  schoolLogoUrl?: string;
  academicCalendarType: "trimester" | "semester";
  preferredLanguage: "fr" | "en";
  schoolLanguageMode: "anglophone" | "francophone" | "bilingual";
  mode: "simple_fr" | "simple_en" | "bilingual" | "complex";
  cycles: Array<"maternelle" | "primaire" | "secondaire_1" | "secondaire_2" | "technique">;
  hasMultipleCycles: boolean;
  officialLanguages: string[];
  attendanceLateAsAbsence: boolean;
  attendanceExcusedCountsAsAbsence: boolean;
  councilDecisionMode: "manual" | "automatic";
  councilPassAverageThreshold: number;
  councilMaxAbsences: number;
  bulletinBlockOnUnpaidFees: boolean;
  bulletinAllowedOutstandingBalance: number;
}

const schoolSettingsSchema = new Schema<ISchoolSettings>(
  {
    schoolName: { type: String, required: true, trim: true },
    schoolMotto: { type: String, required: true, trim: true },
    schoolLogoUrl: { type: String, default: "", trim: true },
    academicCalendarType: {
      type: String,
      enum: ["trimester", "semester"],
      default: "trimester",
      required: true,
    },
    preferredLanguage: {
      type: String,
      enum: ["fr", "en"],
      default: "fr",
      required: true,
    },
    schoolLanguageMode: {
      type: String,
      enum: ["anglophone", "francophone", "bilingual"],
      default: "francophone",
      required: true,
    },
    mode: {
      type: String,
      enum: ["simple_fr", "simple_en", "bilingual", "complex"],
      default: "simple_fr",
      required: true,
    },
    cycles: {
      type: [String],
      enum: ["maternelle", "primaire", "secondaire_1", "secondaire_2", "technique"],
      default: ["secondaire_1", "secondaire_2"],
      required: true,
    },
    hasMultipleCycles: {
      type: Boolean,
      default: true,
      required: true,
    },
    officialLanguages: {
      type: [String],
      default: ["fr"],
      required: true,
    },
    attendanceLateAsAbsence: { type: Boolean, default: true },
    attendanceExcusedCountsAsAbsence: { type: Boolean, default: false },
    councilDecisionMode: { type: String, enum: ["manual", "automatic"], default: "automatic" },
    councilPassAverageThreshold: { type: Number, default: 50, min: 0, max: 100 },
    councilMaxAbsences: { type: Number, default: 10, min: 0 },
    bulletinBlockOnUnpaidFees: { type: Boolean, default: false },
    bulletinAllowedOutstandingBalance: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<ISchoolSettings>("SchoolSettings", schoolSettingsSchema);
