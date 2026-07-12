/**
 * UTILS — Notifications du module Onboarding Auto-Service Élèves, factorisées pour être
 * appelées depuis plusieurs contrôleurs : EleveOnboardingController (flux AUTOSERVICE) ET
 * EntranceExamController (flux CONCOURS, après EnregistrerResultatCepUseCase). Fire-and-
 * forget, jamais throw — voir l'en-tête de EleveOnboardingController pour le choix de ne
 * pas passer par Inngest pour ces envois ponctuels déclenchés par une action utilisateur.
 */
import type { PrismaClient } from '@prisma/client';
import { sendTransactionalEmail } from '../services/emailService';
import { buildOnboardingLinkTemplate, buildOnboardingPasswordSetupTemplate } from './emailTemplates';
import { notifyOnboardingLinkSms, notifyOnboardingActivatedSms } from '../infrastructure/services/SmsNotificationService';

function frontendUrl(): string {
  return process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
}

/** Envoi fire-and-forget du lien créé (email si contactEmail, SMS si contactTelephone). */
export async function notifierOnboardingLienCree(
  prisma: PrismaClient,
  schoolId: string,
  nomProvisoire: string,
  result: { token: string; tokenExpiresAt: Date; contactEmail: string | null; contactTelephone: string | null },
): Promise<void> {
  try {
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });
    const schoolName = school?.name ?? 'votre établissement';
    const formUrl = `${frontendUrl()}/eleve-onboarding/${result.token}`;
    const expiryDays = Math.max(1, Math.round((result.tokenExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

    if (result.contactEmail) {
      const tpl = buildOnboardingLinkTemplate({ nomProvisoire, schoolName, formUrl, expiryDays });
      await sendTransactionalEmail({
        recipientEmail: result.contactEmail,
        subject: tpl.subject,
        template: 'user_invite',
        eventType: 'user_invite',
        html: tpl.html,
        text: tpl.text,
        metadata: { schoolId },
      }).catch(err => console.error('[Email] Échec envoi lien onboarding:', err?.message));
    }
    if (result.contactTelephone) {
      void notifyOnboardingLinkSms({ schoolId, nomProvisoire, schoolName, phone: result.contactTelephone, expiryDays });
    }
  } catch (err: any) {
    console.error('[Onboarding] Échec notification lien créé:', err?.message);
  }
}

/** Envoi fire-and-forget du lien "configurez votre mot de passe" pour chaque compte créé/réutilisé. */
export async function notifierOnboardingValidation(
  prisma: PrismaClient,
  schoolId: string,
  result: { comptesCrees: { role: 'STUDENT' | 'PARENT'; resetToken: string | null; contactEmail: string | null; contactTelephone: string | null; compteExistant: boolean }[] },
): Promise<void> {
  try {
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, subdomain: true } });
    const schoolName = school?.name ?? 'votre établissement';

    for (const compte of result.comptesCrees) {
      if (compte.compteExistant || !compte.resetToken) continue; // rien à configurer pour un compte parent réutilisé

      const recipientName = compte.role === 'PARENT' ? 'Parent' : 'Élève';
      if (compte.contactEmail) {
        const setupUrl = `${frontendUrl()}/reset-password?token=${compte.resetToken}&subdomain=${school?.subdomain ?? ''}`;
        const tpl = buildOnboardingPasswordSetupTemplate({ recipientName, schoolName, setupUrl });
        await sendTransactionalEmail({
          recipientEmail: compte.contactEmail,
          subject: tpl.subject,
          template: 'password_reset',
          eventType: 'password_reset',
          html: tpl.html,
          text: tpl.text,
          metadata: { schoolId },
        }).catch(err => console.error('[Email] Échec envoi configuration mot de passe onboarding:', err?.message));
      }
      if (compte.contactTelephone) {
        void notifyOnboardingActivatedSms({ schoolId, schoolName, phone: compte.contactTelephone });
      }
    }
  } catch (err: any) {
    console.error('[Onboarding] Échec notification validation:', err?.message);
  }
}
