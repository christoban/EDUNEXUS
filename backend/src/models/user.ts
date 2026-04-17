import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export enum UserRole {
  ADMIN = "admin",
  TEACHER = "teacher",
  STUDENT = "student",
  PARENT = "parent",
}

export type userRoles = "admin" | "teacher" | "student" | "parent";
export type schoolSections = "francophone" | "anglophone" | "bilingual";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: userRoles;
  isActive: boolean;
  schoolId?: mongoose.Types.ObjectId | null; // ✅ MULTI-TENANT: School affiliation
  studentClass?: string | null;
  teacherSubject?: string[] | null;
  parentId?: string | null; // Parent reference for students
  parentLanguagePreference?: "fr" | "en"; // Language preference for parent users only
  schoolSection?: schoolSections;
  uiLanguagePreference?: "fr" | "en";
  matchPassword: (enteredPassword: string) => Promise<boolean>;
}

const userSchema: Schema<IUser> = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
      default: UserRole.STUDENT,
    },
    isActive: { type: Boolean, default: true },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },
    studentClass: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
    teacherSubject: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Reference to parent user
    parentLanguagePreference: {
      type: String,
      enum: ["fr", "en"],
      default: "fr",
    },
    schoolSection: {
      type: String,
      enum: ["francophone", "anglophone", "bilingual"],
      default: "francophone",
    },
    uiLanguagePreference: {
      type: String,
      enum: ["fr", "en"],
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

// pre-save middleware to hash password
userSchema.pre<IUser>("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// method to match entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword: string) {
  return await bcrypt.compare(enteredPassword, this.password);
};
 
const User = mongoose.model<IUser>("User", userSchema);
export default User;