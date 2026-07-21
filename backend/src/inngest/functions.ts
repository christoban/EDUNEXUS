import { inngest } from "./index.ts";
import { prisma } from "../config/prisma.ts";
import { sendTransactionalEmail } from "../services/emailService.ts";
import { resolveLanguage } from "../utils/languageHelper.ts";
import { getEffectiveSchoolSettings } from "../utils/schoolSettings.ts";
import { createSchoolBackup, purgeSchoolLogsByRetention } from "../utils/schoolBackup.ts";
import { notifyOverdueInvoiceSms, notifyAbsenceThresholdSms, notifyOverdueBookSms } from "../infrastructure/services/SmsNotificationService.ts";
import { SocketNotificationService } from "../infrastructure/services/SocketNotificationService";
import { notifierParentsPushDabord } from "../infrastructure/services/PushFirstNotifier";
import { PrismaSanteEleveRepository } from "../infrastructure/persistence/prisma/PrismaSanteEleveRepository";
import { CalculerIndiceSanteUseCase } from "../application/ai/CalculerIndiceSanteUseCase";
import { GroqIAService } from "../infrastructure/services/GroqIAService";
import { estJourOuvreScolaire, ajouterJoursOuvresScolaires, prolongerSiFermetureAujourdhui } from "../utils/schoolCalendar";
import { notifierEvenementAcademique } from "../utils/academicEventNotifier";
import { activerRessourceLieeSiApplicable, synchroniserClotureRessourceLiee, cloturerRessourceLiee } from "../application/academicEvent";

const iaService = new GroqIAService();
const calculerIndiceSanteUseCase = new CalculerIndiceSanteUseCase(
  new PrismaSanteEleveRepository(prisma),
  iaService,
);

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
        const parentRecipients = student.studentProfile?.parents
          .map((p) => p.parentProfile?.user ? { email: p.parentProfile.user.email, userId: p.parentProfile.user.id } : null)
          .filter((r): r is { email: string; userId: string } => Boolean(r?.email)) ?? [];

        const subject = lang === "fr"
          ? `Bulletin disponible — ${academicPeriod.name}`
          : `Report card available — ${academicPeriod.name}`;
        const html = lang === "fr"
          ? `<p>Bonjour,<br><br>Le bulletin de <b>${studentName}</b> pour la période <b>${academicPeriod.name}</b> est disponible sur ZekoulABia.</p>`
          : `<p>Hello,<br><br>${studentName}'s report card for <b>${academicPeriod.name}</b> is now available on ZekoulABia.</p>`;
        const text = lang === "fr"
          ? `Le bulletin de ${studentName} pour ${academicPeriod.name} est disponible.`
          : `${studentName}'s report card for ${academicPeriod.name} is available.`;

        const recipients = [{ email: student.email, userId: student.id }, ...parentRecipients];
        for (const recipient of recipients) {
          try {
            await sendTransactionalEmail({
              recipientEmail: recipient.email,
              recipientUserId: recipient.userId,
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
        const config = await (prisma as any).schoolConfig
          .findFirst({
            where: { schoolId: school.id },
            select: { aiAlertsEnabled: true, aiRiskThreshold: true, aiRiskThresholdCritical: true },
          })
          .catch(() => null);
        const alertsEnabled = config?.aiAlertsEnabled ?? true;
        const warningThreshold = config?.aiRiskThreshold ?? 50;
        const criticalThreshold = config?.aiRiskThresholdCritical ?? 30;

        // Sans année courante configurée, le calcul (qui filtre par academicYearId) n'a pas de sens.
        const currentYear = await prisma.academicYear.findFirst({
          where: { schoolId: school.id, isCurrent: true },
          select: { id: true },
        });
        if (!currentYear) continue;

        const students = await prisma.studentProfile.findMany({
          where: { user: { schoolId: school.id } },
          select: { userId: true },
        });

        for (const student of students) {
          try {
            // Source de calcul unique (CalculerIndiceSanteUseCase) — remplace l'ancienne
            // logique dupliquée ici, qui divergeait de celle utilisée par l'endpoint à la
            // demande (poids différents, comportement toujours à 100).
            const { score, tendancePositive } = await calculerIndiceSanteUseCase.calculerScoreSeulement(
              student.userId,
              school.id,
              currentYear.id,
            );

            if (!alertsEnabled) continue;

            if (score <= criticalThreshold) {
              await inngest.send({
                name: "ai/alert.critical",
                data: { studentId: student.userId, schoolId: school.id, healthScore: score },
              });
            } else if (score <= warningThreshold) {
              await inngest.send({
                name: "ai/alert.warning",
                data: { studentId: student.userId, schoolId: school.id, healthScore: score },
              });
            }

            if (tendancePositive) {
              await inngest.send({
                name: "ai/alert.positive",
                data: { studentId: student.userId, schoolId: school.id, healthScore: score },
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

/**
 * Routage par rôle des 3 signaux ci-dessus — jusqu'ici ces événements étaient envoyés sans
 * aucun gestionnaire à l'écoute (vérifié : 0 occurrence ailleurs dans le code avant ce chantier),
 * donc jamais aucune notification n'était réellement délivrée à qui que ce soit.
 *
 * Principe de routage :
 * - Parent : toujours notifié (push d'abord, repli SMS — notifierParentsPushDabord, même
 *   mécanisme déjà utilisé pour absence/paiement/discipline/bibliothèque).
 * - Professeur Principal de la classe : notifié pour critique/avertissement (vue d'ensemble de
 *   l'élève), in-app + push, jamais de SMS (comme les autres membres du personnel).
 * - Staff avec la permission VALIDATE_GRADES (Censeur/équivalent) : notifié uniquement pour le
 *   niveau critique, pour éviter le bruit sur chaque avertissement.
 * - Élève : pas de canal fiable aujourd'hui (aucune section réglages/push élève n'existe encore,
 *   voir PLAN_NOTIFICATIONS_PUSH.md) — non ciblé directement pour l'instant.
 */
async function resolveStudentContext(studentId: string, schoolId: string) {
  const profile = await prisma.studentProfile.findFirst({
    where: { userId: studentId, user: { schoolId } },
    select: {
      classId: true,
      user: { select: { firstName: true, lastName: true } },
      class: { select: { name: true, professorPrincipalId: true } },
    },
  });
  return {
    nomComplet: profile ? `${profile.user.firstName} ${profile.user.lastName}` : "Élève",
    classId: profile?.classId ?? null,
    className: profile?.class?.name ?? null,
    professorPrincipalId: profile?.class?.professorPrincipalId ?? null,
  };
}

async function notifierPersonnelDirect(userId: string, schoolId: string, titre: string, corps: string) {
  const socketService = new SocketNotificationService();
  await socketService
    .envoyer({ schoolId, userId, type: "STUDENT_RISK_ALERT", titre, corps, canal: "IN_APP" })
    .catch((err) => console.error("[HealthAlert] IN_APP personnel:", err?.message));
  const { notifierUtilisateurPush } = await import("../infrastructure/services/PushNotificationService");
  await notifierUtilisateurPush({ userId, title: titre, body: corps }).catch(() => {});
}

/**
 * Phase 4 — conseil IA personnalisé par destinataire, en plus du message d'alerte générique
 * ci-dessus. Persisté dans StudentRecommendation pour alimenter les vues par rôle (Phase 5) et
 * la détection de risque persistant côté Orientation (Phase 7). En cas d'échec Groq, retourne
 * null sans lever — l'appelant garde alors le message générique déjà calculé (dégradation
 * gracieuse, même principe que le reste de ce fichier : jamais bloquer une notification pour
 * une panne IA).
 */
async function genererEtPersisterConseil(params: {
  schoolId: string;
  studentId: string;
  subjectId?: string | null;
  nomEleve: string;
  contexte: string;
  recipientRole: "STUDENT" | "PARENT" | "TEACHER";
  contextType: "HEALTH_CRITICAL" | "HEALTH_WARNING" | "HEALTH_POSITIVE" | "SUBJECT_DROP";
  destinataire: "ELEVE" | "PARENT" | "ENSEIGNANT";
}): Promise<string | null> {
  try {
    const content = await iaService.genererConseilPersonnalise({
      nomEleve: params.nomEleve,
      contexte: params.contexte,
      destinataire: params.destinataire,
    });
    await prisma.studentRecommendation.create({
      data: {
        schoolId: params.schoolId,
        studentId: params.studentId,
        subjectId: params.subjectId ?? null,
        recipientRole: params.recipientRole,
        contextType: params.contextType,
        content,
      },
    });
    return content;
  } catch (err: any) {
    console.error("[Conseil IA]", err?.message);
    return null;
  }
}

/**
 * Phase 7b — si un élève enchaîne plusieurs épisodes CRITIQUE récents, suggère un suivi
 * Orientation en NOTIFIANT le(s) Conseiller(s) d'Orientation (permission MANAGE_ORIENTATION) —
 * on n'ouvre JAMAIS de FicheOrientation automatiquement : CreerFicheOrientationUseCase exige un
 * conseillerId humain, et la convention du projet est « jamais d'action sur une supposition ».
 * Si une fiche existe déjà pour l'élève sur l'année courante, on ne notifie pas à nouveau — le
 * suivi est déjà engagé.
 */
async function suggererOrientationSiRisquePersistant(
  studentId: string, schoolId: string, nomComplet: string, className: string | null,
): Promise<void> {
  try {
    const seuilDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const occurrences = await prisma.studentRecommendation.count({
      where: { studentId, schoolId, recipientRole: "STUDENT", contextType: "HEALTH_CRITICAL", createdAt: { gte: seuilDate } },
    });
    if (occurrences < 2) return;

    const anneeCourante = await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true } });
    if (!anneeCourante) return;

    const ficheExistante = await prisma.ficheOrientation.findFirst({
      where: { studentId, academicYearId: anneeCourante.id },
      select: { id: true },
    });
    if (ficheExistante) return;

    const conseillers = await prisma.staffProfile.findMany({
      where: { schoolId, permissions: { some: { permission: "MANAGE_ORIENTATION" } } },
      select: { userId: true },
    }).catch(() => []);
    for (const c of conseillers) {
      await notifierPersonnelDirect(
        c.userId, schoolId,
        "Suivi Orientation suggéré",
        `${nomComplet} (${className ?? "N/A"}) est en risque critique de façon répétée (${occurrences} alerte(s) récente(s)). Une fiche d'orientation pourrait être ouverte.`,
      );
    }
  } catch (err: any) {
    console.error("[Orientation] suggestion:", err?.message);
  }
}

export const handleCriticalHealthAlert = inngest.createFunction(
  { id: "handle-critical-health-alert", name: "Alerte élève — risque critique", triggers: [{ event: "ai/alert.critical" }] },
  async ({ event }) => {
    const { studentId, schoolId, healthScore } = event.data as { studentId: string; schoolId: string; healthScore: number };
    const { nomComplet, className, professorPrincipalId } = await resolveStudentContext(studentId, schoolId);
    const contexte = `Indice de santé scolaire au niveau critique (${healthScore}/100), dans la classe ${className ?? "N/A"}. Une période difficile qui nécessite un accompagnement rapproché.`;

    const conseilParent = await genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "PARENT", contextType: "HEALTH_CRITICAL", destinataire: "PARENT",
    });
    await notifierParentsPushDabord({
      schoolId,
      studentId,
      type: "STUDENT_RISK_ALERT",
      titre: "Alerte — suivi urgent recommandé",
      corps: conseilParent ?? `${nomComplet} (${className ?? "sa classe"}) traverse une période difficile (indice de santé scolaire : ${healthScore}/100). Un échange avec l'établissement est recommandé.`,
    }).catch((err) => console.error("[HealthAlert] parent critique:", err?.message));

    // Persisté pour la vue élève (Phase 5c) — pas de notification directe, aucun canal fiable
    // vers l'élève aujourd'hui (voir note en tête de section).
    void genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "STUDENT", contextType: "HEALTH_CRITICAL", destinataire: "ELEVE",
    });

    if (professorPrincipalId) {
      const conseilEnseignant = await genererEtPersisterConseil({
        schoolId, studentId, nomEleve: nomComplet, contexte,
        recipientRole: "TEACHER", contextType: "HEALTH_CRITICAL", destinataire: "ENSEIGNANT",
      });
      await notifierPersonnelDirect(
        professorPrincipalId, schoolId,
        "Élève en risque critique",
        conseilEnseignant ?? `${nomComplet} (${className ?? "votre classe"}) — indice de santé scolaire : ${healthScore}/100. Suivi rapproché recommandé.`,
      );
    }

    const censeurs = await prisma.staffProfile.findMany({
      where: { schoolId, permissions: { some: { permission: "VALIDATE_GRADES" } } },
      select: { userId: true },
    }).catch(() => []);
    for (const c of censeurs) {
      await notifierPersonnelDirect(
        c.userId, schoolId,
        "Élève en risque critique",
        `${nomComplet} (${className ?? "N/A"}) — indice de santé scolaire : ${healthScore}/100.`,
      );
    }

    void suggererOrientationSiRisquePersistant(studentId, schoolId, nomComplet, className);

    return { notified: true };
  },
);

export const handleWarningHealthAlert = inngest.createFunction(
  { id: "handle-warning-health-alert", name: "Alerte élève — vigilance", triggers: [{ event: "ai/alert.warning" }] },
  async ({ event }) => {
    const { studentId, schoolId, healthScore } = event.data as { studentId: string; schoolId: string; healthScore: number };
    const { nomComplet, className, professorPrincipalId } = await resolveStudentContext(studentId, schoolId);
    const contexte = `Indice de santé scolaire à surveiller (${healthScore}/100), dans la classe ${className ?? "N/A"}. Des signes méritent une attention particulière avant que la situation ne se dégrade.`;

    const conseilParent = await genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "PARENT", contextType: "HEALTH_WARNING", destinataire: "PARENT",
    });
    await notifierParentsPushDabord({
      schoolId,
      studentId,
      type: "STUDENT_RISK_ALERT",
      titre: "Vigilance recommandée",
      corps: conseilParent ?? `${nomComplet} (${className ?? "sa classe"}) montre des signes à surveiller (indice de santé scolaire : ${healthScore}/100).`,
    }).catch((err) => console.error("[HealthAlert] parent avertissement:", err?.message));

    void genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "STUDENT", contextType: "HEALTH_WARNING", destinataire: "ELEVE",
    });

    if (professorPrincipalId) {
      const conseilEnseignant = await genererEtPersisterConseil({
        schoolId, studentId, nomEleve: nomComplet, contexte,
        recipientRole: "TEACHER", contextType: "HEALTH_WARNING", destinataire: "ENSEIGNANT",
      });
      await notifierPersonnelDirect(
        professorPrincipalId, schoolId,
        "Élève à surveiller",
        conseilEnseignant ?? `${nomComplet} (${className ?? "votre classe"}) — indice de santé scolaire : ${healthScore}/100.`,
      );
    }

    return { notified: true };
  },
);

export const handlePositiveHealthAlert = inngest.createFunction(
  { id: "handle-positive-health-alert", name: "Alerte élève — progression positive", triggers: [{ event: "ai/alert.positive" }] },
  async ({ event }) => {
    const { studentId, schoolId, healthScore } = event.data as { studentId: string; schoolId: string; healthScore: number };
    const { nomComplet, className } = await resolveStudentContext(studentId, schoolId);
    const contexte = `Nette amélioration récente de l'indice de santé scolaire (désormais ${healthScore}/100), dans la classe ${className ?? "N/A"}. Un progrès à valoriser et à encourager.`;

    // Pas de canal fiable vers l'élève lui-même aujourd'hui (voir note ci-dessus) — le parent
    // reste le destinataire pertinent pour valoriser une progression, pas seulement les alertes.
    const conseilParent = await genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "PARENT", contextType: "HEALTH_POSITIVE", destinataire: "PARENT",
    });
    await notifierParentsPushDabord({
      schoolId,
      studentId,
      type: "STUDENT_RISK_ALERT",
      titre: "Belle progression 🎉",
      corps: conseilParent ?? `${nomComplet} (${className ?? "sa classe"}) montre une nette amélioration récente (indice de santé scolaire : ${healthScore}/100). Continuez à l'encourager !`,
    }).catch((err) => console.error("[HealthAlert] parent positif:", err?.message));

    void genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "STUDENT", contextType: "HEALTH_POSITIVE", destinataire: "ELEVE",
    });

    return { notified: true };
  },
);

/**
 * Phase 3 — détection de chute par matière, déclenchée en temps réel à la validation d'une
 * séquence (pas seulement au calcul nocturne global) : compare la moyenne de la séquence qui
 * vient d'être validée à la moyenne de la séquence précédente, POUR LA MÊME MATIÈRE — le job
 * nocturne (Phase 1) ne regarde que la moyenne générale, jamais matière par matière.
 */
export async function trouverSequencePrecedente(sequenceId: string, schoolId: string) {
  const courante = await prisma.academicSequence.findUnique({
    where: { id: sequenceId },
    select: { orderIndex: true, academicPeriod: { select: { orderIndex: true, academicYearId: true } } },
  });
  if (!courante) return null;

  const toutes = await prisma.academicSequence.findMany({
    where: { schoolId, academicPeriod: { academicYearId: courante.academicPeriod.academicYearId } },
    select: { id: true, orderIndex: true, academicPeriod: { select: { orderIndex: true } } },
  });
  const triees = toutes.sort((a, b) =>
    a.academicPeriod.orderIndex - b.academicPeriod.orderIndex || a.orderIndex - b.orderIndex
  );
  const idx = triees.findIndex((s) => s.id === sequenceId);
  return idx > 0 ? triees[idx - 1]! : null;
}

export const handleGradeValidatedDropDetection = inngest.createFunction(
  { id: "handle-grade-validated-drop-detection", name: "Détection chute par matière", triggers: [{ event: "grade/validated" }] },
  async ({ event }) => {
    const { studentId, subjectId, schoolId, sequenceId } = event.data as {
      gradeId: string; studentId: string; subjectId: string; schoolId: string; sequenceId: string;
    };

    const noteActuelle = await prisma.grade.findFirst({
      where: { studentId, subjectId, sequenceId, schoolId, validationStatus: { in: ["VALIDATED", "LOCKED"] } },
      select: { sequenceAverage: true },
    });
    if (noteActuelle?.sequenceAverage == null) return { skipped: "no-average" };

    const precedente = await trouverSequencePrecedente(sequenceId, schoolId);
    if (!precedente) return { skipped: "no-previous-sequence" };

    const noteAvant = await prisma.grade.findFirst({
      where: { studentId, subjectId, schoolId, sequenceId: precedente.id, validationStatus: { in: ["VALIDATED", "LOCKED"] } },
      select: { sequenceAverage: true },
    });
    if (noteAvant?.sequenceAverage == null) return { skipped: "no-previous-grade" };

    const config = await (prisma as any).schoolConfig
      .findFirst({ where: { schoolId }, select: { subjectDropThreshold: true, aiAlertsEnabled: true } })
      .catch(() => null);
    if (config?.aiAlertsEnabled === false) return { skipped: "alerts-disabled" };
    const seuil = config?.subjectDropThreshold ?? 3;

    const chute = noteAvant.sequenceAverage - noteActuelle.sequenceAverage;
    if (chute < seuil) return { skipped: "no-significant-drop" };

    const [contexte, subject] = await Promise.all([
      resolveStudentContext(studentId, schoolId),
      prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } }),
    ]);
    const matiere = subject?.name ?? "une matière";
    const corpsGenerique = `${contexte.nomComplet} (${contexte.className ?? "N/A"}) a chuté de ${chute.toFixed(1)} points en ${matiere} (${noteAvant.sequenceAverage.toFixed(1)} → ${noteActuelle.sequenceAverage.toFixed(1)}/20) entre les deux dernières séquences.`;
    const conseilEnseignant = await genererEtPersisterConseil({
      schoolId, studentId, subjectId, nomEleve: contexte.nomComplet,
      contexte: corpsGenerique,
      recipientRole: "TEACHER", contextType: "SUBJECT_DROP", destinataire: "ENSEIGNANT",
    });
    const corps = conseilEnseignant ?? corpsGenerique;

    // Enseignant de la matière POUR CETTE CLASSE précisément (un même enseignant peut avoir
    // plusieurs classes, une même matière peut avoir plusieurs enseignants selon la classe).
    if (contexte.classId) {
      const assignment = await prisma.teachingAssignment.findUnique({
        where: { classId_subjectId: { classId: contexte.classId, subjectId } },
        select: { teacherId: true },
      }).catch(() => null);
      if (assignment?.teacherId) {
        await notifierPersonnelDirect(assignment.teacherId, schoolId, `Chute en ${matiere}`, corps);
      }
    }

    // Professeur Principal — vue d'ensemble de l'élève, pas seulement de la matière concernée.
    if (contexte.professorPrincipalId) {
      await notifierPersonnelDirect(contexte.professorPrincipalId, schoolId, `Chute en ${matiere}`, corps);
    }

    return { notified: true, chute };
  },
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
          },
          school: { select: { name: true } },
          feePlan: { select: { name: true } },
        },
      });

      let processed = 0;

      for (const invoice of overdueInvoices) {
        if (!invoice.dueDate) continue;

        const parentRecipients = invoice.student?.studentProfile?.parents
          .map((p) => p.parentProfile?.user ? { email: p.parentProfile.user.email, userId: p.parentProfile.user.id } : null)
          .filter((r): r is { email: string; userId: string } => Boolean(r?.email)) ?? [];

        if (!invoice.student?.email && parentRecipients.length === 0) continue;

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

        const allRecipients = [
          ...(invoice.student?.email ? [{ email: invoice.student.email, userId: invoice.student.id }] : []),
          ...parentRecipients,
        ];
        const seenEmails = new Set<string>();
        const dedupedRecipients = allRecipients.filter((r) => (seenEmails.has(r.email) ? false : (seenEmails.add(r.email), true)));

        for (const recipient of dedupedRecipients) {
          try {
            await sendTransactionalEmail({
              recipientEmail: recipient.email,
              recipientUserId: recipient.userId,
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

        // SMS supplémentaire pour les factures vraiment en retard — push d'abord, SMS
        // seulement pour les parents que le push n'atteint pas (voir PushFirstNotifier.ts).
        if (isOverdue && invoice.studentId) {
          const studentName = `${invoice.student?.firstName ?? ''} ${invoice.student?.lastName ?? ''}`.trim();
          const daysOverdue = Math.abs(daysUntilDue);
          void notifierParentsPushDabord({
            schoolId: invoice.schoolId,
            studentId: invoice.studentId,
            type: "PAYMENT_REMINDER",
            titre: "Facture en retard",
            corps: `Facture "${label}" de ${invoice.amount} XAF pour ${studentName} en retard de ${daysOverdue} jour(s).`,
          }).then(({ phonesSansPush }) =>
            notifyOverdueInvoiceSms({
              schoolId: invoice.schoolId,
              studentId: invoice.studentId!,
              studentName,
              amount: invoice.amount,
              daysOverdue,
              invoiceLabel: label,
              phones: phonesSansPush,
            }),
          );
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
          include: { user: { select: { id: true, email: true, firstName: true } } },
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
                recipientUserId: s.user.id,
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
    const toMark = await step.run("find-overdue-loans", async () => {
      return prisma.bookLoan.findMany({
        where: { status: "ACTIVE", dueDate: { lt: new Date() } },
        select: {
          id: true, schoolId: true, studentId: true,
          book: { select: { title: true } },
          student: { select: { firstName: true, lastName: true } },
        },
      });
    });

    if (toMark.length === 0) return { updated: 0 };

    await step.run("update-overdue-loans", async () => {
      await prisma.bookLoan.updateMany({
        where: { id: { in: toMark.map((l) => l.id) } },
        data: { status: "OVERDUE" },
      });
    });

    await step.run("notify-overdue-loans", async () => {
      const notificationService = new SocketNotificationService();

      for (const loan of toMark) {
        const studentName = `${loan.student.firstName} ${loan.student.lastName}`.trim();
        const titre = "Livre en retard";
        const corps = `Le livre "${loan.book.title}" est en retard de retour à la bibliothèque.`;

        // Élève : a forcément un compte — cloche (toujours visible) + push best-effort (rien
        // d'autre à tenter côté élève, voir discussion PLAN_NOTIFICATIONS_PUSH.md : les élèves
        // n'ont généralement pas de numéro/email propre au Cameroun, donc pas de repli SMS ici).
        // Un seul appel canal='PUSH' suffit désormais : il persiste la cloche ET tente le push.
        await notificationService
          .envoyer({ schoolId: loan.schoolId, userId: loan.studentId, type: "LIBRARY_OVERDUE", titre, corps, canal: "PUSH" })
          .catch((err) => console.error('[Library Overdue élève]', err?.message));

        // Parents : cloche systématique + push d'abord ; le SMS ne part QUE vers les parents
        // dont le push n'a atteint aucun appareil (pas de souscription active) — jamais les
        // deux à la fois pour un même parent, cohérent avec le repli déjà en place pour l'email
        // (sendTransactionalEmail, Phase B) mais appliqué ici au SMS (voir PushFirstNotifier.ts,
        // partagé avec les alertes absence/paiement/discipline).
        const { phonesSansPush } = await notifierParentsPushDabord({
          schoolId: loan.schoolId, studentId: loan.studentId, type: "LIBRARY_OVERDUE", titre, corps,
        });

        if (phonesSansPush.length > 0) {
          await notifyOverdueBookSms({
            schoolId: loan.schoolId,
            studentId: loan.studentId,
            studentName,
            bookTitle: loan.book.title,
            phones: phonesSansPush,
          }).catch((err) => console.error('[Library Overdue SMS]', err?.message));
        }
      }
    });

    return { updated: toMark.length };
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
          recipientUserId: censeur.user.id,
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
          recipientUserId: admin.id,
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

/**
 * Moteur du système événementiel lié au calendrier académique — un passage quotidien qui gère
 * les trois catégories d'événements (voir Plan_Evenements_Calendrier_ZekoulABia.md) :
 *  - FIXED_DATE : active automatiquement les événements dont l'ouverture programmée est
 *    arrivée, et notifie les rôles cibles.
 *  - MANUAL_TRIGGER : jamais touché ici — reste UPCOMING jusqu'à un déclenchement humain
 *    explicite (DeclencherEvenementUseCase).
 *  - SLIDING_WINDOW : prolonge automatiquement la clôture d'un jour si elle tombe sur un jour
 *    de fermeture scolaire, pour ne jamais réduire silencieusement le temps réellement utile
 *    laissé aux familles.
 * Tous types confondus : rappel une seule fois (reminderSentAt) à 3 jours ouvrés scolaires de
 * la clôture, puis clôture automatique une fois la date de fin dépassée.
 */
export const checkAcademicEvents = inngest.createFunction(
  { id: "check-academic-events", name: "Vérification quotidienne des événements académiques", triggers: [{ cron: "0 6 * * *" }] },
  async ({ step }) => {
    await step.run("process-academic-events", async () => {
      const schools = await prisma.school.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
      const maintenant = new Date();

      for (const school of schools) {
        const aOuvrir = await (prisma as any).academicEvent.findMany({
          where: { schoolId: school.id, status: "UPCOMING", category: "FIXED_DATE", openDate: { lte: maintenant } },
        });
        for (const ev of aOuvrir) {
          // La ressource réelle doit s'ouvrir AVANT que l'événement ne passe ACTIVE — si ça
          // échoue, l'événement reste UPCOMING (retenté au prochain passage) plutôt que
          // d'afficher un menu pour une fonctionnalité qui n'est pas vraiment ouverte.
          let linkedResourceId: string | null = null;
          try {
            linkedResourceId = await activerRessourceLieeSiApplicable(prisma, ev);
          } catch (err: any) {
            console.error(`[AcademicEvent] activation ressource liée (${ev.id}):`, err?.message);
            continue;
          }
          await (prisma as any).academicEvent.update({ where: { id: ev.id }, data: { status: "ACTIVE", linkedResourceId } });
          await notifierEvenementAcademique(
            prisma, school.id, ev.targetRoles, ev.title,
            ev.description ?? `« ${ev.title} » est désormais ouvert.`,
          ).catch((err) => console.error("[AcademicEvent] notification ouverture:", err?.message));
        }

        const actifsAvecCloture = await (prisma as any).academicEvent.findMany({
          where: { schoolId: school.id, status: "ACTIVE", closeDate: { not: null }, reminderSentAt: null },
        });
        for (const ev of actifsAvecCloture) {
          if (!ev.closeDate) continue;
          const seuilRappel = await ajouterJoursOuvresScolaires(prisma, school.id, maintenant, 3);
          if (seuilRappel >= ev.closeDate) {
            await notifierEvenementAcademique(
              prisma, school.id, ev.targetRoles, `Rappel — ${ev.title}`,
              `« ${ev.title} » se clôture le ${new Date(ev.closeDate).toLocaleDateString("fr-FR")}. Pensez à agir avant cette date.`,
            ).catch((err) => console.error("[AcademicEvent] notification rappel:", err?.message));
            await (prisma as any).academicEvent.update({ where: { id: ev.id }, data: { reminderSentAt: maintenant } });
          }
        }

        // Prolongation Type 3 : vérifiée chaque jour tant que la fenêtre est ouverte (closeDate
        // encore dans le futur), pas seulement le jour où closeDate coïncide avec une fermeture
        // — une coupure de plusieurs semaines en plein milieu de la fenêtre (ex. vacances de
        // Noël pendant le choix LV2) est ainsi compensée jour après jour, pas seulement le cas
        // limite où la clôture tombe par hasard un jour fermé.
        const fenetresGlissantes = await (prisma as any).academicEvent.findMany({
          where: { schoolId: school.id, status: "ACTIVE", category: "SLIDING_WINDOW", closeDate: { not: null, gt: maintenant } },
        });
        for (const ev of fenetresGlissantes) {
          if (!ev.closeDate) continue;
          const nouvelleCloture = await prolongerSiFermetureAujourdhui(prisma, school.id, ev.closeDate, maintenant);
          if (nouvelleCloture) {
            await (prisma as any).academicEvent.update({ where: { id: ev.id }, data: { closeDate: nouvelleCloture } });
            await synchroniserClotureRessourceLiee(prisma, ev.type, ev.linkedResourceId, nouvelleCloture);
          }
        }

        // Clôture — on récupère les événements concernés AVANT le updateMany pour pouvoir
        // clôturer leur ressource liée individuellement (ex. Lv2ChoiceWindow), ce
        // qu'un updateMany en masse ne permet pas de faire ligne par ligne.
        const aCloturer = await (prisma as any).academicEvent.findMany({
          where: { schoolId: school.id, status: "ACTIVE", closeDate: { lte: maintenant } },
          select: { id: true, type: true, linkedResourceId: true },
        });
        for (const ev of aCloturer) {
          await cloturerRessourceLiee(prisma, ev.type, ev.linkedResourceId);
        }
        await (prisma as any).academicEvent.updateMany({
          where: { id: { in: aCloturer.map((e: any) => e.id) } },
          data: { status: "CLOSED" },
        });
      }
    });
    return { checked: true };
  },
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