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
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD");

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
  parentId: optionalObjectId,
  schoolSection: z.enum(["francophone", "anglophone", "bilingual"]).optional(),
  uiLanguagePreference: z.enum(["fr", "en"]).optional(),
  parentLanguagePreference: z.enum(["fr", "en"]).optional(),
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
    parentId: optionalObjectId,
    parentLanguagePreference: z.enum(["fr", "en"]).optional(),
    schoolSection: z.enum(["francophone", "anglophone", "bilingual"]).optional(),
    uiLanguagePreference: z.enum(["fr", "en"]).optional(),
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
  coefficient: z.coerce.number().int().min(1).max(20).optional(),
  appreciation: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const updateSubjectBodySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(50).optional(),
    teacher: z.array(objectId).optional(),
    coefficient: z.coerce.number().int().min(1).max(20).optional(),
    appreciation: z.string().max(500).optional(),
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

export const studentIdParamSchema = z.object({
  studentId: objectId,
});

export const markAttendanceBodySchema = z.object({
  classId: objectId,
  date: isoDate,
  records: z
    .array(
      z.object({
        studentId: objectId,
        status: z.enum(["present", "absent", "late", "excused"]),
      })
    )
    .min(1),
});

export const attendanceQuerySchema = z.object({
  classId: objectId.optional(),
  studentId: objectId.optional(),
  date: isoDate.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const globalSearchQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

const reportPeriodEnum = z.enum(["term1", "term2", "term3", "annual"]);

export const generateReportCardsBodySchema = z.object({
  yearId: objectId,
  period: reportPeriodEnum,
  classId: objectId.optional(),
  studentId: objectId.optional(),
});

export const reportCardsQuerySchema = z.object({
  yearId: objectId.optional(),
  period: reportPeriodEnum.optional(),
  classId: objectId.optional(),
  studentId: objectId.optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const emailLogsQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(["sent", "failed"]).optional(),
  eventType: z.enum(["exam_result", "report_card_available", "payment_reminder"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const feeCategoryEnum = z.enum([
  "registration",
  "tuition",
  "apee_pta",
  "transport",
  "canteen",
  "uniform_supplies",
  "exam_fees",
  "other",
]);

const feeFrequencyEnum = z.enum(["one_time", "monthly", "termly"]);

const invoiceStatusEnum = z.enum([
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
]);

const paymentMethodEnum = z.enum([
  "cash",
  "bank_transfer",
  "mobile_money_mtn",
  "mobile_money_orange",
]);

export const createFeePlanBodySchema = z.object({
  name: z.string().min(2).max(120),
  category: feeCategoryEnum,
  frequency: feeFrequencyEnum,
  amount: z.number().positive(),
  academicYear: objectId,
  classes: z.array(objectId).min(1),
  dueDayOfMonth: z.number().int().min(1).max(31).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

export const updateFeePlanBodySchema = createFeePlanBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

const invoiceLineSchema = z.object({
  feePlan: objectId.optional(),
  label: z.string().min(1).max(200),
  category: feeCategoryEnum.or(z.literal("other")),
  amount: z.number().nonnegative(),
});

export const createInvoiceBodySchema = z.object({
  studentId: objectId,
  classId: objectId,
  academicYearId: objectId,
  dueDate: isoDate,
  lines: z.array(invoiceLineSchema).min(1),
  notes: z.string().max(500).optional(),
  status: invoiceStatusEnum.optional(),
});

export const createInvoicesFromFeePlanBodySchema = z.object({
  feePlanId: objectId,
  dueDate: isoDate,
  classId: objectId.optional(),
  studentId: objectId.optional(),
  notes: z.string().max(500).optional(),
});

export const invoiceQuerySchema = z.object({
  studentId: objectId.optional(),
  classId: objectId.optional(),
  academicYearId: objectId.optional(),
  status: invoiceStatusEnum.optional(),
  dueBefore: isoDate.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const createPaymentBodySchema = z
  .object({
    invoiceId: objectId,
    amount: z.number().positive(),
    paymentDate: isoDate.optional(),
    method: paymentMethodEnum,
    transactionReference: z.string().trim().min(3).max(120).optional(),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (data) =>
      data.method === "cash" ||
      (typeof data.transactionReference === "string" && data.transactionReference.length > 0),
    {
      message: "transactionReference is required for transfer and mobile money",
      path: ["transactionReference"],
    }
  );

export const paymentQuerySchema = z.object({
  invoiceId: objectId.optional(),
  studentId: objectId.optional(),
  method: paymentMethodEnum.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const createExpenseBodySchema = z
  .object({
    category: z.enum(["salary", "utilities", "maintenance", "supplies", "transport", "other"]),
    description: z.string().min(2).max(300),
    amount: z.number().positive(),
    expenseDate: isoDate.optional(),
    paymentMethod: paymentMethodEnum,
    transactionReference: z.string().trim().min(3).max(120).optional(),
  })
  .refine(
    (data) =>
      data.paymentMethod === "cash" ||
      (typeof data.transactionReference === "string" && data.transactionReference.length > 0),
    {
      message: "transactionReference is required for transfer and mobile money",
      path: ["transactionReference"],
    }
  );

export const expenseQuerySchema = z.object({
  category: z.enum(["salary", "utilities", "maintenance", "supplies", "transport", "other"]).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const financeReportQuerySchema = z.object({
  classId: objectId.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const sendFinanceReminderBodySchema = z.object({
  studentId: objectId,
  channels: z.array(z.enum(["email", "sms"])).min(1),
  phoneNumber: z.string().trim().min(8).max(30).optional(),
  customMessage: z.string().trim().min(3).max(500).optional(),
});
