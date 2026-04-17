import dotenv from "dotenv";
import User from "../models/user.ts";
import School from "../models/school.ts";
import { connectDB } from "../config/db.ts";
import { dbRouter } from "../config/dbRouter.ts";

dotenv.config();

const run = async () => {
  const masterUrl = process.env.MASTER_MONGO_URL;

  if (!masterUrl) {
    throw new Error("MASTER_MONGO_URL is required to run phase 8 migration");
  }

  await connectDB();
  const masterConn = await dbRouter.initMasterDB(masterUrl);
  const SchoolModel: any = masterConn.model("School", School.schema);

  const defaultSchool: any = await SchoolModel.findOne({ dbName: "edunexus_school_1" })
    .select("_id schoolName dbName")
    .lean();

  if (!defaultSchool?._id) {
    throw new Error("Default school with dbName=edunexus_school_1 not found in MASTER DB");
  }

  const totalUsers = await User.countDocuments({});

  const result = await User.updateMany(
    {
      $or: [{ schoolId: { $exists: false } }, { schoolId: null }],
    },
    {
      $set: { schoolId: defaultSchool._id },
    }
  );

  const usersWithSchoolId = await User.countDocuments({ schoolId: { $ne: null } });

  console.log(`Phase 8 migration completed.`);
  console.log(`Default school: ${defaultSchool.schoolName} (${defaultSchool.dbName})`);
  console.log(`Total users: ${totalUsers}`);
  console.log(`Users migrated: ${result.modifiedCount}`);
  console.log(`Users with schoolId: ${usersWithSchoolId}`);
};

run()
  .then(async () => {
    await dbRouter.closeAllConnections();
    process.exit(0);
  })
  .catch(async (error: any) => {
    console.error(error?.message || error);
    await dbRouter.closeAllConnections();
    process.exit(1);
  });
