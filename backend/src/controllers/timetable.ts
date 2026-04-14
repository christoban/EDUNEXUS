import { type Request, type Response } from "express";
import { logActivity } from "../utils/activitieslog.ts";
import { inngest } from "../inngest/index.ts";
import Timetable from "../models/timetable.ts";
import Class from "../models/class.ts";
import User from "../models/user.ts";
import TimetableGeneration from "../models/timetableGeneration.ts";

const DEFAULT_TEACHING_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MIN_PERIOD_DURATION_MINUTES = 40;
const LUNCH_BREAK_MINUTES = 60;

const toMinutes = (time: string) => {
  const parts = time.split(":").map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours * 60 + minutes;
};

const normalizeSettings = (settings: any) => {
  const startTime = settings?.startTime;
  const endTime = settings?.endTime;

  if (!startTime || !endTime) {
    throw new Error("Start time and end time are required");
  }

  if (toMinutes(endTime) <= toMinutes(startTime)) {
    throw new Error("End time must be greater than start time");
  }

  const periodsPerDay = Number(settings?.periodsPerDay ?? settings?.periods ?? 5);
  if (!Number.isFinite(periodsPerDay) || periodsPerDay < 1) {
    throw new Error("Periods per day must be at least 1");
  }

  const teachingDays = Array.isArray(settings?.teachingDays)
    ? settings.teachingDays.filter((day: string) => DEFAULT_TEACHING_DAYS.includes(day))
    : DEFAULT_TEACHING_DAYS;

  if (teachingDays.length === 0) {
    throw new Error("At least one teaching day is required");
  }

  const totalDayMinutes = toMinutes(endTime) - toMinutes(startTime);
  const lunchBreak = periodsPerDay > 1 ? LUNCH_BREAK_MINUTES : 0;
  const teachingMinutes = totalDayMinutes - lunchBreak;

  if (teachingMinutes <= 0) {
    throw new Error("Time range is too short for the selected configuration");
  }

  const periodDuration = Math.floor(teachingMinutes / periodsPerDay);
  if (periodDuration < MIN_PERIOD_DURATION_MINUTES) {
    throw new Error(
      `Configuration is too tight. Increase time range or reduce periods per day (minimum ${MIN_PERIOD_DURATION_MINUTES} minutes per period).`
    );
  }

  return {
    startTime,
    endTime,
    periodsPerDay,
    teachingDays,
    periods: periodsPerDay,
    lunchBreakMinutes: lunchBreak,
    periodDuration,
  };
};

// @desc    Generate a Timetable using AI
// @route   POST /api/timetables/generate
// @access  Private/Admin
export const generateTimetable = async (req: Request, res: Response) => {
  try {
    const { classId, academicYearId, settings } = req.body;
    const normalizedSettings = normalizeSettings(settings);

    const classData = await Class.findById(classId).populate("subjects");
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    const subjectIds = classData.subjects.map((subject) => subject._id.toString());
    if (subjectIds.length === 0) {
      return res.status(400).json({
        message: "No subjects assigned to this class",
      });
    }

    const teachers = await User.find({ role: "teacher" }).select("teacherSubject");
    const qualifiedTeachers = teachers.filter((teacher) => {
      if (!teacher.teacherSubject) return false;
      return teacher.teacherSubject.some((subjectId) =>
        subjectIds.includes(subjectId.toString())
      );
    });

    if (qualifiedTeachers.length === 0) {
      return res.status(400).json({
        message: "No teachers assigned to these class subjects",
      });
    }

    const generation = await TimetableGeneration.create({
      class: classId,
      academicYear: academicYearId,
      status: "queued",
      message: "Generation queued",
    });

    await inngest.send({
      name: "generate/timetable",
      data: {
        classId,
        academicYearId,
        settings: normalizedSettings,
        generationId: generation._id.toString(),
      },
    });
    const userId = (req as any).user._id;
    await logActivity({
      userId,
      action: `Requested timetable generation for class ID: ${classId}`,
    });
    res.status(200).json({
      message: "Timetable generation initiated",
      generationId: generation._id,
      status: generation.status,
      settings: normalizedSettings,
    });
  } catch (error: any) {
    const message = error?.message || "Server Error";
    const status =
      message.includes("required") ||
      message.includes("greater") ||
      message.includes("At least") ||
      message.includes("Periods per day")
        ? 400
        : 500;
    res.status(status).json({ message });
  }
};

// @desc    Get Timetable by Class
// @route   GET /api/timetables/:classId
export const getTimetable = async (req: Request, res: Response) => {
  try {
    const timetable = await Timetable.findOne({ class: req.params.classId })
      .populate("schedule.periods.subject", "name code")
      .populate("schedule.periods.teacher", "name email");

    if (!timetable)
      return res.status(404).json({ message: "Timetable not found" });

    res.json(timetable);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getTimetableGeneration = async (req: Request, res: Response) => {
  try {
    const generation = await TimetableGeneration.findById(req.params.id)
      .populate("class", "name")
      .populate("academicYear", "name");

    if (!generation) {
      return res.status(404).json({ message: "Generation not found" });
    }

    res.json({ generation });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};