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

async function notifierPersonnelDirect(userId: string, schoolId: string, titre: string, corps: string) {
  const socketService = new SocketNotificationService();
  await socketService
    .envoyer({ schoolId, userId, type: "STUDENT_RISK_ALERT", titre, corps, canal: "IN_APP" })
    .catch((err) => console.error("[HealthAlert] IN_APP personnel:", err?.message));
  const { notifierUtilisateurPush } = await import('../../services/notification/PushNotificationService.ts');
  await notifierUtilisateurPush({ userId, title: titre, body: corps }).catch(() => {});
}

function dansLaFenetreOrientation(
  config: { windowStartMonth: number; windowStartDay: number; windowEndMonth: number; windowEndDay: number },
  now: Date,
): boolean {
  const cur = (now.getMonth() + 1) * 100 + now.getDate();
  const start = config.windowStartMonth * 100 + config.windowStartDay;
  const end = config.windowEndMonth * 100 + config.windowEndDay;
  return start <= end ? (cur >= start && cur <= end) : (cur >= start || cur <= end);
}

async function resolverConseillersOrientation(schoolId: string): Promise<string[]> {
  const conseillers = await prisma.staffProfile.findMany({
    where: { schoolId, permissions: { some: { permission: "MANAGE_ORIENTATION" } } },
    select: { userId: true },
  }).catch(() => []);
  if (conseillers.length > 0) return conseillers.map((c: any) => c.userId);
  // Échappatoire explicite (A.2 du plan) : aucun conseiller dédié dans cet établissement →
  // notifier les Admins plutôt que de laisser une recommandation calculée sans destinataire.
  const admins = await prisma.user.findMany({ where: { schoolId, role: "ADMIN" }, select: { id: true } });
  return admins.map((a) => a.id);
}

const FENETRE_ALERTE_MS = 10 * 60 * 1000;
const SEUIL_REFUS = 3;

export const checkAcademicEvents = inngest.createFunction(
  { id: "check-academic-events", name: "Vérification quotidienne des événements académiques", triggers: [{ cron: "0 6 * * *" }] },
  async ({ step }) => {
    await step.run("process-academic-events", async () => {
      const schools = await prisma.school.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
      const maintenant = new Date();

      for (const school of schools) {
        const aOuvrir = await prisma.academicEvent.findMany({
          where: { schoolId: school.id, status: "UPCOMING", category: "FIXED_DATE", openDate: { lte: maintenant } },
        });
        for (const ev of aOuvrir) {
          // La ressource réelle doit s'ouvrir AVANT que l'événement ne passe ACTIVE — si ça
          // échoue, l'événement reste UPCOMING (retenté au prochain passage) plutôt que
          // d'afficher un menu pour une fonctionnalité qui n'est pas vraiment ouverte.
          let linkedResourceId: string | null = null;
          try {
            linkedResourceId = await activerRessourceLieeSiApplicable(lv2ChoiceRepository, anneeRepository, ev, new SmsNotificationAdapter());
          } catch (err: any) {
            console.error(`[AcademicEvent] activation ressource liée (${ev.id}):`, err?.message);
            continue;
          }
          await prisma.academicEvent.update({ where: { id: ev.id }, data: { status: "ACTIVE", linkedResourceId } });
          await notifierEvenementAcademique(
            prisma, school.id, ev.targetRoles, ev.title,
            ev.description ?? `« ${ev.title} » est désormais ouvert.`,
          ).catch((err) => console.error("[AcademicEvent] notification ouverture:", err?.message));
        }

        const actifsAvecCloture = await prisma.academicEvent.findMany({
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
            await prisma.academicEvent.update({ where: { id: ev.id }, data: { reminderSentAt: maintenant } });
          }
        }

        // Prolongation Type 3 : vérifiée chaque jour tant que la fenêtre est ouverte (closeDate
        // encore dans le futur), pas seulement le jour où closeDate coïncide avec une fermeture
        // — une coupure de plusieurs semaines en plein milieu de la fenêtre (ex. vacances de
        // Noël pendant le choix LV2) est ainsi compensée jour après jour, pas seulement le cas
        // limite où la clôture tombe par hasard un jour fermé.
        const fenetresGlissantes = await prisma.academicEvent.findMany({
          where: { schoolId: school.id, status: "ACTIVE", category: "SLIDING_WINDOW", closeDate: { not: null, gt: maintenant } },
        });
        for (const ev of fenetresGlissantes) {
          if (!ev.closeDate) continue;
          const nouvelleCloture = await prolongerSiFermetureAujourdhui(prisma, school.id, ev.closeDate, maintenant);
          if (nouvelleCloture) {
            await prisma.academicEvent.update({ where: { id: ev.id }, data: { closeDate: nouvelleCloture } });
            await synchroniserClotureRessourceLiee(lv2ChoiceRepository, ev.type, ev.linkedResourceId, nouvelleCloture);
          }
        }

        // Clôture — on récupère les événements concernés AVANT le updateMany pour pouvoir
        // clôturer leur ressource liée individuellement (ex. Lv2ChoiceWindow), ce
        // qu'un updateMany en masse ne permet pas de faire ligne par ligne.
        const aCloturer = await prisma.academicEvent.findMany({
          where: { schoolId: school.id, status: "ACTIVE", closeDate: { lte: maintenant } },
          select: { id: true, type: true, linkedResourceId: true },
        });
        for (const ev of aCloturer) {
          await cloturerRessourceLiee(lv2ChoiceRepository, ev.type, ev.linkedResourceId);
        }
        await prisma.academicEvent.updateMany({
          where: { id: { in: aCloturer.map((e: any) => e.id) } },
          data: { status: "CLOSED" },
        });
      }
    });
    return { checked: true };
  },
);

export const checkOrientationCheckpoints = inngest.createFunction(
  { id: "check-orientation-checkpoints", name: "Vérification quotidienne des checkpoints d'orientation", triggers: [{ cron: "0 7 * * *" }] },
  async ({ step }) => {
    await step.run("process-orientation-checkpoints", async () => {
      const schools = await prisma.school.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
      const now = new Date();
      const orientationRepo = new PrismaOrientationRepository(prisma);
      const gradeOrientationRepo = new PrismaGradeOrientationRepository(prisma);
      const genererUseCase = new GenererRecommandationOrientationUseCase(orientationRepo, gradeOrientationRepo);
      const relancerUseCase = new RelancerElevesEnAttenteUseCase(orientationRepo);
      const finaliserUseCase = new FinaliserParDefautUseCase(orientationRepo);
      const listerUseCase = new ListerElevesAOrienterUseCase(orientationRepo);

      for (const school of schools) {
        try {
          const anneeCourante = await prisma.academicYear.findFirst({ where: { schoolId: school.id, isCurrent: true }, select: { id: true } });
          if (!anneeCourante) continue;

          const conseillerIds = await resolverConseillersOrientation(school.id);

          // ── Déclenchement du moteur, élève par élève, dans la fenêtre d'orientation ──
          const configs = await orientationRepo.findCheckpointConfigsActives(school.id);
          for (const config of configs) {
            if (!dansLaFenetreOrientation(config, now)) continue;

            const eleves = await listerUseCase.execute({ schoolId: school.id, checkpointType: config.type, academicYearId: anneeCourante.id });
            for (const eleve of eleves) {
              if (eleve.hasRecommendation) continue;
              if (conseillerIds.length === 0) continue; // rien à assigner — le filet de sécurité le signalera au conseiller dès qu'il existera

              // Déclenchement dès qu'une donnée significative existe (A.1.3 point 2) — au minimum
              // une note validée, pour ne jamais calculer une recommandation entièrement à vide.
              const aDesDonnees = await prisma.grade.findFirst({
                where: { schoolId: school.id, studentId: eleve.studentId, validationStatus: { in: ["VALIDATED", "LOCKED"] } },
                select: { id: true },
              });
              if (!aDesDonnees) continue;

              try {
                await genererUseCase.execute({
                  schoolId: school.id, studentId: eleve.studentId, checkpointType: config.type,
                  academicYearId: anneeCourante.id, conseillerId: conseillerIds[0]!,
                });
                for (const cId of conseillerIds) {
                  await notifierPersonnelDirect(
                    cId, school.id, "Nouvelle recommandation d'orientation",
                    `Une proposition a été calculée pour ${eleve.firstName} ${eleve.lastName} (${eleve.className}).`,
                  );
                }
              } catch (err: any) {
                console.error(`[Orientation] génération recommandation (${eleve.studentId}):`, err?.message);
              }
            }
          }

          // ── Relances et finalisation par défaut — indépendant de la fenêtre d'ouverture, une
          // proposition déjà envoyée à l'élève doit continuer son cycle jusqu'au bout ──
          const relances = await relancerUseCase.execute(school.id);
          for (const reco of relances) {
            await notifierPersonnelDirect(
              reco.studentId, school.id, "Rappel — proposition d'orientation en attente",
              `Votre délai de réponse approche pour votre proposition d'orientation. Répondez avant l'échéance.`,
            );
          }

          const finalisees = await finaliserUseCase.execute(school.id);
          for (const reco of finalisees) {
            await notifierPersonnelDirect(
              reco.studentId, school.id, "Orientation finalisée",
              `Le délai de réponse est passé — la piste ${reco.finalTrack} a été retenue.`,
            );
            for (const cId of conseillerIds) {
              await notifierPersonnelDirect(
                cId, school.id, "Orientation finalisée par défaut",
                `Un élève n'a pas répondu à temps — la piste ${reco.finalTrack} a été retenue par défaut.`,
              );
            }
          }
        } catch (err: any) {
          console.error(`[Orientation] école ${school.id}:`, err?.message);
        }
      }
    });
    return { checked: true };
  },
);

export const checkSuspiciousAiActionPattern = inngest.createFunction(
  { id: "check-suspicious-ai-action-pattern", name: "Détection de refus répétés — sécurité assistant IA", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    await step.run("detect-and-alert", async () => {
      const depuis = new Date(Date.now() - FENETRE_ALERTE_MS);

      const groupes = await prisma.aIActionAuditLog.groupBy({
        by: ["actorUserId"],
        where: { outcome: "REFUSE", timestamp: { gte: depuis } },
        _count: { actorUserId: true },
        having: { actorUserId: { _count: { gte: SEUIL_REFUS } } },
      });
      if (groupes.length === 0) return;

      const operateurs = await prisma.masterUser.findMany({ where: { isSuperAdmin: true }, select: { id: true, email: true, name: true } });
      if (operateurs.length === 0) return;

      for (const groupe of groupes) {
        const dejaAlerte = await prisma.aISecurityAlert.findFirst({
          where: { actorUserId: groupe.actorUserId, notifiedAt: { gte: depuis } },
        });
        if (dejaAlerte) continue; // cooldown déjà couvert par une alerte récente pour cet utilisateur

        const dernieresEntrees = await prisma.aIActionAuditLog.findMany({
          where: { actorUserId: groupe.actorUserId, outcome: "REFUSE", timestamp: { gte: depuis } },
          orderBy: { timestamp: "desc" },
          take: 5,
        });
        const actorRole = dernieresEntrees[0]?.actorRole ?? "INCONNU";
        const schoolId = dernieresEntrees[0]?.schoolId ?? null;
        const refuseCount = groupe._count.actorUserId;

        await prisma.aISecurityAlert.create({
          data: { actorUserId: groupe.actorUserId, actorRole, schoolId, refuseCount },
        });

        const detail = dernieresEntrees.map((e) => `- ${e.actionName} (${e.origin}) — ${e.refusalReason ?? "sans motif"}`).join("<br>");
        for (const operateur of operateurs) {
          if (!operateur.email) continue;
          await sendTransactionalEmail({
            recipientEmail: operateur.email,
            subject: `[Sécurité IA] ${refuseCount} actions refusées en 10 min — utilisateur ${groupe.actorUserId}`,
            html: `<p>Bonjour ${operateur.name ?? ""},<br><br>L'utilisateur <b>${groupe.actorUserId}</b> (rôle ${actorRole}${schoolId ? `, établissement ${schoolId}` : ""}) a déclenché <b>${refuseCount} refus</b> en moins de 10 minutes.</p><p>${detail}</p><p>Consultez la vue Sécurité plateforme pour le détail complet.</p>`,
            text: `${refuseCount} actions refusées en 10 min pour l'utilisateur ${groupe.actorUserId} (rôle ${actorRole}).`,
            template: "ai_security_alert",
            eventType: "ai_security_suspicious_pattern",
          });
        }
      }
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
      const exams = await prisma.exam.findMany({
        where: { schoolId, subjectId: { in: subjectIds }, scheduledAt: { gte: new Date() } },
        select: { id: true, subjectId: true, classId: true },
      });
      for (const exam of exams) {
        await inngest.send({
          name: "assessment/scheduled",
          data: { schoolId, examId: exam.id, classId: exam.classId, subjectId: exam.subjectId, timetableId },
        });
      }
    });

    // Notification admin (isolée par schoolId).
    await step.run("notify-admins", async () => {
      const admins = await prisma.user.findMany({
        where: { schoolId, role: "ADMIN", isActive: true },
        select: { id: true },
      });
      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            schoolId, userId: admin.id, type: "SYSTEM",
            title: "Emploi du temps appliqué",
            body: `${(seances ?? []).length} séance(s) appliquée(s).`,
            channel: "IN_APP",
          },
        });
      }
    });

    return { timetableId, nbSeances: (seances ?? []).length };
  }
);
