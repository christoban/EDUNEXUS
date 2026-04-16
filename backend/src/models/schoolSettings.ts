import mongoose, { Document, Schema } from "mongoose";

export interface ISchoolSettings extends Document {
  schoolName: string;
  schoolMotto: string;
  schoolLogoUrl?: string;
  academicCalendarType: "trimester" | "semester";
  preferredLanguage: "fr" | "en";
  schoolLanguageMode: "anglophone" | "francophone" | "bilingual";
  officialLanguages: string[];
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
    officialLanguages: {
      type: [String],
      default: ["fr"],
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model<ISchoolSettings>("SchoolSettings", schoolSettingsSchema);
