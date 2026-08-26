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

const PURGE_GRACE_PERIOD_DAYS = parseInt(process.env.PURGE_GRACE_PERIOD_DAYS || "30", 10);

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

export const purgeAnnoncesExpirees = inngest.createFunction(
  { id: "purge-annonces-expirees", name: "Purge quotidienne babillard", triggers: [{ cron: "0 1 * * *" }] },
  async ({ step }) => {
    return await step.run("purge-annonces-expirees", async () => {
      const useCase = new PurgerAnnoncesExpireesUseCase(
        new PrismaAnnouncementRepository(prisma),
      );
      return await useCase.execute();
    });
  }
);

export const purgerCorbeille = inngest.createFunction(
  { id: "purge-corbeille", name: "Purge planifiée de la corbeille (Couche 1)", triggers: [{ cron: "0 4 * * *" }] },
  async ({ step }) => {
    const cutoff = new Date(Date.now() - PURGE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    await step.run("purge-users-vers-archive", async () => {
      const users = await prisma.user.findMany({
        where: { deletedAt: { not: null, lt: cutoff } },
        select: {
          id: true, schoolId: true, role: true, firstName: true, lastName: true,
          email: true, phone: true, deletedAt: true, deletedById: true,
        },
      });

      for (const u of users) {
        try {
          const [
            studentProfile, parentProfile, teacherProfile, staffProfile,
            grades, attendances, reportCards,
            parentLinksAsStudent, parentLinksAsParent, teacherSubjects, staffPermissions,
          ] = await Promise.all([
            prisma.studentProfile.findUnique({ where: { userId: u.id } }),
            prisma.parentProfile.findUnique({ where: { userId: u.id } }),
            prisma.teacherProfile.findUnique({ where: { userId: u.id } }),
            prisma.staffProfile.findUnique({ where: { userId: u.id }, include: { permissions: true } }),
            prisma.grade.findMany({ where: { studentId: u.id } }),
            prisma.attendance.findMany({ where: { studentId: u.id } }),
            prisma.reportCard.findMany({ where: { studentId: u.id } }),
            prisma.parentStudent.findMany({ where: { studentProfile: { userId: u.id } } }),
            prisma.parentStudent.findMany({ where: { parentProfile: { userId: u.id } } }),
            prisma.teacherSubject.findMany({ where: { teacherProfile: { userId: u.id } } }),
            prisma.staffPermission.findMany({ where: { staffProfile: { userId: u.id } } }),
          ]);

          const snapshot = JSON.parse(JSON.stringify({
            user: u, studentProfile, parentProfile, teacherProfile, staffProfile,
            grades, attendances, reportCards,
            parentLinksAsStudent, parentLinksAsParent, teacherSubjects, staffPermissions,
          }));

          await prisma.userArchive.create({
            data: {
              originalUserId: u.id, schoolId: u.schoolId, role: u.role,
              firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone,
              deletedAt: u.deletedAt!, deletedById: u.deletedById, snapshot,
            },
          });

          await prisma.$transaction([
            prisma.attendance.deleteMany({ where: { studentId: u.id } }),
            prisma.grade.deleteMany({ where: { studentId: u.id } }),
            prisma.reportCard.deleteMany({ where: { studentId: u.id } }),
            prisma.parentStudent.deleteMany({
              where: { OR: [{ studentProfile: { userId: u.id } }, { parentProfile: { userId: u.id } }] },
            }),
            prisma.teacherSubject.deleteMany({ where: { teacherProfile: { userId: u.id } } }),
            prisma.staffPermission.deleteMany({ where: { staffProfile: { userId: u.id } } }),
            prisma.user.delete({ where: { id: u.id } }),
          ]);
        } catch (err: any) {
          console.error(`[PurgeCorbeille] utilisateur ${u.id}:`, err?.message);
        }
      }
    });

    await step.run("purge-classes", async () => {
      const classes = await prisma.class.findMany({
        where: { deletedAt: { not: null, lt: cutoff } },
        select: { id: true, schoolId: true },
      });
      for (const c of classes) {
        try {
          await prisma.$transaction(async (tx) => {
            await tx.attendance.deleteMany({ where: { schoolId: c.schoolId, classId: c.id } });
            await tx.grade.deleteMany({ where: { schoolId: c.schoolId, classId: c.id } });
            await tx.classCouncilSession.deleteMany({ where: { schoolId: c.schoolId, classId: c.id } });
            await tx.timetable.deleteMany({ where: { schoolId: c.schoolId, classId: c.id } });
            await tx.classPromotion.deleteMany({ where: { schoolId: c.schoolId, OR: [{ fromClassId: c.id }, { toClassId: c.id }] } });
            await tx.studentPromotion.deleteMany({ where: { schoolId: c.schoolId, OR: [{ fromClassId: c.id }, { toClassId: c.id }] } });
            await tx.enrollment.updateMany({
              where: { classId: c.id, schoolId: c.schoolId },
              data: { status: 'TRANSFERRED', exitedAt: new Date(), exitReason: 'PURGE_CLASSE' },
            });
            await tx.class.delete({ where: { id: c.id } });
          });
        } catch (err: any) {
          console.error(`[PurgeCorbeille] classe ${c.id}:`, err?.message);
        }
      }
    });

    await step.run("purge-subjects", async () => {
      const subjects = await prisma.subject.findMany({
        where: { deletedAt: { not: null, lt: cutoff } },
        select: { id: true },
      });
      for (const s of subjects) {
        try {
          await prisma.$transaction([
            prisma.classSubjectOverride.deleteMany({ where: { subjectId: s.id } }),
            prisma.subjectCoefficient.deleteMany({ where: { subjectId: s.id } }),
            prisma.teacherSubject.deleteMany({ where: { subjectId: s.id } }),
            prisma.teachingAssignment.deleteMany({ where: { subjectId: s.id } }),
            prisma.timetableSlot.deleteMany({ where: { subjectId: s.id } }),
            prisma.exam.deleteMany({ where: { subjectId: s.id } }),
            prisma.grade.deleteMany({ where: { subjectId: s.id } }),
            prisma.reportCardSubjectLine.deleteMany({ where: { subjectId: s.id } }),
            prisma.attendance.updateMany({ where: { subjectId: s.id }, data: { subjectId: null } }),
            prisma.subject.delete({ where: { id: s.id } }),
          ]);
        } catch (err: any) {
          console.error(`[PurgeCorbeille] matière ${s.id}:`, err?.message);
        }
      }
    });

    return { purged: true };
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
