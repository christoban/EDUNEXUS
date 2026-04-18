import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Connect to MASTER DB
const MASTER_DB_URL = process.env.MASTER_MONGO_URL || "mongodb://localhost:27017/edunexus_master";
const MASTER_ADMIN_EMAIL = String(process.env.MASTER_ADMIN_EMAIL || "").trim().toLowerCase();
const MASTER_ADMIN_PASSWORD = String(process.env.MASTER_ADMIN_PASSWORD || "");
const MASTER_ADMIN_NAME = String(process.env.MASTER_ADMIN_NAME || "").trim();

if (!MASTER_ADMIN_EMAIL || !MASTER_ADMIN_PASSWORD || !MASTER_ADMIN_NAME) {
  throw new Error(
    "MASTER_ADMIN_EMAIL, MASTER_ADMIN_PASSWORD and MASTER_ADMIN_NAME are required"
  );
}

await mongoose.connect(MASTER_DB_URL);
console.log("✓ Connected to MASTER DB");

// Define MasterUser schema
const masterUserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["super_admin", "platform_admin", "school_manager", "support"], required: true },
  assignedSchools: [{ type: mongoose.Schema.Types.ObjectId, ref: "School" }],
  isActive: { type: Boolean, default: true },
});

const MasterUser = mongoose.model("MasterUser", masterUserSchema);

// Create or update super_admin
console.log("Creating super_admin...");
try {
  await MasterUser.deleteOne({ email: MASTER_ADMIN_EMAIL });
  const hashedPassword = await bcrypt.hash(MASTER_ADMIN_PASSWORD, 10);
  const adminUser = new MasterUser({
    name: MASTER_ADMIN_NAME,
    email: MASTER_ADMIN_EMAIL,
    password: hashedPassword,
    role: "super_admin",
    isActive: true,
  });
  await adminUser.save();
  console.log("✅ Super Admin created:");
  console.log(`   Email: ${MASTER_ADMIN_EMAIL}`);
  console.log(`   Password: ${MASTER_ADMIN_PASSWORD}`);
  console.log(`   Role: super_admin`);
} catch (error: any) {
  console.error("❌ Error creating super_admin:", error.message);
}

// Close connection
await mongoose.disconnect();
console.log("✓ Database connection closed");
