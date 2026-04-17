import mongoose, { Document, Schema } from "mongoose";

export type SectionLanguage = "fr" | "en";
export type SectionCycle = "maternelle" | "primaire" | "secondaire_1" | "secondaire_2" | "technique";

export interface ISection extends Document {
  schoolSettings?: mongoose.Types.ObjectId | null;
  subSystem: mongoose.Types.ObjectId;
  name: string;
  language: SectionLanguage;
  cycle: SectionCycle;
  isActive: boolean;
}

const sectionSchema = new Schema<ISection>(
  {
    schoolSettings: {
      type: Schema.Types.ObjectId,
      ref: "SchoolSettings",
      default: null,
      index: true,
    },
    subSystem: {
      type: Schema.Types.ObjectId,
      ref: "SubSystem",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    language: {
      type: String,
      enum: ["fr", "en"],
      required: true,
      index: true,
    },
    cycle: {
      type: String,
      enum: ["maternelle", "primaire", "secondaire_1", "secondaire_2", "technique"],
      required: true,
      index: true,
    },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

sectionSchema.index({ schoolSettings: 1, name: 1 }, { unique: true });

export default mongoose.model<ISection>("Section", sectionSchema);
