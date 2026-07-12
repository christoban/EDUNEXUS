import { inngest } from "./index.ts";
import { prisma } from "../config/prisma.ts";
import { sendTransactionalEmail } from "../services/emailService.ts";
import { resolveLanguage } from "../utils/languageHelper.ts";
import { getEffectiveSchoolSettings } from "../utils/schoolSettings.ts";
import { createSchoolBackup, purgeSchoolLogsByRetention } from "../utils/schoolBackup.ts";
import { notifyOverdueInvoiceSms, notifyAbsenceThresholdSms } from "../infrastructure/services/SmsNotificationService.ts";

import { NonRetriableError } from "inngest";
import { createGroq } from "@ai-sdk/groq";
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
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new NonRetriableError("GROQ_API_KEY is missing");
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

      const groqClient = createGroq({ apiKey });
      const activeModel = groqClient("llama-3.3-70b-versatile");

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

      // Sous-système de l'école → langue de base (affinée par la section de l'élève si bilingue).
      const school = await prisma.school.findUnique({ where: { id: academicYear.schoolId }, select: { subsystem: true } });

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
                class: { select: { section: { select: { code: true } } } },
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
        const lang = resolveLanguage(school?.subsystem, student.studentProfile?.class?.section?.code ?? null);
        const parentEmails = student.studentProfile?.parents
          .map((p) => p.parentProfile?.user?.email)
          .filter((e): e is string => Boolean(e)) ?? [];

        const subject = lang === "fr"
          ? `Bulletin disponible — ${academicPeriod.name}`
          : `Report card available — ${academicPeriod.name}`;
        const html = lang === "fr"
          ? `<p>Bonjour,<br><br>Le bulletin de <b>${studentName}</b> pour la période <b>${academicPeriod.name}</b> est disponible sur ZekoulABia.</p>`
          : `<p>Hello,<br><br>${studentName}'s report card for <b>${academicPeriod.name}</b> is now available on ZekoulABia.</p>`;
        const text = lang === "fr"
          ? `Le bulletin de ${studentName} pour ${academicPeriod.name} est disponible.`
          : `${studentName}'s report card for ${academicPeriod.name} is available.`;

        const recipients = [student.email, ...parentEmails];
        for (const email of recipients) {
          try {
            await sendTransactionalEmail({
              recipientEmail: email,
              subject,
              html,
              text,
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

export const computeStudentHealthScores = inngest.createFunction(
  { id: "compute-student-health-scores", name: "Calcul indice santé scolaire", triggers: [{ cron: "0 2 * * *" }] },
  async ({ step }) => {
    await step.run("compute-all-schools", async () => {
      const schools = await prisma.school.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });

      for (const school of schools) {
        const students = await prisma.studentProfile.findMany({
          where: { user: { schoolId: school.id } },
          select: { id: true, userId: true },
        });

        for (const student of students) {
          try {
            // 1. Moyenne générale (40%)
            const grades = await prisma.grade.findMany({
              where: {
                schoolId: school.id,
                studentId: student.userId,
                validationStatus: { in: ["VALIDATED", "LOCKED"] },
              },
              select: { sequenceAverage: true, coefficient: true },
            });
            let avgScore = 0;
            if (grades.length > 0) {
              const weighted = grades.reduce((s, g) => s + (g.sequenceAverage ?? 0) * (g.coefficient ?? 1), 0);
              const totalCoeff = grades.reduce((s, g) => s + (g.coefficient ?? 1), 0);
              const avg = totalCoeff > 0 ? weighted / totalCoeff : 0;
              avgScore = Math.min(100, (avg / 20) * 100);
            }

            // 2. Taux de présence (25%)
            const totalAttendance = await prisma.attendance.count({
              where: { schoolId: school.id, studentId: student.userId },
            });
            const presentAttendance = await prisma.attendance.count({
              where: { schoolId: school.id, studentId: student.userId, status: { in: ["PRESENT", "LATE"] } },
            });
            const attendanceScore = totalAttendance > 0 ? (presentAttendance / totalAttendance) * 100 : 100;

            // 3. Tendance (15%) — comparaison avec 30 jours avant
            const recentGrades = await prisma.grade.findMany({
              where: {
                schoolId: school.id, studentId: student.userId,
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                validationStatus: { in: ["VALIDATED", "LOCKED"] },
              },
              select: { sequenceAverage: true },
            });
            const olderGrades = await prisma.grade.findMany({
              where: {
                schoolId: school.id, studentId: student.userId,
                createdAt: {
                  gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
                  lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
                validationStatus: { in: ["VALIDATED", "LOCKED"] },
              },
              select: { sequenceAverage: true },
            });
            const recentAvg = recentGrades.length > 0
              ? recentGrades.reduce((s, g) => s + (g.sequenceAverage ?? 0), 0) / recentGrades.length
              : 0;
            const olderAvg = olderGrades.length > 0
              ? olderGrades.reduce((s, g) => s + (g.sequenceAverage ?? 0), 0) / olderGrades.length
              : recentAvg;
            const trend = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
            const trendScore = Math.min(100, Math.max(0, 50 + trend * 2.5));

            // 4. Comportement (10%) — 100 par défaut (pas encore de table incidents)
            const behaviorScore = 100;

            // 5. Paiements (10%)
            const overdueInvoices = await prisma.invoice.count({
              where: {
                schoolId: school.id, studentId: student.userId,
                status: { in: ["PENDING", "PARTIAL"] },
                dueDate: { lt: new Date() },
              },
            }).catch(() => 0);
            const paymentScore = overdueInvoices === 0 ? 100 : Math.max(0, 100 - overdueInvoices * 20);

            const healthScore = Math.round(
              avgScore * 0.40 +
              attendanceScore * 0.25 +
              trendScore * 0.15 +
              behaviorScore * 0.10 +
              paymentScore * 0.10
            );

            await prisma.studentProfile.update({
              where: { id: student.id },
              data: { healthScore },
            });

            if (healthScore <= 30) {
              await inngest.send({
                name: "ai/alert.critical",
                data: { studentId: student.userId, schoolId: school.id, healthScore, type: "SMS" },
              });
            } else if (healthScore <= 50) {
              await inngest.send({
                name: "ai/alert.warning",
                data: { studentId: student.userId, schoolId: school.id, healthScore, type: "APP" },
              });
            }

            if (trend >= 2) {
              await inngest.send({
                name: "ai/alert.positive",
                data: { studentId: student.userId, schoolId: school.id, healthScore, trend },
              });
            }
          } catch (err) {
            console.error(`Health score error for student ${student.userId}:`, err);
          }
        }
      }
    });

    return { computed: true };
  }
);

export const sendPaymentReminders = inngest.createFunction(
  { id: "send-payment-reminders", name: "Relances paiement automatiques", triggers: [{ cron: "0 8 * * *" }] },
  async ({ step }) => {
    return await step.run("find-and-remind", async () => {
      const today = new Date();
      const in7days = new Date(today);
      in7days.setDate(today.getDate() + 7);

      const overdueInvoices = await prisma.invoice.findMany({
        where: {
          status: { in: ["PENDING", "PARTIAL"] },
          dueDate: { lte: in7days },
        },
        include: {
          student: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              studentProfile: {
                include: {
                  parents: {
                    include: {
                      parentProfile: {
                        include: { user: { select: { email: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
          school: { select: { name: true } },
          feePlan: { select: { name: true } },
        },
      });

      let processed = 0;

      for (const invoice of overdueInvoices) {
        if (!invoice.dueDate) continue;

        const parentEmails = invoice.student?.studentProfile?.parents
          .map((p) => p.parentProfile?.user?.email)
          .filter((e): e is string => Boolean(e)) ?? [];

        if (!invoice.student?.email && parentEmails.length === 0) continue;

        const daysUntilDue = Math.ceil(
          (new Date(invoice.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        let subject = "";
        const isOverdue = daysUntilDue < 0;
        if (daysUntilDue === 7) subject = "Rappel : Paiement dû dans 7 jours";
        else if (daysUntilDue === 3) subject = "Urgent : Paiement dû dans 3 jours";
        else if (daysUntilDue === 0) subject = "Aujourd'hui : Dernier délai de paiement";
        else if (isOverdue) subject = `Retard de paiement — ${Math.abs(daysUntilDue)} jour(s)`;
        else continue;

        const label = invoice.feePlan?.name || invoice.description || "Facture";
        const amountFormatted = new Intl.NumberFormat("fr-CM", {
          style: "currency",
          currency: "XAF",
          maximumFractionDigits: 0,
        }).format(invoice.amount);
        const dueDateFormatted = new Date(invoice.dueDate).toLocaleDateString("fr-FR");
        const schoolName = invoice.school?.name ?? "ZekoulABia";

        const allEmails = [
          ...(invoice.student?.email ? [invoice.student.email] : []),
          ...parentEmails,
        ];

        for (const email of [...new Set(allEmails)]) {
          try {
            await sendTransactionalEmail({
              recipientEmail: email,
              subject: `${subject} — ${schoolName}`,
              html: `
                <p>Bonjour,</p>
                <p>Facture : <b>${label}</b></p>
                <p>Montant : <b>${amountFormatted}</b></p>
                <p>Échéance : <b>${dueDateFormatted}</b></p>
                <p>Connectez-vous sur ZekoulABia pour payer en ligne.</p>
              `,
              text: `Facture ${label} - ${invoice.amount} XAF - Échéance ${dueDateFormatted}`,
              template: "payment_reminder",
              eventType: "payment_reminder",
            });
            processed++;
          } catch (err) {
            console.error("Reminder email error:", err);
          }
        }

        // SMS supplémentaire pour les factures vraiment en retard
        if (isOverdue && invoice.studentId) {
          const studentName = `${invoice.student?.firstName ?? ''} ${invoice.student?.lastName ?? ''}`.trim();
          void notifyOverdueInvoiceSms({
            schoolId: invoice.schoolId,
            studentId: invoice.studentId,
            studentName,
            amount: invoice.amount,
            daysOverdue: Math.abs(daysUntilDue),
            invoiceLabel: label,
          });
        }
      }

      return { processed };
    });
  }
);

export const checkAbsenceThreshold = inngest.createFunction(
  { id: "check-absence-threshold", name: "Vérification seuil d'absences", triggers: [{ cron: "0 7 * * *" }] },
  async ({ step }) => {
    return await step.run("check-thresholds", async () => {
      const schools = await prisma.school.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      let alertsSent = 0;

      for (const school of schools) {
        const config = await prisma.schoolConfig.findUnique({
          where: { schoolId: school.id },
          select: { absenceAlertThreshold: true },
        });
        const threshold = config?.absenceAlertThreshold ?? 3;

        const absenceCounts = await prisma.attendance.groupBy({
          by: ["studentId"],
          where: { schoolId: school.id, status: "ABSENT", date: { gte: since } },
          _count: { id: true },
        });

        const overThreshold = absenceCounts.filter((a) => a._count.id >= threshold);
        if (overThreshold.length === 0) continue;

        const surveillants = await prisma.staffProfile.findMany({
          where: {
            schoolId: school.id,
            permissions: { some: { permission: "MANAGE_ATTENDANCE" } },
          },
          include: { user: { select: { email: true, firstName: true } } },
        });

        for (const entry of overThreshold) {
          const student = await prisma.user.findUnique({
            where: { id: entry.studentId },
            select: { firstName: true, lastName: true },
          });
          if (!student) continue;

          const studentName = `${student.firstName} ${student.lastName}`.trim();
          const count = entry._count.id;

          for (const s of surveillants) {
            if (!s.user.email) continue;
            try {
              await sendTransactionalEmail({
                recipientEmail: s.user.email,
                subject: `Alerte absences — ${studentName} (${count} absences non justifiées)`,
                html: `<p>Bonjour ${s.user.firstName},</p><p><b>${studentName}</b> cumule <b>${count} absences non justifiées</b> sur les 30 derniers jours (seuil configuré : ${threshold}).</p><p>Une action est requise.</p>`,
                text: `${studentName} : ${count} absences non justifiées (seuil ${threshold})`,
                template: "absence_alert",
                eventType: "absence_alert",
              });
            } catch (err) {
              console.error("Absence alert email error:", err);
            }
          }

          void notifyAbsenceThresholdSms({
            schoolId: school.id,
            studentId: entry.studentId,
            studentName,
            count,
            threshold,
          });

          alertsSent++;
        }
      }

      return { alertsSent };
    });
  }
);

export const markOverdueLoans = inngest.createFunction(
  { id: "mark-overdue-loans", name: "Marquer emprunts en retard", triggers: [{ cron: "0 1 * * *" }] },
  async ({ step }) => {
    return await step.run("update-overdue-loans", async () => {
      const result = await prisma.bookLoan.updateMany({
        where: { status: "ACTIVE", dueDate: { lt: new Date() } },
        data: { status: "OVERDUE" },
      });
      return { updated: result.count };
    });
  }
);

export const purgeSchoolLogs = inngest.createFunction(
  { id: "purge-school-logs", name: "Purge hebdomadaire des journaux", triggers: [{ cron: "0 0 * * 0" }] },
  async ({ step }) => {
    return await step.run("purge-school-logs-by-retention", async () => {
      const schools = await prisma.school.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true },
      });

      const results = [] as Array<Awaited<ReturnType<typeof purgeSchoolLogsByRetention>>>;

      for (const school of schools) {
        results.push(await purgeSchoolLogsByRetention(prisma, school.id));
      }

      return { schoolsProcessed: schools.length, results };
    });
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
          html: `<p>Bonjour ${censeur.user.firstName},<br><br>Des notes de <b>${grade.subject.name}</b> — <b>${grade.class?.name}</b> sont en attente de validation depuis 48h.<br><br>Connectez-vous à ZekoulABia pour valider.</p>`,
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

export const BackupSchoolDataJob = inngest.createFunction(
  {
    id: "Backup-School-Data",
    name: "Sauvegarde des données établissement",
    triggers: [{ event: "backup/school.requested" }, { cron: "0 3 * * *" }],
  },
  async ({ event, step }) => {
    const payload = (event.data ?? {}) as {
      schoolId?: string;
      requestedByMasterId?: string | null;
      source?: "cron" | "manual";
    };

    const schools = payload.schoolId
      ? await prisma.school.findMany({ where: { id: payload.schoolId }, select: { id: true, name: true } })
      : await prisma.school.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true } });

    const backups = await step.run("create-school-backups", async () => {
      const results: Array<{ schoolId: string; fileName: string; filePath: string; createdAt: string }> = [];
      for (const school of schools) {
        results.push(await createSchoolBackup(prisma, {
          schoolId: school.id,
          requestedByMasterId: payload.requestedByMasterId ?? null,
          source: payload.source ?? (payload.schoolId ? "manual" : "cron"),
        }));
      }
      return results;
    });

    return { requestedSchoolId: payload.schoolId ?? null, schoolsProcessed: schools.length, backups };
  }
);