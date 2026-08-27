import { inngest } from "../client/index.ts";
import { prisma } from "../../../config/prisma.ts";
import { sendTransactionalEmail } from '../../services/email/EmailService.ts';
import { SocketNotificationService } from '../../services/notification/SocketNotificationService.ts';
import { PrismaSanteEleveRepository } from "../../persistence/prisma/PrismaSanteEleveRepository";
import { CalculerIndiceSanteUseCase } from "@application/ai/CalculerIndiceSanteUseCase";
import { GroqIAService } from '../../services/ai/GroqIAService.ts';
import { ajouterJoursOuvresScolaires, prolongerSiFermetureAujourdhui } from "../../services/school-calendar/SchoolCalendarService";
import { notifierEvenementAcademique } from "../../services/notification/AcademicEventNotificationService";
import { SmsNotificationAdapter } from '../../services/sms/SmsNotificationAdapter';
import { PrismaOrientationRepository } from "../../persistence/prisma/PrismaOrientationRepository";
import { PrismaGradeOrientationRepository } from "../../persistence/prisma/PrismaGradeOrientationRepository";
import { PrismaLv2ChoiceRepository } from "../../persistence/prisma/PrismaLv2ChoiceRepository";
import { PrismaAnneeAcademiqueRepository } from "../../persistence/prisma/PrismaAnneeAcademiqueRepository";
import { PrismaAcademicEventRepository } from "../../persistence/prisma/PrismaAcademicEventRepository";
import { PrismaSchoolRepository } from "../../persistence/prisma/PrismaSchoolRepository";
import { PrismaStaffProfileRepository } from "../../persistence/prisma/PrismaStaffProfileRepository";
import { PrismaUserRepository } from "../../persistence/prisma/PrismaUserRepository";
import { PrismaExamRepository } from "../../persistence/prisma/PrismaExamRepository";
import { VerifierEvenementsAcademiquesUseCase } from "@application/academicEvent/VerifierEvenementsAcademiquesUseCase";
import { VerifierOrientationCheckpointsUseCase } from "@application/orientation/VerifierOrientationCheckpointsUseCase";
import { DetecterPatternSuspicieuxUseCase } from "@application/ai/DetecterPatternSuspicieuxUseCase";
import { PrismaAIActionAuditQueryAdapter } from "../../persistence/prisma/PrismaAIActionAuditQueryAdapter";

const lv2ChoiceRepository = new PrismaLv2ChoiceRepository(prisma);
const anneeRepository = new PrismaAnneeAcademiqueRepository(prisma);

const iaService = new GroqIAService();
const calculerIndiceSanteUseCase = new CalculerIndiceSanteUseCase(
  new PrismaSanteEleveRepository(prisma),
  iaService,
);

async function notifierPersonnelDirect(userId: string, schoolId: string, titre: string, corps: string) {
  const socketService = new SocketNotificationService();
  await socketService
    .envoyer({ schoolId, userId, type: "STUDENT_RISK_ALERT", titre, corps, canal: "IN_APP" })
    .catch((err) => console.error("[HealthAlert] IN_APP personnel:", err?.message));
  const { notifierUtilisateurPush } = await import('../../services/notification/PushNotificationService.ts');
  await notifierUtilisateurPush({ userId, title: titre, body: corps }).catch(() => {});
}

const FENETRE_ALERTE_MS = 10 * 60 * 1000;
const SEUIL_REFUS = 3;

export const checkAcademicEvents = inngest.createFunction(
  { id: "check-academic-events", name: "Vérification quotidienne des événements académiques", triggers: [{ cron: "0 6 * * *" }] },
  async ({ event, step }) => {
    await step.run("process-academic-events", async () => {
      const schoolCalendarPort = {
        ajouterJoursOuvresScolaires: (schoolId: string, date: Date, jours: number) => ajouterJoursOuvresScolaires(prisma, schoolId, date, jours),
        prolongerSiFermetureAujourdhui: (schoolId: string, closeDate: Date, aujourd: Date) => prolongerSiFermetureAujourdhui(prisma, schoolId, closeDate, aujourd),
      };
      const notificationPort = {
        notifierEvenementAcademique: (schoolId: string, targetRoles: string[], titre: string, corps: string) =>
          notifierEvenementAcademique(prisma, schoolId, targetRoles, titre, corps),
      };
      const useCase = new VerifierEvenementsAcademiquesUseCase({
        academicEventRepository: new PrismaAcademicEventRepository(prisma),
        schoolRepository: new PrismaSchoolRepository(prisma),
        lv2ChoiceRepository,
        anneeRepository,
        schoolCalendarPort,
        notificationPort,
        smsPort: new SmsNotificationAdapter(),
      });
      const schoolId = (event as any)?.data?.schoolId as string | undefined;
      return useCase.execute(schoolId ? { schoolId } : undefined);
    });
    return { checked: true };
  },
);

export const checkOrientationCheckpoints = inngest.createFunction(
  { id: "check-orientation-checkpoints", name: "Vérification quotidienne des checkpoints d'orientation", triggers: [{ cron: "0 7 * * *" }] },
  async ({ event, step }) => {
    await step.run("process-orientation-checkpoints", async () => {
      const personnelNotificationPort = {
        notifierPersonnel: (userId: string, schoolId: string, titre: string, corps: string) =>
          notifierPersonnelDirect(userId, schoolId, titre, corps),
      };
      const useCase = new VerifierOrientationCheckpointsUseCase({
        schoolRepository: new PrismaSchoolRepository(prisma),
        orientationRepository: new PrismaOrientationRepository(prisma),
        gradeOrientationRepository: new PrismaGradeOrientationRepository(prisma),
        anneeRepository: new PrismaAnneeAcademiqueRepository(prisma),
        staffProfileRepository: new PrismaStaffProfileRepository(prisma),
        userRepository: new PrismaUserRepository(prisma),
        personnelNotificationPort,
      });
      const schoolId = (event as any)?.data?.schoolId as string | undefined;
      return useCase.execute(schoolId ? { schoolId } : undefined);
    });
    return { checked: true };
  },
);

export const checkSuspiciousAiActionPattern = inngest.createFunction(
  { id: "check-suspicious-ai-action-pattern", name: "Détection de refus répétés — sécurité assistant IA", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    await step.run("detect-and-alert", async () => {
      const adapter = new PrismaAIActionAuditQueryAdapter(prisma);
      const useCase = new DetecterPatternSuspicieuxUseCase(adapter);
      await useCase.execute({});
    });
    return { checked: true };
  },
);

export const handleTimetableSeancesAppliquees = inngest.createFunction(
  { id: "Handle-Timetable-Seances-Appliquees", triggers: [{ event: "timetable/seances.appliquees" }] },
  async ({ event, step }) => {
    const { schoolId, timetableId, seances } = event.data as {
      schoolId: string;
      timetableId: string;
      nbSeances: number;
      seances: { subjectId: string }[];
    };

    // AssessmentScheduled : matières liées à un examen à venir (filtré par schoolId + date).
    await step.run("check-upcoming-exams", async () => {
      const subjectIds = [...new Set((seances ?? []).map(s => s.subjectId))];
      if (subjectIds.length === 0) return;
      const examRepository = new PrismaExamRepository(prisma);
      const exams = await examRepository.findUpcomingBySubjects(schoolId, subjectIds);
      for (const exam of exams) {
        await inngest.send({
          name: "assessment/scheduled",
          data: { schoolId, examId: exam.id, classId: exam.classId, subjectId: exam.subjectId, timetableId },
        });
      }
    });

    // Notification admin (isolée par schoolId).
    await step.run("notify-admins", async () => {
      const userRepository = new PrismaUserRepository(prisma);
      const admins = await userRepository.findByRole(schoolId, "ADMIN" as any);
      const actifs = (admins as any[]).filter((u: any) => u.isActive !== false);
      const cibles = actifs.length > 0 ? actifs : admins;
      const notificationService = new SocketNotificationService();
      for (const admin of cibles as any[]) {
        await notificationService
          .envoyer({
            schoolId,
            userId: (admin as any).id,
            type: "SYSTEM" as any,
            titre: "Emploi du temps appliqué",
            corps: `${(seances ?? []).length} séance(s) appliquée(s).`,
            canal: "IN_APP" as any,
          })
          .catch(() => {});
      }
    });

    return { timetableId, nbSeances: (seances ?? []).length };
  }
);
