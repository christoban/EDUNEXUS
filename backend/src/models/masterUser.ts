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
  mfaEnabled: boolean;
  mfaSecret?: string | null;
  mfaTempSecret?: string | null;
  mfaRecoveryCodeHashes?: string[];
  mfaRecoveryCodeGeneratedAt?: Date | null;
  loginEmailOtpHash?: string | null;
  loginEmailOtpExpiresAt?: Date | null;
  loginEmailOtpAttempts?: number;
  loginEmailOtpSentAt?: Date | null;
  passwordChangeEmailOtpHash?: string | null;
  passwordChangeEmailOtpExpiresAt?: Date | null;
  passwordChangeEmailOtpAttempts?: number;
  passwordChangeEmailOtpSentAt?: Date | null;
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
    mfaEnabled: { type: Boolean, default: false, index: true },
    mfaSecret: { type: String, default: null, select: false },
    mfaTempSecret: { type: String, default: null, select: false },
    mfaRecoveryCodeHashes: { type: [String], default: [], select: false },
    mfaRecoveryCodeGeneratedAt: { type: Date, default: null, select: false },
    loginEmailOtpHash: { type: String, default: null, select: false },
    loginEmailOtpExpiresAt: { type: Date, default: null, select: false, index: true },
    loginEmailOtpAttempts: { type: Number, default: 0, select: false },
    loginEmailOtpSentAt: { type: Date, default: null, select: false },
    passwordChangeEmailOtpHash: { type: String, default: null, select: false },
    passwordChangeEmailOtpExpiresAt: { type: Date, default: null, select: false, index: true },
    passwordChangeEmailOtpAttempts: { type: Number, default: 0, select: false },
    passwordChangeEmailOtpSentAt: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

const OTP_FIELDS = [
  "loginEmailOtpHash",
  "loginEmailOtpExpiresAt",
  "loginEmailOtpAttempts",
  "loginEmailOtpSentAt",
] as const;

const hasOtpMutation = (update: any) => {
  if (!update || typeof update !== "object") return false;

  const directMutation = OTP_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(update, field));
  if (directMutation) return true;

  const setMutation =
    update.$set && OTP_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(update.$set, field));
  if (setMutation) return true;

  const unsetMutation =
    update.$unset && OTP_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(update.$unset, field));
  if (unsetMutation) return true;

  const incMutation =
    update.$inc && OTP_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(update.$inc, field));
  if (incMutation) return true;

  return false;
};

const traceOtpMutation = function (this: any, op: string) {
  if ((process.env.MASTER_DEBUG_OTP_MUTATIONS || "false").toLowerCase() !== "true") {
    return;
  }

  const update = this.getUpdate?.();
  if (!hasOtpMutation(update)) {
    return;
  }

  const stack = new Error("OTP mutation trace").stack
    ?.split("\n")
    .slice(2, 8)
    .join("\n");

  console.warn("[MASTER USER][OTP MUTATION]", {
    op,
    query: this.getQuery?.(),
    update,
    stack,
  });
};

masterUserSchema.pre("updateOne", function () {
  traceOtpMutation.call(this, "updateOne");
});

masterUserSchema.pre("findOneAndUpdate", function () {
  traceOtpMutation.call(this, "findOneAndUpdate");
});

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
