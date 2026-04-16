import { inngest } from "./index.ts";
import Class from "../models/class.ts";
import User from "../models/user.ts";
import Timetable from "../models/timetable.ts";
import TimetableGeneration from "../models/timetableGeneration.ts";
import ExamGeneration from "../models/examGeneration.ts";
import Exam from "../models/exam.ts";
import Submission from "../models/submission.ts";
import Grade from "../models/grade.ts";
import ReportCard from "../models/reportCard.ts";
import AcademicYear from "../models/academicYear.ts";
import { getMentionFromAverage, getPeriodDateRange, type ReportPeriod } from "../utils/reporting.ts";
import { sendTransactionalEmail } from "../services/emailService.ts";
import {
  buildExamResultTemplate,
  buildReportCardTemplate,
} from "../utils/emailTemplates.ts";
import { resolveUserLanguage } from "../utils/languageHelper.ts";
import { getEffectiveSchoolSettings } from "../utils/schoolSettings.ts";

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
      await TimetableGeneration.findByIdAndUpdate(event.data.generationId, {
        status,
        message,
        timetable: timetableId || null,
      });
    };

    try {
      await updateGenerationStatus("running", "Generation started");

      const contextData = await step.run("fetch-class-context", async () => {
        // fetch class
        const classData = await Class.findById(classId).populate("subjects");
        if (!classData) throw new NonRetriableError("Class not found");

        // fetch teachers
        const allTeacher = await User.find({ role: "teacher" });

        // filter qualified teachers for class subjects
        const classSubjectsIds = classData.subjects.map((sub) =>
          sub._id.toString()
        );

        const qualifiedTeachers = allTeacher
          .filter((teacher) => {
            if (!teacher.teacherSubject) return false;
            return teacher.teacherSubject.some((subId) =>
              classSubjectsIds.includes(subId.toString())
            );
          })
          .map((tea) => ({
            id: tea._id,
            name: tea.name,
            subjects: tea.teacherSubject,
          }));

        const subjectsPayload = classData.subjects.map((sub: any) => ({
          id: sub._id,
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

      const allTimetables = await Timetable.find({
        academicYear: academicYearId,
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
        // we should also delete any timetable assigned or generate for these class
        await Timetable.findOneAndDelete({
          class: classId,
          academicYear: academicYearId,
        });
        const timetable = await Timetable.create({
          class: classId,
          academicYear: academicYearId,
          schedule: aiSchedule.schedule,
        });

        return timetable;
      });

      await updateGenerationStatus(
        "completed",
        "Timetable generated successfully",
        savedTimetable._id.toString()
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
      await ExamGeneration.findByIdAndUpdate(generationId, {
        status,
        message,
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
      const existingSubmission = await Submission.findOne({
        exam: examId,
        student: studentId,
      });
      if (existingSubmission) {
        throw new NonRetriableError("Exam already submitted");
      }

      // 2. Fetch full exam (with answers)
      const exam = await Exam.findById(examId).select(
        "+questions.correctAnswer"
      );
      if (!exam) {
        throw new NonRetriableError(`Exam ${examId} not found`);
      }

      // 3. Calculate Score
      let score = 0;
      let totalPoints = 0;

      exam.questions.forEach((question) => {
        totalPoints += question.points;
        const studentAns = answers.find(
          (a: any) => a.questionId === question._id.toString()
        );
        if (studentAns && studentAns.answer === question.correctAnswer) {
          score += question.points;
        }
      });

      // 4. Save Submission
      await Submission.create({
        exam: examId,
        student: studentId,
        answers,
        score,
      });
    });

    await step.run("send-exam-result-notification", async () => {
      const submission = await Submission.findOne({
        exam: examId,
        student: studentId,
      })
        .select("score")
        .lean();

      if (!submission) return { sent: 0, failed: 0 };

      const exam = await Exam.findById(examId)
        .populate("subject", "name")
        .select("title subject questions")
        .lean();

      if (!exam) return { sent: 0, failed: 0 };

      const student = await User.findById(studentId)
        .select("name email parentId schoolSection uiLanguagePreference")
        .lean();

      if (!student?.email) return { sent: 0, failed: 0 };

      const maxScore = Array.isArray((exam as any).questions)
        ? (exam as any).questions.reduce(
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
          userId: String(student._id),
          role: "student",
          schoolSection: (student as any).schoolSection,
          uiLanguagePreference: (student as any).uiLanguagePreference,
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
          examTitle: (exam as any).title,
          subjectName: (exam as any).subject?.name || "Subject",
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
          relatedEntityId: String(examId),
          metadata: {
            studentId: String(student._id),
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
    const { yearId, period, classId, studentId } = event.data as {
      yearId: string;
      period: ReportPeriod;
      classId?: string | null;
      studentId?: string | null;
    };

    const year = await step.run("fetch-academic-year", async () => {
      const data = await AcademicYear.findById(yearId);
      if (!data) {
        throw new NonRetriableError("Academic year not found");
      }
      return data;
    });

    const { start, end } = getPeriodDateRange(year, period);

    const exams = await step.run("fetch-exams-for-period", async () => {
      const examQuery: any = {
        dueDate: { $gte: start, $lte: end },
      };

      if (classId) {
        examQuery.class = classId;
      }

      const found = await Exam.find(examQuery)
        .select("_id subject questions class dueDate")
        .lean();

      return found;
    });

    if (!exams.length) {
      return { message: "No exams found for selected period", generated: 0 };
    }

    const examIds = exams.map((exam: any) => exam._id);

    const submissions = await step.run("fetch-submissions", async () => {
      const submissionQuery: any = {
        exam: { $in: examIds },
      };

      if (studentId) {
        submissionQuery.student = studentId;
      }

      return Submission.find(submissionQuery)
        .select("exam student score")
        .lean();
    });

    const examMap = new Map<string, any>();
    for (const exam of exams as any[]) {
      examMap.set(String(exam._id), exam);
    }

    const gradeIdsByStudent = new Map<string, string[]>();

    await step.run("upsert-grades", async () => {
      for (const submission of submissions as any[]) {
        const exam = examMap.get(String(submission.exam));
        if (!exam) continue;

        const maxScore = Array.isArray(exam.questions)
          ? exam.questions.reduce(
              (sum: number, question: any) => sum + (Number(question.points) || 1),
              0
            )
          : 0;

        if (!maxScore) continue;

        const percentage = Number(((Number(submission.score) / maxScore) * 100).toFixed(2));

        const grade = await Grade.findOneAndUpdate(
          {
            exam: exam._id,
            student: submission.student,
            year: yearId,
            period,
          },
          {
            exam: exam._id,
            student: submission.student,
            score: Number(submission.score) || 0,
            maxScore,
            percentage,
            subject: exam.subject,
            year: yearId,
            period,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const studentKey = String(submission.student);
        const existing = gradeIdsByStudent.get(studentKey) || [];
        existing.push(String(grade._id));
        gradeIdsByStudent.set(studentKey, existing);
      }
    });

    const generatedStudents: string[] = [];

    await step.run("upsert-report-cards", async () => {
      for (const [studentKey, gradeIds] of gradeIdsByStudent.entries()) {
        const grades = await Grade.find({ _id: { $in: gradeIds } })
          .select("percentage")
          .lean();

        if (!grades.length) continue;

        const percentages = grades.map((grade: any) => Number(grade.percentage) || 0);
        const totalExams = percentages.length;
        const average = Number(
          (percentages.reduce((sum, value) => sum + value, 0) / totalExams).toFixed(2)
        );
        const passedExams = percentages.filter((value) => value >= 50).length;
        const failedExams = totalExams - passedExams;
        const highestPercentage = Math.max(...percentages);
        const lowestPercentage = Math.min(...percentages);

        await ReportCard.findOneAndUpdate(
          {
            student: studentKey,
            year: yearId,
            period,
          },
          {
            student: studentKey,
            year: yearId,
            period,
            grades: gradeIds,
            aggregates: {
              average,
              totalExams,
              passedExams,
              failedExams,
              highestPercentage,
              lowestPercentage,
            },
            mention: getMentionFromAverage(average),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

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
        period,
      })
        .populate("student", "name email parentId schoolSection uiLanguagePreference")
        .populate("year", "name")
        .select("student year period aggregates mention")
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
            period,
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
              period,
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
      period,
      yearId,
    };
  }
);