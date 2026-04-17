import mongoose, { Document, Schema } from "mongoose";

export interface ISchoolComplex extends Document {
  // Complexe scolaire = groupe d'écoles liées (primaire + secondaire sous même fondateur)
  complexName: string;
  founder: string;
  foundedYear?: number;
  location?: string;
  
  // Liste des écoles/campus dans ce complexe
  schools: mongoose.Types.ObjectId[]; // ref: School
  
  // État
  isActive: boolean;
}

const schoolComplexSchema = new Schema<ISchoolComplex>(
  {
    complexName: { type: String, required: true, trim: true, unique: true },
    founder: { type: String, required: true, trim: true },
    foundedYear: { type: Number, default: null },
    location: { type: String, default: null },
    schools: [
      {
        type: Schema.Types.ObjectId,
        ref: "School",
      },
    ],
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.model<ISchoolComplex>("SchoolComplex", schoolComplexSchema);
