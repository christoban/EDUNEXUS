/**
 * INNGEST — Job automatique pour le module Onboarding Auto-Service Élèves
 *
 * relanceOnboarding : cron quotidien qui scanne les dossiers en LINK_SENT et gère
 * les relances (reminderDelayDays), l'escalade au responsable (escalationDelayDays)
 * et l'expiration (tokenExpiryDays) — seule partie de ce module qui doit tourner
 * sans déclencheur utilisateur (la création du lien et l'activation du compte sont
 * notifiées directement depuis EleveOnboardingController, voir son en-tête).
 */
import { inngest } from './index';
import { PrismaClient, type UserRole } from '@prisma/client';
import { softDeleteExtension } from '../infrastructure/persistence/prisma/softDeleteExtension';
import { sendTransactionalEmail } from '../infrastructure/services/email/EmailService.ts';
import { buildOnboardingLinkTemplate } from '../utils/emailTemplates';
import { notifyOnboardingReminderSms } from '../infrastructure/services/sms/SmsNotificationService.ts';

const prisma = new PrismaClient().$extends(softDeleteExtension) as unknown as PrismaClient;

export const relanceOnboarding = inngest.createFunction(
  { id: 'relance-onboarding-eleve-quotidien', name: 'Relances onboarding élève', triggers: [{ cron: '0 8 * * *' }] },
  async ({ step }) => {
    const dossiers = await prisma.studentOnboarding.findMany({
      where: { status: 'LINK_SENT' },
      include: { school: { select: { name: true } } },
    });

    let reminded = 0;
    let escalated = 0;
    let expired = 0;
    const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';

    for (const dossier of dossiers) {
      const settings = await prisma.schoolOnboardingSettings.findUnique({ where: { schoolId: dossier.schoolId } });
      const reminderDelayDays: number[] = settings?.reminderDelayDays ?? [3, 7];
      const escalationDelayDays: number = settings?.escalationDelayDays ?? 10;
      const responsableRole: UserRole = settings?.responsableRole ?? 'ADMIN';
      const schoolName = dossier.school?.name ?? 'votre établissement';

      const daysSinceCreated = Math.floor((Date.now() - new Date(dossier.createdAt).getTime()) / (24 * 60 * 60 * 1000));

      // ── Expiration : verrou du token ou dépassement du délai configuré ──
      if (dossier.tokenExpiresAt.getTime() < Date.now()) {
        await prisma.studentOnboarding.update({ where: { id: dossier.id }, data: { status: 'EXPIRED' } });
        expired++;
        continue;
      }

      // ── Relance : un des jours configurés depuis la création ──
      if (reminderDelayDays.includes(daysSinceCreated)) {
        await step.run(`relance-${dossier.id}-j${daysSinceCreated}`, async () => {
          const formUrl = `${frontendUrl}/eleve-onboarding/${dossier.token}`;
          if (dossier.contactEmail) {
            const expiryDaysLeft = Math.max(1, Math.round((dossier.tokenExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
            const tpl = buildOnboardingLinkTemplate({ nomProvisoire: dossier.nomProvisoire, schoolName, formUrl, expiryDays: expiryDaysLeft });
            await sendTransactionalEmail({
              recipientEmail: dossier.contactEmail,
              subject: `RAPPEL — ${tpl.subject}`,
              template: 'user_invite',
              eventType: 'user_invite',
              html: tpl.html,
              text: tpl.text,
              metadata: { schoolId: dossier.schoolId },
            }).catch(err => console.error('[Email] Échec relance onboarding:', err?.message));
          }
          if (dossier.contactTelephone) {
            await notifyOnboardingReminderSms({ schoolId: dossier.schoolId, nomProvisoire: dossier.nomProvisoire, schoolName, phone: dossier.contactTelephone, formUrl });
          }
          // Contact parent distinct (LES_DEUX avec deux coordonnées séparées) — relancé en plus,
          // pas à la place, du contact élève.
          if (dossier.parentContactEmail) {
            const expiryDaysLeft = Math.max(1, Math.round((dossier.tokenExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
            const tpl = buildOnboardingLinkTemplate({ nomProvisoire: dossier.nomProvisoire, schoolName, formUrl, expiryDays: expiryDaysLeft });
            await sendTransactionalEmail({
              recipientEmail: dossier.parentContactEmail,
              subject: `RAPPEL — ${tpl.subject}`,
              template: 'user_invite',
              eventType: 'user_invite',
              html: tpl.html,
              text: tpl.text,
              metadata: { schoolId: dossier.schoolId },
            }).catch(err => console.error('[Email] Échec relance onboarding (parent):', err?.message));
          }
          if (dossier.parentContactTelephone) {
            await notifyOnboardingReminderSms({ schoolId: dossier.schoolId, nomProvisoire: dossier.nomProvisoire, schoolName, phone: dossier.parentContactTelephone, formUrl });
          }
          await prisma.studentOnboarding.update({
            where: { id: dossier.id },
            data: { remindersSentCount: { increment: 1 }, lastReminderAt: new Date() },
          });
        });
        reminded++;
      }

      // ── Escalade : dossier stagnant au-delà du délai, pas encore signalé ──
      if (daysSinceCreated >= escalationDelayDays && !dossier.escalatedAt) {
        await step.run(`escalade-${dossier.id}`, async () => {
          const responsables = await prisma.user.findMany({
            where: { schoolId: dossier.schoolId, role: responsableRole },
            select: { email: true, firstName: true },
          });
          for (const responsable of responsables) {
            if (!responsable.email) continue;
            await sendTransactionalEmail({
              recipientEmail: responsable.email,
              subject: `Dossier d'inscription en attente — ${dossier.nomProvisoire} (${schoolName})`,
              template: 'user_invite',
              eventType: 'user_invite',
              html: `<p>Bonjour,</p><p>Le dossier d'inscription de <strong>${dossier.nomProvisoire}</strong> n'est toujours pas complété après ${daysSinceCreated} jours. Une relance manuelle ou un nouveau lien (renvoyer-lien) peut être nécessaire.</p>`,
              text: `Le dossier d'inscription de ${dossier.nomProvisoire} n'est toujours pas complété après ${daysSinceCreated} jours.`,
              metadata: { schoolId: dossier.schoolId },
            }).catch(err => console.error('[Email] Échec escalade onboarding:', err?.message));
          }
          await prisma.studentOnboarding.update({ where: { id: dossier.id }, data: { escalatedAt: new Date() } });
        });
        escalated++;
      }
    }

    return { reminded, escalated, expired, processedAt: new Date().toISOString() };
  }
);
