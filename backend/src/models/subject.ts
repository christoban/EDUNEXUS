import mongoose, { Schema, Document } from "mongoose";

export interface ISubject extends Document {
  name: string; // "Mathematics"
  code: string; // "MATH101"
  teacher?: mongoose.Types.ObjectId[]; // Default teacher for this subject
  coefficient?: number; // Used in report cards / bulletins
  appreciation?: string; // General appreciation note for bulletin (e.g., "Bon élève", "Excellent travail")
  isActive: boolean; // Indicates if the subject is currently active
}

const subjectSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    teacher: [{ type: Schema.Types.ObjectId, ref: "User" }],
    coefficient: { type: Number, default: 1, min: 1 },
    appreciation: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<ISubject>("Subject", subjectSchema);