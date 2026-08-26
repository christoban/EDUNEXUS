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

export const computeStudentHealthScores = inngest.createFunction(
  { id: "compute-student-health-scores", name: "Calcul indice santé scolaire", triggers: [{ cron: "0 2 * * *" }] },
  async ({ step }) => {
    await step.run("compute-all-schools", async () => {
      const schools = await prisma.school.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });

      for (const school of schools) {
        const config = await prisma.schoolConfig
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

    // Persisté pour le digest quotidien du professeur principal (sendProfessorPrincipalDigest) —
    // plus de push immédiat ici : "un push par élève" devient "un digest groupé le lendemain
    // matin", aligné sur le job nocturne qui ne recalcule le score qu'une fois par nuit
    // (relecture juillet 2026).
    if (professorPrincipalId) {
      void genererEtPersisterConseil({
        schoolId, studentId, nomEleve: nomComplet, contexte,
        recipientRole: "TEACHER", contextType: "HEALTH_CRITICAL", destinataire: "ENSEIGNANT",
      });
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

    // Persisté pour le digest quotidien du professeur principal — voir le même commentaire dans
    // handleCriticalHealthAlert.
    if (professorPrincipalId) {
      void genererEtPersisterConseil({
        schoolId, studentId, nomEleve: nomComplet, contexte,
        recipientRole: "TEACHER", contextType: "HEALTH_WARNING", destinataire: "ENSEIGNANT",
      });
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

export const sendProfessorPrincipalDigest = inngest.createFunction(
  { id: "send-professor-principal-digest", name: "Digest quotidien — professeur principal", triggers: [{ cron: "30 2 * * *" }] },
  async ({ step }) => {
    await step.run("digest-all-schools", async () => {
      const schools = await prisma.school.findMany({ where: { status: "ACTIVE" }, select: { id: true } });

      for (const school of schools) {
        const config = await prisma.schoolConfig
          .findFirst({ where: { schoolId: school.id }, select: { aiAlertsEnabled: true, aiRiskThreshold: true, aiRiskThresholdCritical: true } })
          .catch(() => null);
        if (config?.aiAlertsEnabled === false) continue;
        const warningThreshold = config?.aiRiskThreshold ?? 50;
        const criticalThreshold = config?.aiRiskThresholdCritical ?? 30;

        type Digest = { critiques: string[]; vigilances: string[]; chutes: string[] };
        const parPP = new Map<string, Digest>();
        const ajouter = (ppId: string | null | undefined, champ: keyof Digest, ligne: string) => {
          if (!ppId) return;
          const d = parPP.get(ppId) ?? { critiques: [], vigilances: [], chutes: [] };
          d[champ].push(ligne);
          parPP.set(ppId, d);
        };

        // 1. Alertes composite du calcul qui vient de tourner (score déjà persisté).
        const eleves = await prisma.studentProfile.findMany({
          where: { user: { schoolId: school.id }, healthScore: { lte: warningThreshold } },
          select: {
            healthScore: true,
            user: { select: { firstName: true, lastName: true } },
            enrollmentsYearScoped: {
              where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
              take: 1,
              select: { class: { select: { name: true, professorPrincipalId: true } } },
            },
          },
        });
        for (const e of eleves) {
          const nom = `${e.user.firstName} ${e.user.lastName}`;
          const ligne = `${nom} (${e.enrollmentsYearScoped[0]?.class?.name ?? "N/A"}) — indice ${e.healthScore}/100`;
          ajouter(e.enrollmentsYearScoped[0]?.class?.professorPrincipalId, e.healthScore <= criticalThreshold ? "critiques" : "vigilances", ligne);
        }

        // 2. Chutes par matière détectées la veille — peu importe quel enseignant de matière a
        // validé la note qui les a déclenchées.
        const depuis = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const chutes = await prisma.studentRecommendation.findMany({
          where: { schoolId: school.id, recipientRole: "TEACHER", contextType: "SUBJECT_DROP", createdAt: { gte: depuis } },
          select: { studentId: true, subjectId: true },
        });
        if (chutes.length > 0) {
          const studentIds = Array.from(new Set(chutes.map((c) => c.studentId)));
          const subjectIds = Array.from(new Set(chutes.map((c) => c.subjectId).filter((s): s is string => !!s)));
          const [profils, matieres] = await Promise.all([
            prisma.studentProfile.findMany({
              where: { userId: { in: studentIds }, user: { schoolId: school.id } },
              select: {
                userId: true,
                user: { select: { firstName: true, lastName: true } },
                enrollmentsYearScoped: {
                  where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
                  take: 1,
                  select: { class: { select: { name: true, professorPrincipalId: true } } },
                },
              },
            }),
            prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } }),
          ]);
          const profilParEleve = new Map(profils.map((p) => [p.userId, p]));
          const nomMatiere = new Map(matieres.map((m) => [m.id, m.name]));
          for (const c of chutes) {
            const profil = profilParEleve.get(c.studentId);
            if (!profil?.enrollmentsYearScoped[0]) continue;
            const nom = `${profil.user.firstName} ${profil.user.lastName}`;
            const matiere = c.subjectId ? (nomMatiere.get(c.subjectId) ?? "une matière") : "une matière";
            ajouter(profil.enrollmentsYearScoped[0].class.professorPrincipalId, "chutes", `${nom} (${profil.enrollmentsYearScoped[0].class.name}) — chute en ${matiere}`);
          }
        }

        // 3. Un seul message par PP, même s'il cumule plusieurs signaux de nature différente.
        for (const [ppId, d] of parPP) {
          const sections: string[] = [];
          if (d.critiques.length) sections.push(`Critique (${d.critiques.length}) :\n${d.critiques.join("\n")}`);
          if (d.vigilances.length) sections.push(`Vigilance (${d.vigilances.length}) :\n${d.vigilances.join("\n")}`);
          if (d.chutes.length) sections.push(`Chutes de matière hier (${d.chutes.length}) :\n${d.chutes.join("\n")}`);
          if (sections.length === 0) continue;
          await notifierPersonnelDirect(ppId, school.id, "Votre digest quotidien — élèves à suivre", sections.join("\n\n"));
        }
      }
    });

    return { digestSent: true };
  },
);
