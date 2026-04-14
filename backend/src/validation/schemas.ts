import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectId = z.string().regex(objectIdRegex, "Invalid ObjectId format");

const optionalObjectId = objectId.optional().nullable();

const dayEnum = z.enum([
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]);

const hhmm = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format. Use HH:MM");

export const idParamSchema = z.object({
  id: objectId,
});

export const generationIdParamSchema = z.object({
  id: objectId,
});

export const userIdParamSchema = z.object({
  id: objectId,
});

export const registerBodySchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  role: z.enum(["admin", "teacher", "student", "parent"]),
  isActive: z.boolean().optional(),
  studentClass: optionalObjectId,
  teacherSubject: z.array(objectId).optional(),
  teacherSubjects: z.array(objectId).optional(),
});

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateUserBodySchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).max(128).optional(),
    role: z.enum(["admin", "teacher", "student", "parent"]).optional(),
    isActive: z.boolean().optional(),
    studentClass: optionalObjectId,
    teacherSubject: z.array(objectId).optional(),
    teacherSubjects: z.array(objectId).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const createClassBodySchema = z.object({
  name: z.string().min(1).max(100),
  academicYear: objectId,
  classTeacher: optionalObjectId,
  capacity: z.number().int().positive().max(500),
  subjects: z.array(objectId).optional(),
});

export const updateClassBodySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    academicYear: objectId.optional(),
    classTeacher: optionalObjectId,
    capacity: z.number().int().positive().max(500).optional(),
    subjects: z.array(objectId).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const createSubjectBodySchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
  teacher: z.array(objectId).optional(),
  isActive: z.boolean().optional(),
});

export const updateSubjectBodySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(50).optional(),
    teacher: z.array(objectId).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const triggerExamGenerationBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  subject: objectId,
  class: objectId,
  duration: z.number().int().positive().max(600).optional(),
  dueDate: z.union([z.string().datetime(), z.date()]).optional(),
  topic: z.string().min(2).max(300),
  difficulty: z.string().min(2).max(30).optional(),
  count: z.number().int().min(1).max(100).optional(),
});

export const submitExamBodySchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: objectId,
        answer: z.string().min(1).max(500),
      })
    )
    .min(1),
});

export const generateTimetableBodySchema = z.object({
  classId: objectId,
  academicYearId: objectId,
  settings: z.object({
    startTime: hhmm,
    endTime: hhmm,
    periodsPerDay: z.number().int().min(1).max(12),
    teachingDays: z.array(dayEnum).min(1).optional(),
    periods: z.number().int().min(1).max(12).optional(),
  }),
});

export const classIdParamSchema = z.object({
  classId: objectId,
});
