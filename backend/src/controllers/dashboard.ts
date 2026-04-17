import { type Request, type Response } from "express";
import User from "../models/user.ts";
import Class from "../models/class.ts";
import Exam from "../models/exam.ts";
import Submission from "../models/submission.ts";
import ActivityLog from "../models/activitieslog.ts";
import Timetable from "../models/timetable.ts";
import Attendance from "../models/attendance.ts";

const formatPercent = (numerator: number, denominator: number) => {
  if (!denominator) {
    return "0%";
  }
  return `${Math.round((numerator / denominator) * 100)}%`;
};

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
    const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
    const cycle = typeof req.query.cycle === "string" ? req.query.cycle : undefined;

    const classesQuery: any = {};
    if (sectionId) {
      classesQuery.section = sectionId;
    }
    if (cycle) {
      const matchingClasses = await Class.find({ ...classesQuery })
        .populate("section", "cycle")
        .select("_id section")
        .lean();
      const matchingClassIds = matchingClasses
        .filter((schoolClass: any) => String(schoolClass.section?.cycle || "") === cycle)
        .map((schoolClass) => schoolClass._id);
      classesQuery._id = { $in: matchingClassIds.length ? matchingClassIds : ["__no_match__"] };
    }

    const filteredClasses = await Class.find(classesQuery).select("_id name section classTeacher").lean();
    const filteredClassIds = filteredClasses.map((schoolClass) => schoolClass._id);
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
      const totalStudents = filteredClassIds.length
        ? await User.countDocuments({ role: "student", studentClass: { $in: filteredClassIds } } as any)
        : 0;
      const totalTeachers = filteredClassIds.length
        ? new Set(
            filteredClasses
              .map((schoolClass: any) => String(schoolClass.classTeacher || ""))
              .filter(Boolean)
          ).size
        : await User.countDocuments({ role: "teacher" });
      const activeExams = filteredClassIds.length
        ? await Exam.countDocuments({ isActive: true, class: { $in: filteredClassIds } })
        : await Exam.countDocuments({ isActive: true });

      const [presentLikeAttendanceCount, totalAttendanceCount] = await Promise.all([
        filteredClassIds.length
          ? Attendance.countDocuments({
              class: { $in: filteredClassIds },
              status: { $in: ["present", "late", "excused"] },
            })
          : Attendance.countDocuments({ status: { $in: ["present", "late", "excused"] } }),
        filteredClassIds.length
          ? Attendance.countDocuments({ class: { $in: filteredClassIds } })
          : Attendance.countDocuments(),
      ]);
      const avgAttendance = formatPercent(
        presentLikeAttendanceCount,
        totalAttendanceCount
      );

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

      if (filteredClassIds.length) {
        (classFilter as any)._id = { $in: filteredClassIds };
      }

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

      if (filteredClassIds.length) {
        (examFilter as any).class = { $in: filteredClassIds };
      }

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

      const [myPresentLikeAttendanceCount, myTotalAttendanceCount] = await Promise.all([
        Attendance.countDocuments({
          student: user._id,
          status: { $in: ["present", "late", "excused"] },
        }),
        Attendance.countDocuments({ student: user._id }),
      ]);
      const myAttendance = formatPercent(
        myPresentLikeAttendanceCount,
        myTotalAttendanceCount
      );

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
    } else if (user.role === "parent") {
      // Get parent's children (students)
      const parentChildrenQuery: any = {
        role: "student",
        parentId: user._id,
      };

      if (filteredClassIds.length) {
        parentChildrenQuery.studentClass = { $in: filteredClassIds };
      }

      const parentChildren = await User.find(parentChildrenQuery)
        .select("_id name studentClass schoolSection")
        .populate({
          path: "studentClass",
          select: "name section",
          populate: { path: "section", select: "name language cycle subSystem", populate: { path: "subSystem", select: "code name" } },
        });

      const childIds = parentChildren.map((child) => child._id);

      // Get attendance for all children
      const [childrenPresentAttendance, childrenTotalAttendance] = await Promise.all([
        Attendance.countDocuments({
          student: { $in: childIds },
          status: { $in: ["present", "late", "excused"] },
        }),
        Attendance.countDocuments({
          student: { $in: childIds },
        }),
      ]);

      const childrenAvgAttendance = formatPercent(
        childrenPresentAttendance,
        childrenTotalAttendance
      );

      const childClassIds = parentChildren
        .map((child) => child.studentClass)
        .filter(
          (classId): classId is NonNullable<typeof classId> => classId != null
        );

      // Get upcoming exams for children
      const upcomingExams = await Exam.find({
        class: { $in: childClassIds },
        isActive: true,
        dueDate: { $gte: new Date() },
      })
        .select("title dueDate")
        .sort({ dueDate: 1 })
        .limit(3);

      stats = {
        childrenCount: childIds.length,
        childrenAvgAttendance,
        childrenNames: parentChildren.map((c) => c.name),
        childrenBySection: parentChildren.reduce((acc: Record<string, number>, child: any) => {
          const sectionName = child.studentClass?.section?.name || child.schoolSection || "Unknown";
          acc[sectionName] = (acc[sectionName] || 0) + 1;
          return acc;
        }, {}),
        upcomingExams: upcomingExams.map((e) => ({
          title: e.title,
          dueDate: new Date(e.dueDate).toLocaleDateString(),
        })),
        recentActivity: formattedActivity,
      };
    }
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};