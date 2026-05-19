import { inngest } from "./index.ts";
import { prisma } from "../config/prisma.ts";
import { sendTransactionalEmail } from "../services/emailService.ts";
import { buildExamResultTemplate } from "../utils/emailTemplates.ts";
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
      await (prisma as any).timetableGeneration.update({
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
        const classData = await prisma.class.findUnique({
          where: { id: classId },
          select: { id: true, name: true, schoolId: true },
        });
        if (!classData) throw new NonRetriableError("Class not found");

        const teacherProfiles = await prisma.teacherProfile.findMany({
          where: {
            teacherSubjects: { some: {} },
            user: { schoolId: classData.schoolId },
          },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            teacherSubjects: {
              include: { subject: { select: { id: true, name: true, code: true } } },
            },
          },
        });

        const qualifiedTeachers = teacherProfiles.map((tp) => ({
          id: tp.user.id,
          name: `${tp.user.firstName} ${tp.user.lastName}`.trim(),
          subjects: tp.teacherSubjects.map((ts) => ts.subjectId),
        }));

        const schoolSubjects = await prisma.subject.findMany({
          where: { schoolId: classData.schoolId },
          select: { id: true, name: true, code: true },
        });

        if (schoolSubjects.length === 0 || qualifiedTeachers.length === 0)
          throw new NonRetriableError("No Subjects or Teachers assigned to this school");

        return {
          className: classData.name,
          subjects: schoolSubjects,
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
      const activeModel = google("gemini-1.5-flash");

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
          } as any,
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
      await (prisma as any).examGeneration.update({
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
        const activeModel = google("gemini-1.5-flash");

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
        const exam = await prisma.exam.findUnique({ where: { id: examId } });
        if (!exam) throw new NonRetriableError(`Exam ${examId} not found`);
        await prisma.exam.update({
          where: { id: examId },
          data: {
            content: aiExam,
          },
        });
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

      const questions = (exam.content as any[]) || [];
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
        } as any,
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

      const student = await (prisma.user.findUnique as any)({
        where: { id: studentId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          studentProfile: {
            include: {
              parents: {
                include: {
                  parentProfile: {
                    include: {
                      user: {
                        select: { id: true, email: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }) as any;

      if (!student?.email) return { sent: 0, failed: 0 };

      const studentName = `${student.firstName} ${student.lastName}`.trim();

      const questions = (exam.content as any[]) || [];
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
          schoolSection: student.schoolSection as any,
          uiLanguagePreference: student.uiLanguagePreference as any,
        },
      ];

      const parentUsers = student.studentProfile?.parents
        .map(entry => entry.parentProfile?.user)
        .filter((user): user is NonNullable<typeof user> => Boolean(user?.email)) ?? [];

      for (const parentUser of parentUsers) {
        if (parentUser.email) {
          recipients.push({
            email: parentUser.email,
            userId: parentUser.id,
            role: "parent",
            uiLanguagePreference: parentUser.uiLanguagePreference as any,
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
          recipientName: studentName,
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
    const { yearId, periodId, classId, studentId } = event.data as {
      yearId: string;
      period?: string;
      periodId?: string | null;
      classId?: string | null;
      studentId?: string | null;
    };

    const academicYear = await step.run("fetch-academic-year", async () => {
      const data = await prisma.academicYear.findUnique({ where: { id: yearId } });
      if (!data) throw new NonRetriableError("Academic year not found");
      return data;
    });

    const academicPeriod = await step.run("resolve-academic-period", async () => {
      if (!periodId) throw new NonRetriableError("periodId is required");
      const found = await prisma.academicPeriod.findFirst({
        where: { id: periodId, academicYearId: yearId },
      });
      if (!found) throw new NonRetriableError("Academic period not found");
      return found;
    });

    const students = await step.run("fetch-students", async () => {
      const where: any = {
        schoolId: academicYear.schoolId,
        role: "STUDENT",
        isActive: true,
        ...(studentId ? { id: studentId } : {}),
        ...(classId ? { studentProfile: { classId } } : {}),
      };
      return prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          studentProfile: { select: { classId: true } },
        },
      });
    });

    if (!students.length) {
      return { message: "No students found", generated: 0 };
    }

    const generatedStudents: string[] = [];

    await step.run("generate-report-cards", async () => {
      for (const student of students) {
        const studentClassId = student.studentProfile?.classId;
        if (!studentClassId) continue;

        const sequences = await prisma.academicSequence.findMany({
          where: { academicPeriodId: academicPeriod.id },
          orderBy: { orderIndex: "asc" },
        });

        if (!sequences.length) continue;
        const sequenceIds = sequences.map((s) => s.id);

        const grades = await prisma.grade.findMany({
          where: {
            schoolId: academicYear.schoolId,
            studentId: student.id,
            academicYearId: yearId,
            classId: studentClassId,
            sequenceId: { in: sequenceIds },
          },
          include: { subject: { select: { id: true, name: true, coefficient: true } } },
        });

        if (!grades.length) continue;

        const gradesBySubject = new Map<string, typeof grades>();
        for (const grade of grades) {
          const existing = gradesBySubject.get(grade.subjectId) || [];
          existing.push(grade);
          gradesBySubject.set(grade.subjectId, existing);
        }

        const subjectAverages: { subjectId: string; average: number; coefficient: number }[] = [];
        for (const [subjectId, subjectGrades] of gradesBySubject.entries()) {
          const validScores = subjectGrades
            .map((g) => g.sequenceAverage ?? g.sequenceScore)
            .filter((v): v is number => v !== null && v !== undefined);
          if (!validScores.length) continue;
          const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
          const coeff = Number(subjectGrades[0]?.coefficient ?? subjectGrades[0]?.subject.coefficient ?? 1);
          subjectAverages.push({ subjectId, average: avg, coefficient: coeff });
        }

        if (!subjectAverages.length) continue;

        const totalWeighted = subjectAverages.reduce((sum, s) => sum + s.average * s.coefficient, 0);
        const totalCoeff = subjectAverages.reduce((sum, s) => sum + s.coefficient, 0);
        const generalAverage = totalCoeff > 0 ? totalWeighted / totalCoeff : 0;

        const classmates = await prisma.grade.groupBy({
          by: ["studentId"],
          where: {
            schoolId: academicYear.schoolId,
            classId: studentClassId,
            academicYearId: yearId,
            sequenceId: { in: sequenceIds },
          },
          _avg: { sequenceAverage: true },
          orderBy: { _avg: { sequenceAverage: "desc" } },
        });

        const rank = classmates.findIndex((c) => c.studentId === student.id) + 1;
        const totalStudents = classmates.length;

        let mention = "Insuffisant";
        if (generalAverage >= 18) mention = "Excellent";
        else if (generalAverage >= 16) mention = "Très Bien";
        else if (generalAverage >= 14) mention = "Bien";
        else if (generalAverage >= 12) mention = "Assez Bien";
        else if (generalAverage >= 10) mention = "Passable";
        else if (generalAverage >= 6) mention = "Très Insuffisant";
        else mention = "Médiocre";

        const absenceCount = await prisma.attendance.count({
          where: {
            schoolId: academicYear.schoolId,
            studentId: student.id,
            academicPeriodId: academicPeriod.id,
            status: { in: ["ABSENT", "LATE"] },
          },
        });

        const reportCard = await prisma.reportCard.upsert({
          where: { studentId_academicPeriodId: { studentId: student.id, academicPeriodId: academicPeriod.id } },
          create: {
            schoolId: academicYear.schoolId,
            studentId: student.id,
            academicYearId: yearId,
            academicPeriodId: academicPeriod.id,
            generalAverage: Math.round(generalAverage * 100) / 100,
            rank: rank || null,
            mention,
            absenceCount,
            isGenerated: true,
          },
          update: {
            generalAverage: Math.round(generalAverage * 100) / 100,
            rank: rank || null,
            mention,
            absenceCount,
            isGenerated: true,
          },
        });

        for (const { subjectId, average, coefficient } of subjectAverages) {
          const subjectGrades = gradesBySubject.get(subjectId) || [];
          const subjectName = subjectGrades[0]?.subject.name || "";
          const seq1 = subjectGrades.find((g) => sequences[0] && g.sequenceId === sequences[0].id);
          const seq2 = subjectGrades.find((g) => sequences[1] && g.sequenceId === sequences[1].id);

          await prisma.reportCardSubjectLine.upsert({
            where: { reportCardId_subjectId: { reportCardId: reportCard.id, subjectId } },
            create: {
              reportCardId: reportCard.id,
              subjectId,
              subjectName,
              coefficient,
              seq1Score: seq1?.sequenceScore ?? null,
              seq2Score: seq2?.sequenceScore ?? null,
              subjectAverage: Math.round(average * 100) / 100,
            },
            update: {
              subjectName,
              coefficient,
              seq1Score: seq1?.sequenceScore ?? null,
              seq2Score: seq2?.sequenceScore ?? null,
              subjectAverage: Math.round(average * 100) / 100,
            },
          });
        }

        generatedStudents.push(student.id);
      }
    });

    await step.run("send-notifications", async () => {
      if (!generatedStudents.length) return { sent: 0 };
      let sent = 0;

      for (const stdId of generatedStudents) {
        const student = await prisma.user.findUnique({
          where: { id: stdId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            studentProfile: {
              include: {
                parents: {
                  include: {
                    parentProfile: {
                      include: { user: { select: { id: true, email: true } } },
                    },
                  },
                },
              },
            },
          },
        });
        if (!student?.email) continue;

        const studentName = `${student.firstName} ${student.lastName}`.trim();
        const parentEmails = student.studentProfile?.parents
          .map((p) => p.parentProfile?.user?.email)
          .filter((e): e is string => Boolean(e)) ?? [];

        const recipients = [student.email, ...parentEmails];
        for (const email of recipients) {
          try {
            await sendTransactionalEmail({
              recipientEmail: email,
              subject: `Bulletin disponible — ${academicPeriod.name}`,
              html: `<p>Bonjour,<br><br>Le bulletin de <b>${studentName}</b> pour la période <b>${academicPeriod.name}</b> est disponible sur EduNexus.</p>`,
              text: `Le bulletin de ${studentName} pour ${academicPeriod.name} est disponible.`,
              template: "report_card_available",
              eventType: "report_card_available",
            });
            sent++;
          } catch {
            // Non-bloquant
          }
        }
      }
      return { sent };
    });

    return { message: "Report cards generated", generated: generatedStudents.length };
  }
);

export const handleGradeSubmitted = inngest.createFunction(
  { id: "Handle-Grade-Submitted", triggers: [{ event: "grade/submitted" }] },
  async ({ event, step }) => {
    const { gradeId, schoolId, classId, subjectId, sequenceId, submittedAt } = event.data as {
      gradeId: string;
      schoolId: string;
      classId: string;
      subjectId: string;
      sequenceId: string;
      submittedAt: string;
    };

    await step.sleep("wait-48h", "48h");

    await step.run("check-48h-reminder", async () => {
      const grade = await prisma.grade.findUnique({
        where: { id: gradeId },
        include: {
          subject: { select: { name: true } },
          class: { select: { name: true } },
        },
      });
      if (!grade || grade.validationStatus !== "SUBMITTED") return;

      const censeurs = await prisma.staffProfile.findMany({
        where: {
          schoolId,
          permissions: { some: { permission: "VALIDATE_GRADES" } },
        },
        include: { user: { select: { id: true, email: true, firstName: true } } },
      });

      for (const censeur of censeurs) {
        if (!censeur.user.email) continue;
        await sendTransactionalEmail({
          recipientEmail: censeur.user.email,
          subject: `[RELANCE] Notes en attente de validation — ${grade.subject.name} ${grade.class?.name}`,
          html: `<p>Bonjour ${censeur.user.firstName},<br><br>Des notes de <b>${grade.subject.name}</b> — <b>${grade.class?.name}</b> sont en attente de validation depuis 48h.<br><br>Connectez-vous à EduNexus pour valider.</p>`,
          text: `Notes en attente depuis 48h : ${grade.subject.name} — ${grade.class?.name}`,
          template: "grade_reminder",
          eventType: "grade_reminder_48h",
        });
      }
    });

    await step.sleep("wait-24h-more", "24h");

    await step.run("check-72h-admin-alert", async () => {
      const grade = await prisma.grade.findUnique({
        where: { id: gradeId },
        include: {
          subject: { select: { name: true } },
          class: { select: { name: true } },
        },
      });
      if (!grade || grade.validationStatus !== "SUBMITTED") return;

      const admins = await prisma.user.findMany({
        where: { schoolId, role: "ADMIN", isActive: true },
        select: { id: true, email: true, firstName: true },
      });

      for (const admin of admins) {
        if (!admin.email) continue;
        await sendTransactionalEmail({
          recipientEmail: admin.email,
          subject: `[URGENT] Notes bloquées depuis 72h — ${grade.subject.name}`,
          html: `<p>Bonjour ${admin.firstName},<br><br>Les notes de <b>${grade.subject.name}</b> — <b>${grade.class?.name}</b> sont en attente de validation depuis <b>72h</b>.<br><br>Action requise immédiatement.</p>`,
          text: `URGENT : Notes bloquées depuis 72h — ${grade.subject.name}`,
          template: "grade_reminder",
          eventType: "grade_reminder_72h",
        });
      }
    });
  }
);