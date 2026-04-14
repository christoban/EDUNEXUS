import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export enum UserRole {
  ADMIN = "admin",
  TEACHER = "teacher",
  STUDENT = "student",
  PARENT = "parent",
}

export type userRoles = "admin" | "teacher" | "student" | "parent";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: userRoles;
  isActive: boolean;
  studentClass?: string | null;
  teacherSubject?: string[] | null;
  parentId?: string | null; // Parent reference for students
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
    studentClass: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
    teacherSubject: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Reference to parent user
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