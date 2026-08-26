import { inngest } from "../client/index.ts";
import { prisma } from "../../../config/prisma.ts";
import { sendTransactionalEmail } from '../../services/email/EmailService.ts';
import { resolveLanguage } from "../../../domain/policies/LanguagePolicy.ts";
import { getEffectiveSchoolSettings } from "../../services/school-settings/SchoolSettingsService.ts";
import { createSchoolBackup, purgeSchoolLogsByRetention } from "../../backup/SchoolBackupService.ts";
import { notifyOverdueInvoiceSms, notifyAbsenceThresholdSms, notifyOverdueBookSms } from '../../services/sms/SmsNotificationService.ts';
import { SocketNotificationService } from '../../services/notification/SocketNotificationService.ts';
import { notifierParentsPushDabord } from '../../services/notification/PushFirstNotifier.ts';
import { PrismaSanteEleveRepository } from "../../persistence/prisma/PrismaSanteEleveRepository";
import { CalculerIndiceSanteUseCase } from "@application/ai/CalculerIndiceSanteUseCase";
import { GroqIAService } from '../../services/ai/GroqIAService.ts';
import { estJourOuvreScolaire, ajouterJoursOuvresScolaires, prolongerSiFermetureAujourdhui } from "../../services/school-calendar/SchoolCalendarService";
import { notifierEvenementAcademique } from "../../services/notification/AcademicEventNotificationService";
import { activerRessourceLieeSiApplicable, synchroniserClotureRessourceLiee, cloturerRessourceLiee } from "@application/academicEvent";
import { SmsNotificationAdapter } from '../../services/sms/SmsNotificationAdapter';
import { PrismaOrientationRepository } from "../../persistence/prisma/PrismaOrientationRepository";
import { PrismaGradeOrientationRepository } from "../../persistence/prisma/PrismaGradeOrientationRepository";
import { PrismaAnnouncementRepository } from "../../persistence/prisma/PrismaAnnouncementRepository";
import { PrismaLv2ChoiceRepository } from "../../persistence/prisma/PrismaLv2ChoiceRepository";
import { PrismaAnneeAcademiqueRepository } from "../../persistence/prisma/PrismaAnneeAcademiqueRepository";
import { GenererRecommandationOrientationUseCase } from "@application/orientation/GenererRecommandationOrientationUseCase";
import { RelancerElevesEnAttenteUseCase } from "@application/orientation/RelancerElevesEnAttenteUseCase";
import { FinaliserParDefautUseCase } from "@application/orientation/FinaliserParDefautUseCase";
import { ListerElevesAOrienterUseCase } from "@application/orientation/ListerElevesAOrienterUseCase";
import { PurgerAnnoncesExpireesUseCase } from "@application/announcement/PurgerAnnoncesExpireesUseCase";
import { whereElevesParClasse } from "@application/shared/studentEnrollment";
import { NonRetriableError } from "inngest";

const lv2ChoiceRepository = new PrismaLv2ChoiceRepository(prisma);
const anneeRepository = new PrismaAnneeAcademiqueRepository(prisma);

const iaService = new GroqIAService();
const calculerIndiceSanteUseCase = new CalculerIndiceSanteUseCase(
  new PrismaSanteEleveRepository(prisma),
  iaService,
);

async function resolveStudentContext(studentId: string, schoolId: string) {
  const profile = await prisma.studentProfile.findFirst({
    where: { userId: studentId, user: { schoolId } },
    select: {
      user: { select: { firstName: true, lastName: true } },
      enrollmentsYearScoped: {
        where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
        take: 1,
        select: { classId: true, class: { select: { name: true, professorPrincipalId: true } } },
      },
    },
  });
  return {
    nomComplet: profile ? `${profile.user.firstName} ${profile.user.lastName}` : "Élève",
    classId: profile?.enrollmentsYearScoped[0]?.classId ?? null,
    className: profile?.enrollmentsYearScoped[0]?.class?.name ?? null,
    professorPrincipalId: profile?.enrollmentsYearScoped[0]?.class?.professorPrincipalId ?? null,
  };
}

async function notifierPersonnelDirect(userId: string, schoolId: string, titre: string, corps: string) {
  const socketService = new SocketNotificationService();
  await socketService
    .envoyer({ schoolId, userId, type: "STUDENT_RISK_ALERT", titre, corps, canal: "IN_APP" })
    .catch((err) => console.error("[HealthAlert] IN_APP personnel:", err?.message));
  const { notifierUtilisateurPush } = await import('../../services/notification/PushNotificationService.ts');
  await notifierUtilisateurPush({ userId, title: titre, body: corps }).catch(() => {});
}

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

async function detecterChutePourNote(data: {
  studentId: string; subjectId: string; schoolId: string; sequenceId: string;
}): Promise<{
  studentId: string; subjectId: string; teacherId: string | null;
  nomComplet: string; className: string | null; matiere: string;
  avant: number; apres: number; corpsIndividuel: string;
} | null> {
  const noteActuelle = await prisma.grade.findFirst({
    where: { studentId: data.studentId, subjectId: data.subjectId, sequenceId: data.sequenceId, schoolId: data.schoolId, validationStatus: { in: ["VALIDATED", "LOCKED"] } },
    select: { sequenceAverage: true },
  });
  if (noteActuelle?.sequenceAverage == null) return null;

  const precedente = await trouverSequencePrecedente(data.sequenceId, data.schoolId);
  if (!precedente) return null;

  const noteAvant = await prisma.grade.findFirst({
    where: { studentId: data.studentId, subjectId: data.subjectId, schoolId: data.schoolId, sequenceId: precedente.id, validationStatus: { in: ["VALIDATED", "LOCKED"] } },
    select: { sequenceAverage: true },
  });
  if (noteAvant?.sequenceAverage == null) return null;

  const config = await prisma.schoolConfig
    .findFirst({ where: { schoolId: data.schoolId }, select: { subjectDropThreshold: true, aiAlertsEnabled: true } })
    .catch(() => null);
  if (config?.aiAlertsEnabled === false) return null;
  const seuil = config?.subjectDropThreshold ?? 3;

  const chute = noteAvant.sequenceAverage - noteActuelle.sequenceAverage;
  if (chute < seuil) return null;

  const [contexte, subject] = await Promise.all([
    resolveStudentContext(data.studentId, data.schoolId),
    prisma.subject.findUnique({ where: { id: data.subjectId }, select: { name: true } }),
  ]);
  const matiere = subject?.name ?? "une matière";
  const corpsGenerique = `${contexte.nomComplet} (${contexte.className ?? "N/A"}) a chuté de ${chute.toFixed(1)} points en ${matiere} (${noteAvant.sequenceAverage.toFixed(1)} → ${noteActuelle.sequenceAverage.toFixed(1)}/20) entre les deux dernières séquences.`;
  const conseilEnseignant = await genererEtPersisterConseil({
    schoolId: data.schoolId, studentId: data.studentId, subjectId: data.subjectId, nomEleve: contexte.nomComplet,
    contexte: corpsGenerique,
    recipientRole: "TEACHER", contextType: "SUBJECT_DROP", destinataire: "ENSEIGNANT",
  });

  // Enseignant de la matière POUR CETTE CLASSE précisément (un même enseignant peut avoir
  // plusieurs classes, une même matière peut avoir plusieurs enseignants selon la classe).
  let teacherId: string | null = null;
  if (contexte.classId) {
    const assignment = await prisma.teachingAssignment.findUnique({
      where: { classId_subjectId: { classId: contexte.classId, subjectId: data.subjectId } },
      select: { teacherId: true },
    }).catch(() => null);
    teacherId = assignment?.teacherId ?? null;
  }

  return {
    studentId: data.studentId, subjectId: data.subjectId, teacherId,
    nomComplet: contexte.nomComplet, className: contexte.className, matiere,
    avant: noteAvant.sequenceAverage, apres: noteActuelle.sequenceAverage,
    corpsIndividuel: conseilEnseignant ?? corpsGenerique,
  };
}

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
        ...(classId ? whereElevesParClasse(classId) : {}),
      };
      return prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          studentProfile: {
            select: {
              enrollmentsYearScoped: {
                where: { status: "ACTIVE", academicYear: { isCurrent: true } },
                select: { classId: true },
                take: 1,
              },
            },
          },
        },
      });
    });

    if (!students.length) {
      return { message: "No students found", generated: 0 };
    }

    const generatedStudents: string[] = [];

    await step.run("generate-report-cards", async () => {
      for (const student of students) {
        const studentClassId = student.studentProfile?.enrollmentsYearScoped?.[0]?.classId ?? null;
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
                enrollmentsYearScoped: {
                  where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
                  take: 1,
                  include: { class: { select: { section: { select: { code: true } } } } },
                },
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
        const lang = resolveLanguage(school?.subsystem, student.studentProfile?.enrollmentsYearScoped[0]?.class?.section?.code ?? null);
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

export const handleGradeValidatedDropDetection = inngest.createFunction(
  { id: "handle-grade-validated-drop-detection", name: "Détection chute par matière", triggers: [{ event: "grade/validated" }] },
  async ({ event }) => {
    const { studentId, subjectId, schoolId, sequenceId } = event.data as {
      gradeId: string; studentId: string; subjectId: string; schoolId: string; sequenceId: string;
    };
    const resultat = await detecterChutePourNote({ studentId, subjectId, schoolId, sequenceId });
    if (!resultat) return { skipped: true };
    if (resultat.teacherId) {
      await notifierPersonnelDirect(resultat.teacherId, schoolId, `Chute en ${resultat.matiere}`, resultat.corpsIndividuel);
    }
    return { notified: !!resultat.teacherId };
  },
);

export const handleGradeValidatedBatchDropDetection = inngest.createFunction(
  { id: "handle-grade-validated-batch-drop-detection", name: "Détection chute par matière (validation en bloc)", triggers: [{ event: "grade/validated-batch" }] },
  async ({ event }) => {
    const { schoolId, grades } = event.data as {
      schoolId: string;
      grades: Array<{ studentId: string; subjectId: string; sequenceId: string }>;
    };

    const parEnseignant = new Map<string, string[]>();
    for (const g of grades) {
      const resultat = await detecterChutePourNote({ studentId: g.studentId, subjectId: g.subjectId, schoolId, sequenceId: g.sequenceId }).catch(() => null);
      if (!resultat || !resultat.teacherId) continue;
      const lignes = parEnseignant.get(resultat.teacherId) ?? [];
      lignes.push(`${resultat.nomComplet} (${resultat.className ?? "N/A"}) — ${resultat.matiere} : ${resultat.avant.toFixed(1)} → ${resultat.apres.toFixed(1)}/20`);
      parEnseignant.set(resultat.teacherId, lignes);
    }

    for (const [teacherId, lignes] of parEnseignant) {
      const corps = lignes.length === 1
        ? lignes[0]!
        : `${lignes.length} élèves en chute lors de cette validation :\n${lignes.join("\n")}`;
      await notifierPersonnelDirect(teacherId, schoolId, "Chutes détectées lors de votre validation", corps);
    }

    return { enseignantsNotifies: parEnseignant.size };
  },
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
