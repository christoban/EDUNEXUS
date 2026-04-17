import mongoose, { Document, Schema } from "mongoose";

export type SchoolSystemType = "francophone" | "anglophone" | "bilingual";
export type SchoolStructure = "simple" | "complex"; // simple=une seule école, complex=complexe scolaire avec campus

export interface ISchool extends Document {
  // Identité
  schoolName: string;
  schoolMotto: string;
  systemType: SchoolSystemType;
  structure: SchoolStructure;
  
  // Connexion DB
  dbName: string; // ex: "edunexus_school_college_sacre_coeur"
  dbConnectionString: string; // ex: "mongodb+srv://user:pass@cluster.mongodb.net/edunexus_school_college_sacre_coeur"
  
  // Metadata
  foundedYear?: number;
  location?: string;
  contactEmail?: string;
  contactPhone?: string;
  
  // Relations (complexe scolaire parent, si applicable)
  parentComplex?: mongoose.Types.ObjectId | null; // ref: Complex
  
  // État
  isActive: boolean;
  isPilot: boolean; // Phase 8 pilot flag
  
  // Audit
  createdBy?: mongoose.Types.ObjectId | null; // ref: MasterUser
}

const schoolSchema = new Schema<ISchool>(
  {
    schoolName: { type: String, required: true, trim: true, unique: true },
    schoolMotto: { type: String, required: true, trim: true },
    systemType: {
      type: String,
      enum: ["francophone", "anglophone", "bilingual"],
      required: true,
    },
    structure: {
      type: String,
      enum: ["simple", "complex"],
      default: "simple",
      required: true,
    },
    dbName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    dbConnectionString: {
      type: String,
      required: true,
      trim: true,
    },
    foundedYear: { type: Number, default: null },
    location: { type: String, default: null },
    contactEmail: { type: String, default: null },
    contactPhone: { type: String, default: null },
    parentComplex: {
      type: Schema.Types.ObjectId,
      ref: "SchoolComplex",
      default: null,
    },
    isActive: { type: Boolean, default: true, index: true },
    isPilot: { type: Boolean, default: false, index: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "MasterUser",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model<ISchool>("School", schoolSchema);
