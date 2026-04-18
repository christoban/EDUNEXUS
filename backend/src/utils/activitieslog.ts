import ActivitiesLog from "../models/activitieslog.ts";

export const logActivity = async ({
  userId,
  action,
  details,
  schoolId,
}: {
  userId: string;
  action: string;
  details?: string;
  schoolId?: string | null;
}) => {
  try {
    await ActivitiesLog.create({
      user: userId,
      action,
      details,
      school: schoolId || null,
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};