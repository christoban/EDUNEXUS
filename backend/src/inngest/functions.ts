import { inngest } from "./index.ts";
import { prisma } from "../config/prisma.ts";
import {
  getAcademicPeriodCode,
  getAcademicPeriodLabel,
  getMentionFromAverage,
  getPeriodDateRange,
  type ReportPeriod,
} from "../utils/reporting.ts";
import {
  calculateAverageScoreOn20,
  formatGradeLabel,
  normalizePassThresholdOn20,
  normalizeScoreOn20,
  scoreOn20ToPercentage,
} from "../utils/gradingEngine.ts";
import { resolveBulletinTemplateType } from "../utils/reportCardTemplates.ts";
import { sendTransactionalEmail } from "../services/emailService.ts";
import {
  buildExamResultTemplate,
  buildReportCardTemplate,
} from "../utils/emailTemplates.ts";
import { resolveUserLanguage } from "../utils/languageHelper.ts";
import { getEffectiveSchoolSettings } from "../utils/schoolSettings.ts";
import { calculateCouncilDecision, resolveBulletinPolicy } from "../utils/bulletinPolicy.ts";

import { NonRetriableError } from "inngest";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

interface GenSettings {
  startTime: string;
  endTime: string;
  periodsPerDay: number;
  teachingDays: string[];
  periods?: number;
  lunchBreakMinutes?: number;
  periodDuration?: number;
}

interface TimeSlot {
  kind: "class" | "break";
  startTime: string;
  endTime: string;
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const toTime = (value: number) => {
  const hours = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

const buildDailyTimeSlots = (settings: GenSettings): TimeSlot[] => {
  const start = toMinutes(settings.startTime);
  const end = toMinutes(settings.endTime);
  const periods = settings.periodsPerDay;
  const lunchBreak = periods > 1 ? settings.lunchBreakMinutes ?? 60 : 0;
  const totalMinutes = end - start;
  const teachingMinutes = totalMinutes - lunchBreak;

  if (teachingMinutes <= 0) {
    throw new NonRetriableError("Invalid time range for timetable generation");
  }

  const basePeriodDuration = Math.floor(teachingMinutes / periods);
  const remainder = teachingMinutes % periods;
  const lunchAfterIndex = Math.ceil(periods / 2);

  const slots: TimeSlot[] = [];
  let cursor = start;
  for (let i = 0; i < periods; i++) {
    const duration = basePeriodDuration + (i < remainder ? 1 : 0);
    const slotStart = cursor;
    const slotEnd = slotStart + duration;

    slots.push({
      kind: "class",
      startTime: toTime(slotStart),
      endTime: toTime(slotEnd),
    });

    cursor = slotEnd;
    if (i + 1 === lunchAfterIndex && lunchBreak > 0) {
      const breakStart = cursor;
      cursor += lunchBreak;
      slots.push({
        kind: "break",
        startTime: toTime(breakStart),
        endTime: toTime(cursor),
      });
    }
  }

  return slots;
};

const normalizeSchedule = (rawSchedule: any, settings: GenSettings) => {
  const rawDays = Array.isArray(rawSchedule?.schedule) ? rawSchedule.schedule : [];

  const assignmentPool = rawDays
    .flatMap((day: any) => (Array.isArray(day?.periods) ? day.periods : []))
    .map((period: any) => ({
      subject: period?.subject,
      teacher: period?.teacher,
    }))
    .filter((period: any) => period.subject && period.teacher);

  if (assignmentPool.length === 0) {
    throw new NonRetriableError("AI generated no valid subject/teacher assignments");
  }

  const dailySlots = buildDailyTimeSlots(settings);
  let assignmentIndex = 0;

  const schedule = settings.teachingDays.map((day) => {
    const periods = dailySlots.map((slot) => {
      if (slot.kind === "break") {
        return {
          kind: "break",
          subject: null,
          teacher: null,
          startTime: slot.startTime,
          endTime: slot.endTime,
        };
      }

      const assignment = assignmentPool[assignmentIndex % assignmentPool.length];
      assignmentIndex += 1;
      return {
        kind: "class",
        subject: assignment.subject,
        teacher: assignment.teacher,
        startTime: slot.startTime,
        endTime: slot.endTime,
      };
    });

    return { day, periods };
  });

  return { schedule };
};

// Your new function:
export const generateTimeTable = inngest.createFunction(
  { id: "Generate-Timetable", triggers: [{ event: "generate/timetable" }] },
  async ({ event, step }) => {
    const { classId, academicYearId, settings } = event.data as {
      classId: string;
      academicYearId: string;
      settings: GenSettings;
      generationId?: string;
    };

    const updateGenerationStatus = async (
      status: "running" | "completed" | "failed",
      message?: string,
      timetableId?: string
    ) => {
      if (!event.data.generationId) return;
      await prisma.timetableGeneration.update({
        where: { id: event.data.generationId },
        data: {
          status,
          message,
          timetableId: timetableId || null,
        },
      });
    };

    try {
      await updateGenerationStatus("running", "Generation started");

      const contextData = await step.run("fetch-class-context", async () => {
        // fetch class with subjects
        const classData = await prisma.class.findUnique({
          where: { id: classId },
          include: { subjects: true },
        });
        if (!classData) throw new NonRetriableError("Class not found");

        // fetch teachers
        const allTeachers = await prisma.user.findMany({
          where: { role: "teacher" },
        });

        // filter qualified teachers for class subjects
        const classSubjectsIds = classData.subjects.map((sub) => sub.id);

        const qualifiedTeachers = allTeachers
          .filter((teacher) => {
            if (!teacher.teacherSubject) return false;
            return teacher.teacherSubject.some((subId) =>
              classSubjectsIds.includes(subId)
            );
          })
          .map((tea) => ({
            id: tea.id,
            name: tea.name,
            subjects: tea.teacherSubject,
          }));

        const subjectsPayload = classData.subjects.map((sub) => ({
          id: sub.id,
          name: sub.name,
          code: sub.code,
        }));

        // here we should check if we have teachers and subjects
        if (subjectsPayload.length === 0 || qualifiedTeachers.length === 0)
          throw new NonRetriableError(
            "No Subjects or Teachers assigned to this class"
          );

        return {
          className: classData.name,
          subjects: subjectsPayload,
          teachers: qualifiedTeachers,
        };
      });

    // generate timetable logic would go here
      const aiSchedule = await step.run("generate-timetable-logic", async () => {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!apiKey) {
        throw new NonRetriableError("GOOGLE_GENERATIVE_AI_API_KEY is missing");
      }

      const allTimetables = await prisma.timetable.findMany({
        where: { academicYearId },
      });

      const prompt = `
        You are a school scheduler. Generate a weekly timetable.

        CONTEXT:
        - Class: ${contextData.className}
        - Hours: ${settings.startTime} to ${settings.endTime} (${
        settings.periodsPerDay
      } periods/day).
        - Teaching days: ${settings.teachingDays.join(", ")}

        RESOURCES:
        - Subjects: ${JSON.stringify(contextData.subjects)}
        - Teachers: ${JSON.stringify(contextData.teachers)}
        - Other Timetables: ${JSON.stringify(allTimetables)}

        STRICT RULES:
        1. Generate EXACTLY ${settings.periodsPerDay} periods per listed teaching day.
        2. Use ONLY these days: ${settings.teachingDays.join(", ")}.
        3. Every period must stay within ${settings.startTime} and ${settings.endTime}.
        4. Assign a Teacher to every Subject period.
        5. Teacher MUST have the subject ID in their list.
        6. Avoid clashes with other classes(teacher can't be in two classes at the same time).
        7. Keep the output strict JSON only.
        8. Include every selected teaching day exactly once.

        OUTPUT SCHEMA:
        {
          "schedule": [
            {
              "day": "Monday",
              "periods": [
                { "subject": "SUBJECT_ID", "teacher": "TEACHER_ID", "startTime": "HH:MM", "endTime": "HH:MM" }
              ]
            }
          ]
        }
      `;

      const google = createGoogleGenerativeAI({
        apiKey,
      });

      // I will show you how to get one if these does not work for you
      const activeModel = google("gemini-3-flash-preview");

      const { text } = await generateText({
        prompt,
        model: activeModel,
      });

      const cleanJSON = text.replace(/```json/g, "").replace(/```/g, "");
        const parsed = JSON.parse(cleanJSON);
        return normalizeSchedule(parsed, settings);
      });
      // now let save
      const savedTimetable = await step.run("save-timetable", async () => {
        // Delete existing to avoid duplicates
        await prisma.timetable.deleteMany({
          where: {
            classId,
            academicYearId,
          },
        });
        const timetable = await prisma.timetable.create({
          data: {
            classId,
            academicYearId,
            schedule: aiSchedule.schedule,
          },
        });

        return timetable;
      });

      await updateGenerationStatus(
        "completed",
        "Timetable generated successfully",
        savedTimetable.id
      );
      return { message: "Timetable generated successfully" };
    } catch (error: any) {
      await updateGenerationStatus(
        "failed",
        error?.message || "Timetable generation failed"
      );
      throw error;
    }
  }
);

// Your new function:
export const generateExam = inngest.createFunction(
  { id: "Generate-Exam", triggers: [{ event: "exam/generate" }] },
  async ({ event, step }) => {
    const { examId, generationId, topic, subjectName, difficulty, count } =
      event.data;

    const updateExamGenerationStatus = async (
      status: "running" | "completed" | "failed",
      message?: string
    ) => {
      if (!generationId) return;
      await prisma.examGeneration.update({
        where: { id: generationId },
        data: {
          status,
          message,
        },
      });
    };

    try {
      await updateExamGenerationStatus("running", "Exam generation in progress");

      // generate timetable logic would go here
      const aiExam = await step.run("generate-exam-logic", async () => {
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
          throw new NonRetriableError("GOOGLE_GENERATIVE_AI_API_KEY is missing");
        }

      const prompt = `
        You are a strict teacher. Create a JSON array of ${count} multiple-choice questions for a high school exam.

        CONTEXT:
        - Subject: ${subjectName}
        - Topic: ${topic}
        - Difficulty: ${difficulty}

        STRICT JSON SCHEMA (Array of Objects):
        [
          {
            "questionText": "Question string",
            "type": "MCQ",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": "The exact string of the correct option",
            "points": 1
          }
        ]

        RULES:
        1. Output ONLY raw JSON. No Markdown.
        2. Ensure correct answer matches one of the options exactly.
      `;

        const google = createGoogleGenerativeAI({
          apiKey,
        });

        // I will show you how to get one if these does not work for you
        const activeModel = google("gemini-3-flash-preview");

        const { text } = await generateText({
          prompt,
          model: activeModel,
        });

        // Sanitize JSON
        const cleanJson = text
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        return JSON.parse(cleanJson);
      });
      // now let save
      await step.run("save-exam", async () => {
        const exam = await Exam.findById(examId);

        if (!exam) {
          throw new NonRetriableError(`Exam ${examId} not found`);
        }

        // Update the exam with the new questions
        exam.questions = aiExam;
        exam.isActive = false; // Keep it inactive until teacher reviews it

        await exam.save();

        return { success: true, count: aiExam.length };
      });
      await updateExamGenerationStatus(
        "completed",
        "Exam generated successfully"
      );
      return { message: "Exam generated successfully" };
    } catch (error: any) {
      await updateExamGenerationStatus(
        "failed",
        error?.message || "Exam generation failed"
      );
      throw error;
    }
  }
);

// handle submission inside inngest
// Important because we don't want the student's submission to be have issues
// with server timeouts or other problems
export const handleExamSubmission = inngest.createFunction(
  { id: "Handle-Exam-Submission", triggers: [{ event: "exam/submit" }] },
  async ({ event, step }) => {
    const { examId, studentId, answers } = event.data;

    await step.run("process-exam-submission", async () => {
      // 1. Check if already submitted
      const existingSubmission = await prisma.submission.findFirst({
        where: {
          examId,
          studentId,
        },
      });
      if (existingSubmission) {
        throw new NonRetriableError("Exam already submitted");
      }

      // 2. Fetch full exam (with answers)
      const exam = await prisma.exam.findUnique({
        where: { id: examId },
      });
      if (!exam) {
        throw new NonRetriableError(`Exam ${examId} not found`);
      }

      // 3. Calculate Score
      let score = 0;
      let totalPoints = 0;

      const questions = exam.questions as any[];
      questions.forEach((question) => {
        totalPoints += question.points;
        const studentAns = answers.find(
          (a: any) => a.questionId === question.id
        );
        if (studentAns && studentAns.answer === question.correctAnswer) {
          score += question.points;
        }
      });

      // 4. Save Submission
      await prisma.submission.create({
        data: {
          examId,
          studentId,
          answers,
          score,
        },
      });
    });

    await step.run("send-exam-result-notification", async () => {
      const submission = await prisma.submission.findFirst({
        where: {
          examId,
          studentId,
        },
        select: { score: true },
      });

      if (!submission) return { sent: 0, failed: 0 };

      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: { subject: true },
      });

      if (!exam) return { sent: 0, failed: 0 };

      const student = await prisma.user.findUnique({
        where: { id: studentId },
        select: { name: true, email: true, parentId: true, schoolSection: true, uiLanguagePreference: true },
      });

      if (!student?.email) return { sent: 0, failed: 0 };

      const questions = exam.questions as any[];
      const maxScore = Array.isArray(questions)
        ? questions.reduce(
            (sum: number, question: any) => sum + (Number(question.points) || 1),
            0
          )
        : 0;

      if (!maxScore) return { sent: 0, failed: 0 };

      const percentage = Number(((Number(submission.score) / maxScore) * 100).toFixed(2));
      const schoolSettings = await getEffectiveSchoolSettings();

      const recipients: Array<{
        email: string;
        userId?: string;
        role: "student" | "parent";
        parentLanguagePreference?: "fr" | "en";
        schoolSection?: "francophone" | "anglophone" | "bilingual";
        uiLanguagePreference?: "fr" | "en";
      }> = [
        {
          email: student.email,
          userId: student.id,
          role: "student",
          schoolSection: student.schoolSection,
          uiLanguagePreference: student.uiLanguagePreference,
        },
      ];

      if (student.parentId) {
        const parent = await prisma.user.findUnique({
          where: { id: student.parentId },
          select: { email: true, parentLanguagePreference: true, schoolSection: true, uiLanguagePreference: true },
        });
        if (parent?.email) {
          recipients.push({
            email: parent.email,
            userId: parent.id,
            role: "parent",
            parentLanguagePreference: parent.parentLanguagePreference || undefined,
            schoolSection: parent.schoolSection,
            uiLanguagePreference: parent.uiLanguagePreference,
          });
        }
      }

      let sent = 0;
      let failed = 0;
      for (const recipient of recipients) {
        const language = resolveUserLanguage({
          role: recipient.role,
          schoolLanguageMode: schoolSettings.schoolLanguageMode,
          schoolSection: recipient.schoolSection,
          parentLanguagePreference: recipient.parentLanguagePreference,
          uiLanguagePreference: recipient.uiLanguagePreference,
          schoolPreferredLanguage: schoolSettings.preferredLanguage,
        });

        const template = buildExamResultTemplate({
          recipientName: student.name,
          examTitle: exam.title,
          subjectName: exam.subject?.name || "Subject",
          score: Number(submission.score) || 0,
          maxScore,
          percentage,
          language,
        });

        const response = await sendTransactionalEmail({
          recipientEmail: recipient.email,
          recipientUserId: recipient.userId,
          subject: template.subject,
          html: template.html,
          text: template.text,
          template: "exam_result",
          eventType: "exam_result",
          relatedEntityType: "exam",
          relatedEntityId: examId,
          metadata: {
            studentId: student.id,
            score: Number(submission.score) || 0,
            maxScore,
            percentage,
            language,
          },
        });

        if (response.status === "sent") sent += 1;
        else failed += 1;
      }

      return { sent, failed };
    });

    return { message: "Exam submitted successfully" };
  }
);

export const generateReportCards = inngest.createFunction(
  { id: "Generate-Report-Cards", triggers: [{ event: "reportcard/generate" }] },
  async ({ event, step }) => {
    const { yearId, period, periodId, classId, studentId } = event.data as {
      yearId: string;
      period?: ReportPeriod;
      periodId?: string | null;
      classId?: string | null;
      studentId?: string | null;
    };

    const year = await step.run("fetch-academic-year", async () => {
      const data = await prisma.academicYear.findUnique({
        where: { id: yearId },
      });
      if (!data) {
        throw new NonRetriableError("Academic year not found");
      }
      return data;
    });

    const selectedAcademicPeriod: {
      id: string;
      type: "SEQUENCE" | "TERM" | "MONTH";
      number: number;
      startDate: Date;
      endDate: Date;
      isBulletinPeriod: boolean;
      isCouncilPeriod: boolean;
    } | null = await step.run("resolve-academic-period", async () => {
      if (!periodId) return null;
      const found = await prisma.academicPeriod.findFirst({
        where: {
          id: periodId,
          academicYearId: yearId,
        },
        select: {
          id: true,
          type: true,
          number: true,
          startDate: true,
          endDate: true,
          isBulletinPeriod: true,
          isCouncilPeriod: true,
        },
      });

      if (!found) {
        throw new NonRetriableError("Academic period not found for selected year");
      }

      if (!found.isBulletinPeriod) {
        throw new NonRetriableError("Selected academic period is not configured for bulletins");
      }

      return found;
    });

    const resolvedPeriod = (period || "term1") as ReportPeriod;
    const { start, end } = selectedAcademicPeriod
      ? { start: new Date(selectedAcademicPeriod.startDate), end: new Date(selectedAcademicPeriod.endDate) }
      : getPeriodDateRange(year, resolvedPeriod);

    const periodCode = selectedAcademicPeriod
      ? getAcademicPeriodCode(selectedAcademicPeriod.type, Number(selectedAcademicPeriod.number))
      : String(resolvedPeriod);
    const periodLabel = selectedAcademicPeriod
      ? getAcademicPeriodLabel(selectedAcademicPeriod.type, Number(selectedAcademicPeriod.number), "fr")
      : String(resolvedPeriod).toUpperCase();

    const exams = await step.run("fetch-exams-for-period", async () => {
      const examWhere: any = {
        dueDate: { gte: start, lte: end },
      };

      if (classId) {
        examWhere.classId = classId;
      }

      const found = await prisma.exam.findMany({
        where: examWhere,
        select: { id: true, subjectId: true, questions: true, classId: true, dueDate: true },
      });

      return found;
    });

    if (!exams.length) {
      return { message: "No exams found for selected period", generated: 0 };
    }

    const examIds = exams.map((exam: any) => exam._id);

    const submissions = await step.run("fetch-submissions", async () => {
      const submissionWhere: any = {
        examId: { in: examIds },
      };

      if (studentId) {
        submissionWhere.studentId = studentId;
      }

      return prisma.submission.findMany({
        where: submissionWhere,
        select: { examId: true, studentId: true, score: true },
      });
    });

    const examMap = new Map<string, any>();
    for (const exam of exams as any[]) {
      examMap.set(exam.id, exam);
    }

    const classIds = Array.from(
      new Set((exams as any[]).map((exam: any) => exam.classId).filter(Boolean))
    );
    const subjectIds = Array.from(
      new Set((exams as any[]).map((exam: any) => exam.subjectId).filter(Boolean))
    );

    const [classContexts, subjects] = await Promise.all([
      step.run("fetch-class-grading-context", async () => {
        if (!classIds.length) return [];
        return prisma.class.findMany({
          where: { id: { in: classIds } },
          include: {
            section: {
              include: {
                subSystem: {
                  select: {
                    code: true,
                    gradingScale: true,
                    passThreshold: true,
                    hasCoefficientBySubject: true,
                    bulletinTemplate: true,
                  },
                },
              },
            },
            classTeacher: {
              select: { name: true },
            },
          },
        });
      }),
      step.run("fetch-subject-coefficients", async () => {
        if (!subjectIds.length) return [];
        return prisma.subject.findMany({
          where: { id: { in: subjectIds } },
          select: { id: true, coefficient: true },
        });
      }),
    ]);

    const classContextMap = new Map<string, any>();
    for (const cls of classContexts as any[]) {
      const subSystem = cls?.section?.subSystem;
      classContextMap.set(cls.id, {
        gradingScale: subSystem?.gradingScale || "OVER_20",
        passThresholdOn20: normalizePassThresholdOn20(
          Number(subSystem?.passThreshold ?? 10),
          subSystem?.gradingScale || "OVER_20"
        ),
        hasCoefficientBySubject: Boolean(subSystem?.hasCoefficientBySubject),
        templateType: resolveBulletinTemplateType(
          subSystem?.code,
          cls?.section?.cycle,
          cls?.section?.language,
          subSystem?.bulletinTemplate
        ),
        classTeacherName: cls?.classTeacher?.name || "________________",
      });
    }

    const subjectCoefficientMap = new Map<string, number>();
    for (const subject of subjects as any[]) {
      subjectCoefficientMap.set(
        subject.id,
        Math.max(1, Number(subject.coefficient) || 1)
      );
    }

    const gradeIdsByStudent = new Map<string, string[]>();

    await step.run("upsert-grades", async () => {
      for (const submission of submissions as any[]) {
        const exam = examMap.get(submission.examId);
        if (!exam) continue;

        const questions = exam.questions as any[];
        const maxScore = Array.isArray(questions)
          ? questions.reduce(
              (sum: number, question: any) => sum + (Number(question.points) || 1),
              0
            )
          : 0;

        if (!maxScore) continue;

        const gradingContext = classContextMap.get(exam.classId) || {
          gradingScale: "OVER_20",
          passThresholdOn20: 10,
          hasCoefficientBySubject: false,
        };

        const rawScore = Number(submission.score) || 0;
        const scoreOn20 = normalizeScoreOn20({ rawScore, maxScore });
        const percentage = scoreOn20ToPercentage(scoreOn20);
        const coefficient = gradingContext.hasCoefficientBySubject
          ? subjectCoefficientMap.get(exam.subjectId) || 1
          : 1;
        const gradeLabel = formatGradeLabel(scoreOn20, gradingContext.gradingScale);

        const grade = await prisma.grade.upsert({
          where: {
            examId_studentId_year_period: {
              examId: exam.id,
              studentId: submission.studentId,
              year: yearId,
              period: periodCode,
            },
          },
          update: {
            score: rawScore,
            maxScore,
            percentage,
            scoreOn20,
            coefficient,
            gradeLabel,
            gradingScale: gradingContext.gradingScale,
            hasCoefficientBySubjectAtSource: gradingContext.hasCoefficientBySubject,
            passThresholdOn20AtSource: gradingContext.passThresholdOn20,
            subjectId: exam.subjectId,
          },
          create: {
            examId: exam.id,
            studentId: submission.studentId,
            score: rawScore,
            maxScore,
            percentage,
            scoreOn20,
            coefficient,
            gradeLabel,
            gradingScale: gradingContext.gradingScale,
            hasCoefficientBySubjectAtSource: gradingContext.hasCoefficientBySubject,
            passThresholdOn20AtSource: gradingContext.passThresholdOn20,
            subjectId: exam.subjectId,
            year: yearId,
            period: periodCode,
          },
        });

        const studentKey = submission.studentId;
        const existing = gradeIdsByStudent.get(studentKey) || [];
        existing.push(grade.id);
        gradeIdsByStudent.set(studentKey, existing);
      }
    });

    const generatedStudents: string[] = [];
    const schoolSettings = await getEffectiveSchoolSettings();
    const bulletinPolicy = resolveBulletinPolicy(schoolSettings);

    await step.run("upsert-report-cards", async () => {
      const studentKeys = Array.from(gradeIdsByStudent.keys());
      const students = await prisma.user.findMany({
        where: { id: { in: studentKeys } },
        select: { id: true, studentClassId: true },
      });

      const studentClassMap = new Map<string, string>();
      for (const student of students as any[]) {
        if (student?.studentClassId) {
          studentClassMap.set(student.id, student.studentClassId);
        }
      }

      const summaries = new Map<
        string,
        {
          gradeIds: string[];
          classId: string;
          averagePercentage: number;
          averageScoreOn20: number;
          totalExams: number;
          passedExams: number;
          failedExams: number;
          highestPercentage: number;
          lowestPercentage: number;
          templateType: "FR" | "EN" | "PRIMARY" | "KINDERGARTEN";
          classTeacherName: string;
        }
      >();
      const classAverages = new Map<string, Array<{ studentId: string; average: number }>>();

      for (const [studentKey, gradeIds] of gradeIdsByStudent.entries()) {
        const grades = await prisma.grade.findMany({
          where: { id: { in: gradeIds } },
          select: { scoreOn20: true, percentage: true, coefficient: true, hasCoefficientBySubjectAtSource: true, passThresholdOn20AtSource: true },
        });

        if (!grades.length) continue;

        const classId = studentClassMap.get(studentKey);
        if (!classId) continue;

        const classContext = classContextMap.get(classId) || {
          hasCoefficientBySubject: false,
          passThresholdOn20: 10,
          templateType: "FR",
          classTeacherName: "________________",
        };

        const gradeInputs = grades.map((grade: any) => ({
          scoreOn20: Number(grade.scoreOn20 ?? 0),
          percentage: Number(grade.percentage ?? 0),
          coefficient: Number(grade.coefficient ?? 1),
        }));

        const averageScoreOn20 = calculateAverageScoreOn20(
          gradeInputs,
          Boolean(classContext.hasCoefficientBySubject)
        );
        const averagePercentage = scoreOn20ToPercentage(averageScoreOn20);
        const percentages = gradeInputs.map((grade: any) => grade.percentage);
        const totalExams = percentages.length;
        const passedExams = gradeInputs.filter(
          (grade: any) => Number(grade.scoreOn20) >= Number(classContext.passThresholdOn20)
        ).length;
        const failedExams = totalExams - passedExams;
        const highestPercentage = Math.max(...percentages);
        const lowestPercentage = Math.min(...percentages);

        summaries.set(studentKey, {
          gradeIds,
          classId,
          averagePercentage,
          averageScoreOn20,
          totalExams,
          passedExams,
          failedExams,
          highestPercentage,
          lowestPercentage,
          templateType: classContext.templateType,
          classTeacherName: classContext.classTeacherName,
        });

        const existingClassAverages = classAverages.get(classId) || [];
        existingClassAverages.push({ studentId: studentKey, average: averagePercentage });
        classAverages.set(classId, existingClassAverages);
      }

      const classStatsMap = new Map<
        string,
        {
          classSize: number;
          classAverage: number;
          classHighest: number;
          classLowest: number;
          rankByStudent: Map<string, number>;
        }
      >();

      for (const [classId, values] of classAverages.entries()) {
        const sorted = [...values].sort((a, b) => b.average - a.average);
        const rankByStudent = new Map<string, number>();
        let previousAverage = Number.NaN;
        let currentRank = 1;

        sorted.forEach((item, index) => {
          if (index === 0 || item.average !== previousAverage) {
            currentRank = index + 1;
            previousAverage = item.average;
          }
          rankByStudent.set(item.studentId, currentRank);
        });

        const statsValues = values.map((item) => item.average);
        const classSize = statsValues.length || 1;
        const classAverage = Number(
          (statsValues.reduce((sum, value) => sum + value, 0) / classSize).toFixed(2)
        );
        const classHighest = Number(Math.max(...statsValues).toFixed(2));
        const classLowest = Number(Math.min(...statsValues).toFixed(2));

        classStatsMap.set(classId, {
          classSize,
          classAverage,
          classHighest,
          classLowest,
          rankByStudent,
        });
      }

      const attendanceStatuses: Array<"absent" | "late" | "excused"> = ["absent", "late"];
      if (bulletinPolicy.attendanceExcusedCountsAsAbsence) {
        attendanceStatuses.push("excused");
      }

      const attendanceRows = await prisma.attendance.findMany({
        where: {
          studentId: { in: Array.from(summaries.keys()) },
          date: { gte: start, lte: end },
          status: { in: attendanceStatuses },
        },
        select: { studentId: true, status: true },
      });

      const attendanceMap = new Map<string, { absences: number; lateCount: number; excusedCount: number }>();
      for (const row of attendanceRows as any[]) {
        const key = row.studentId;
        const current = attendanceMap.get(key) || { absences: 0, lateCount: 0, excusedCount: 0 };
        if (row.status === "absent") current.absences += 1;
        if (row.status === "late") current.lateCount += 1;
        if (row.status === "excused") current.excusedCount += 1;
        attendanceMap.set(key, current);
      }

      for (const [studentKey, summary] of summaries.entries()) {
        const stats = classStatsMap.get(summary.classId);
        const attendance = attendanceMap.get(studentKey) || { absences: 0, lateCount: 0, excusedCount: 0 };
        const effectiveAbsences =
          attendance.absences +
          (bulletinPolicy.attendanceLateAsAbsence ? attendance.lateCount : 0) +
          (bulletinPolicy.attendanceExcusedCountsAsAbsence ? attendance.excusedCount : 0);

        const classInvoices = await prisma.invoice.findMany({
          where: {
            studentId: studentKey,
            classId: summary.classId,
            academicYearId: yearId,
            balance: { gt: bulletinPolicy.bulletinAllowedOutstandingBalance },
            status: { in: ["issued", "partially_paid", "overdue"] },
          },
          select: { balance: true, status: true, invoiceNumber: true },
        });

        const outstandingBalance = classInvoices.reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0);
        const shouldBlockBulletin =
          bulletinPolicy.bulletinBlockOnUnpaidFees &&
          outstandingBalance > bulletinPolicy.bulletinAllowedOutstandingBalance;

        if (shouldBlockBulletin) {
          continue;
        }

        const councilDecision = calculateCouncilDecision({
          averagePercentage: summary.averagePercentage,
          absences: effectiveAbsences,
          lateCount: attendance.lateCount,
          policy: bulletinPolicy,
        });

        await prisma.reportCard.upsert({
          where: {
            studentId_year_periodCode: {
              studentId: studentKey,
              year: yearId,
              periodCode,
            },
          },
          update: {
            period: periodCode,
            periodLabel,
            periodRef: selectedAcademicPeriod?.id || null,
            councilPeriod: Boolean(selectedAcademicPeriod?.isCouncilPeriod),
            templateType: summary.templateType,
            grades: summary.gradeIds,
            aggregates: {
              average: summary.averagePercentage,
              averageScoreOn20: summary.averageScoreOn20,
              totalExams: summary.totalExams,
              passedExams: summary.passedExams,
              failedExams: summary.failedExams,
              highestPercentage: summary.highestPercentage,
              lowestPercentage: summary.lowestPercentage,
            },
            bulletinMeta: {
              rank: stats?.rankByStudent.get(studentKey) || 1,
              classSize: stats?.classSize || 1,
              classAverage: stats?.classAverage || summary.averagePercentage,
              classHighest: stats?.classHighest || summary.averagePercentage,
              classLowest: stats?.classLowest || summary.averagePercentage,
              absences: effectiveAbsences,
              lateCount: attendance.lateCount,
              councilDecision,
              signatures: {
                classTeacher: summary.classTeacherName || "________________",
                principal: "________________",
              },
            },
            mention: getMentionFromAverage(summary.averagePercentage),
          },
          create: {
            studentId: studentKey,
            year: yearId,
            period: periodCode,
            periodCode,
            periodLabel,
            periodRef: selectedAcademicPeriod?.id || null,
            councilPeriod: Boolean(selectedAcademicPeriod?.isCouncilPeriod),
            templateType: summary.templateType,
            grades: summary.gradeIds,
            aggregates: {
              average: summary.averagePercentage,
              averageScoreOn20: summary.averageScoreOn20,
              totalExams: summary.totalExams,
              passedExams: summary.passedExams,
              failedExams: summary.failedExams,
              highestPercentage: summary.highestPercentage,
              lowestPercentage: summary.lowestPercentage,
            },
            bulletinMeta: {
              rank: stats?.rankByStudent.get(studentKey) || 1,
              classSize: stats?.classSize || 1,
              classAverage: stats?.classAverage || summary.averagePercentage,
              classHighest: stats?.classHighest || summary.averagePercentage,
              classLowest: stats?.classLowest || summary.averagePercentage,
              absences: effectiveAbsences,
              lateCount: attendance.lateCount,
              councilDecision,
              signatures: {
                classTeacher: summary.classTeacherName || "________________",
                principal: "________________",
              },
            },
            mention: getMentionFromAverage(summary.averagePercentage),
          },
        });

        generatedStudents.push(studentKey);
      }
    });

    await step.run("send-report-card-notification", async () => {
      if (!generatedStudents.length) {
        return { sent: 0, failed: 0 };
      }

      const reportCards = await ReportCard.find({
        student: { $in: generatedStudents },
        year: yearId,
        periodCode,
      })
        .populate("student", "name email parentId schoolSection uiLanguagePreference")
        .populate("year", "name")
        .select("student year period periodCode periodLabel aggregates mention")
        .lean();

      const schoolSettings = await getEffectiveSchoolSettings();

      let sent = 0;
      let failed = 0;

      for (const reportCard of reportCards as any[]) {
        const student = reportCard.student;
        if (!student?.email) continue;

        const recipients: Array<{
          email: string;
          userId?: string;
          role: "student" | "parent";
          parentLanguagePreference?: "fr" | "en";
          schoolSection?: "francophone" | "anglophone" | "bilingual";
          uiLanguagePreference?: "fr" | "en";
        }> = [
          {
            email: student.email,
            userId: String(student._id),
            role: "student",
            schoolSection: student.schoolSection,
            uiLanguagePreference: student.uiLanguagePreference,
          },
        ];

        if (student.parentId) {
          const parent = await User.findById(student.parentId)
            .select("email parentLanguagePreference schoolSection uiLanguagePreference")
            .lean();
          if (parent?.email) {
            recipients.push({
              email: parent.email,
              userId: String(parent._id),
              role: "parent",
              parentLanguagePreference:
                ((parent as any).parentLanguagePreference as "fr" | "en" | undefined) ||
                undefined,
              schoolSection: (parent as any).schoolSection,
              uiLanguagePreference: (parent as any).uiLanguagePreference,
            });
          }
        }

        for (const recipient of recipients) {
          const language = resolveUserLanguage({
            role: recipient.role,
            schoolLanguageMode: schoolSettings.schoolLanguageMode,
            schoolSection: recipient.schoolSection,
            parentLanguagePreference: recipient.parentLanguagePreference,
            uiLanguagePreference: recipient.uiLanguagePreference,
            schoolPreferredLanguage: schoolSettings.preferredLanguage,
          });

          const template = buildReportCardTemplate({
            recipientName: student.name,
            period: reportCard.periodLabel || reportCard.periodCode || periodCode,
            yearName: reportCard.year?.name || "Academic Year",
            average: Number(reportCard.aggregates?.average || 0),
            mention: reportCard.mention,
            totalExams: Number(reportCard.aggregates?.totalExams || 0),
            language,
          });

          const response = await sendTransactionalEmail({
            recipientEmail: recipient.email,
            recipientUserId: recipient.userId,
            subject: template.subject,
            html: template.html,
            text: template.text,
            template: "report_card_available",
            eventType: "report_card_available",
            relatedEntityType: "report_card",
            relatedEntityId: String(reportCard._id),
            metadata: {
              studentId: String(student._id),
              period: reportCard.periodCode || periodCode,
              average: Number(reportCard.aggregates?.average || 0),
              mention: reportCard.mention,
              language,
            },
          });

          if (response.status === "sent") sent += 1;
          else failed += 1;
        }
      }

      return { sent, failed };
    });

    return {
      message: "Report cards generated successfully",
      generated: generatedStudents.length,
      period: periodCode,
      yearId,
    };
  }
);