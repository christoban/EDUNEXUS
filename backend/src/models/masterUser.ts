import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export type MasterUserRole = "super_admin" | "platform_admin" | "school_manager" | "support";

export interface IMasterUser extends Document {
  // User global (platform-level)
  name: string;
  email: string;
  password: string;
  role: MasterUserRole;
  
  // School affiliation (si applicable)
  assignedSchools: mongoose.Types.ObjectId[]; // ref: School (pour school_manager)
  
  isActive: boolean;
  matchPassword: (enteredPassword: string) => Promise<boolean>;
}

const masterUserSchema = new Schema<IMasterUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["super_admin", "platform_admin", "school_manager", "support"],
      required: true,
    },
    assignedSchools: [
      {
        type: Schema.Types.ObjectId,
        ref: "School",
      },
    ],
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// Hash password before save
masterUserSchema.pre<IMasterUser>("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password
masterUserSchema.methods.matchPassword = async function (enteredPassword: string) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model<IMasterUser>("MasterUser", masterUserSchema);
