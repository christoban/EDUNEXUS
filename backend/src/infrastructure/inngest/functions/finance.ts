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
