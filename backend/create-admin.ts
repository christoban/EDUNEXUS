import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Connect to MASTER DB
const MASTER_DB_URL = process.env.MASTER_MONGO_URL || "mongodb://localhost:27017/edunexus_master";

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
  await MasterUser.deleteOne({ email: "admin@edunexus.fr" });
  const hashedPassword = await bcrypt.hash("SecurePassword123!", 10);
  const adminUser = new MasterUser({
    name: "Platform Administrator",
    email: "admin@edunexus.fr",
    password: hashedPassword,
    role: "super_admin",
    isActive: true,
  });
  await adminUser.save();
  console.log("✅ Super Admin created:");
  console.log(`   Email: admin@edunexus.fr`);
  console.log(`   Password: SecurePassword123!`);
  console.log(`   Role: super_admin`);
} catch (error: any) {
  console.error("❌ Error creating super_admin:", error.message);
}

// Close connection
await mongoose.disconnect();
console.log("✓ Database connection closed");
