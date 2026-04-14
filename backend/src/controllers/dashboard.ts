import { type Request, type Response } from "express";
import User from "../models/user.ts";
import Class from "../models/class.ts";
import Exam from "../models/exam.ts";
import Submission from "../models/submission.ts";
import ActivityLog from "../models/activitieslog.ts";
import Timetable from "../models/timetable.ts";

// Helper to get day name (e.g., "Monday")
const getTodayName = () =>
  new Date().toLocaleDateString("en-US", { weekday: "long" });

const getStudentClassName = async (studentClass: unknown) => {
  if (
    studentClass &&
    typeof studentClass === "object" &&
    "name" in studentClass &&
    typeof (studentClass as any).name === "string"
  ) {
    return (studentClass as any).name;
  }

  if (studentClass) {
    const classRecord = await Class.findById(studentClass).select("name").lean();
    return classRecord?.name || null;
  }

  return null;
};

// @desc    Get Dashboard Statistics (Role Based)
// @route   GET /api/dashboard/stats
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let stats = {};
    // Get last 5 activities system-wide (Admin) or personal (Others)
    const activityQuery = user.role === "admin" ? {} : { user: user._id };
    const recentActivities = await ActivityLog.find(activityQuery)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("user", "name");

    const formattedActivity = recentActivities.map(
      (log) =>
        `${(log.user as any).name}: ${log.action} (${new Date(
          log.createdAt as any
        ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
    );

    if (user.role === "admin") {
      const totalStudents = await User.countDocuments({ role: "student" });
      const totalTeachers = await User.countDocuments({ role: "teacher" });
      const activeExams = await Exam.countDocuments({ isActive: true });

      // Mocking Attendance (You'd need an Attendance model for real data)
      const avgAttendance = "94.5%";

      stats = {
        totalStudents,
        totalTeachers,
        activeExams,
        avgAttendance,
        recentActivity: formattedActivity,
      };
    } else if (user.role === "teacher") {
      const teacherSubjectIds = Array.isArray(user.teacherSubject)
        ? user.teacherSubject.map((subjectId: any) => subjectId.toString())
        : [];

      const classFilter = teacherSubjectIds.length
        ? { subjects: { $in: teacherSubjectIds } }
        : { _id: { $exists: false } };

      // 1. Count classes assigned to teacher
      const myClasses = await Class.find(classFilter).select("name").lean();

      const myClassesCount = myClasses.length;
      const myClassNames = myClasses.map((schoolClass) => schoolClass.name);

      const myClassIds = myClasses.map((schoolClass) => schoolClass._id);

      const examFilter = teacherSubjectIds.length
        ? {
            $or: [
              { teacher: user._id },
              { subject: { $in: teacherSubjectIds } },
            ],
          }
        : { teacher: user._id };

      // 2. Submissions to review: total submissions on relevant exams.
      const myExams = await Exam.find(examFilter).select("_id");
      const myExamIds = myExams.map((exam) => exam._id);
      const pendingGrading = await Submission.countDocuments({
        exam: { $in: myExamIds },
      });

      // 3. Next Class (Real timetable lookup for today)
      const today = getTodayName();
      const timetableForToday = await Timetable.find({
        schedule: {
          $elemMatch: {
            day: today,
            periods: {
              $elemMatch: {
                teacher: user._id,
              },
            },
          },
        },
      })
        .populate("class", "name")
        .populate("schedule.periods.subject", "name")
        .limit(1);

      let nextClass = "No scheduled class";
      let nextClassTime = "Enjoy your day!";

      const todaySchedule = timetableForToday[0]?.schedule.find(
        (entry) => entry.day === today
      );

      const nextPeriod = todaySchedule?.periods.find(
        (period) =>
          String((period.teacher as any)?._id || period.teacher) ===
          user._id.toString()
      );

      if (todaySchedule && nextPeriod) {
        const className = timetableForToday[0]?.class
          ? (timetableForToday[0].class as any).name
          : "Class";
        const subjectName = nextPeriod.subject
          ? (nextPeriod.subject as any).name
          : "Subject";

        nextClass = `${subjectName} - ${className}`;
        nextClassTime = `${nextPeriod.startTime} - ${nextPeriod.endTime}`;
      }

      stats = {
        myClassesCount,
        myClassNames,
        pendingGrading,
        nextClass,
        nextClassTime,
        recentActivity: formattedActivity,
      };
    } else if (user.role === "student") {
      const studentClassName = await getStudentClassName(user.studentClass);

      // 1. Assignments/Exams Due
      const nextExam = await Exam.findOne({
        class: user.studentClass,
        dueDate: { $gte: new Date() },
      }).sort({ dueDate: 1 });

      const pendingAssignments = await Exam.countDocuments({
        class: user.studentClass,
        isActive: true,
        dueDate: { $gte: new Date() },
      });

      // 2. Attendance (Mock)
      const myAttendance = "98%";

      stats = {
        myAttendance,
        studentClassName: studentClassName || "No class assigned",
        pendingAssignments,
        nextExam: nextExam?.title || "No upcoming exams",
        nextExamDate: nextExam
          ? new Date(nextExam.dueDate).toLocaleDateString()
          : "",
        recentActivity: formattedActivity,
      };
    }
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};