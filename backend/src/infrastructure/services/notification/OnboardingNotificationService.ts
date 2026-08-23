/**
 * Service de notifications du module Onboarding Auto-Service Élèves, factorisé pour être
 * appelé depuis plusieurs contrôleurs : EleveOnboardingController et EntranceExamController.
 * Fire-and-forget, jamais throw — les envois ponctuels sont déclenchés par une action utilisateur.
 */
import type { PrismaClient } from '@prisma/client';
import { sendTransactionalEmail } from '../email/EmailService.ts';
import {
  notifyOnboardingLinkSms,
  notifyOnboardingActivatedSms,
  notifyOnboardingActivatedSmsOnly,
} from '../sms/SmsNotificationService.ts';
import {
  buildOnboardingLinkTemplate,
  buildOnboardingPasswordSetupTemplate,
} from '../email/templates/emailTemplates';

function frontendUrl(): string {
  return process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
}

/**
 * Envoi fire-and-forget du lien créé (email si contactEmail, SMS si contactTelephone), pour
 * le contact élève ET, si distinct (LES_DEUX avec deux coordonnées séparées), le contact parent.
 */
export async function notifierOnboardingLienCree(
  prisma: PrismaClient,
  schoolId: string,
  nomProvisoire: string,
  result: {
    token: string;
    tokenExpiresAt: Date;
    contactEmail: string | null;
    contactTelephone: string | null;
    parentContactEmail?: string | null;
    parentContactTelephone?: string | null;
  },
): Promise<void> {
  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });
    const schoolName = school?.name ?? 'votre établissement';
    const formUrl = `${frontendUrl()}/eleve-onboarding/${result.token}`;
    const expiryDays = Math.max(
      1,
      Math.round(
        (result.tokenExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      ),
    );

    const destinataires = [
      { email: result.contactEmail, phone: result.contactTelephone },
      { email: result.parentContactEmail ?? null, phone: result.parentContactTelephone ?? null },
    ];

    for (const dest of destinataires) {
      if (dest.email) {
        const tpl = buildOnboardingLinkTemplate({ nomProvisoire, schoolName, formUrl, expiryDays });
        await sendTransactionalEmail({
          recipientEmail: dest.email,
          subject: tpl.subject,
          template: 'user_invite',
          eventType: 'user_invite',
          html: tpl.html,
          text: tpl.text,
          metadata: { schoolId },
        }).catch((err: unknown) =>
          console.error('[Email] Échec envoi lien onboarding:', err instanceof Error ? err.message : String(err)),
        );
      }
      if (dest.phone) {
        void notifyOnboardingLinkSms({ schoolId, nomProvisoire, schoolName, phone: dest.phone, expiryDays, formUrl });
      }
    }
  } catch (err: unknown) {
    console.error('[Onboarding] Échec notification lien créé:', err instanceof Error ? err.message : String(err));
  }
}

/** Envoi fire-and-forget du lien "configurez votre mot de passe" pour chaque compte créé/réutilisé. */
export async function notifierOnboardingValidation(
  prisma: PrismaClient,
  schoolId: string,
  result: {
    comptesCrees: {
      role: 'STUDENT' | 'PARENT';
      resetToken: string | null;
      contactEmail: string | null;
      contactTelephone: string | null;
      compteExistant: boolean;
      accessMode?: 'FULL_ACCESS' | 'SMS_ONLY';
    }[];
  },
): Promise<void> {
  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, subdomain: true },
    });
    const schoolName = school?.name ?? 'votre établissement';

    for (const compte of result.comptesCrees) {
      if (compte.compteExistant) continue;

      if (compte.accessMode === 'SMS_ONLY') {
        if (compte.contactTelephone) {
          void notifyOnboardingActivatedSmsOnly({ schoolId, schoolName, phone: compte.contactTelephone });
        }
        continue;
      }

      if (!compte.resetToken) continue;
      const recipientName = compte.role === 'PARENT' ? 'Parent' : 'Élève';
      const setupUrl = `${frontendUrl()}/reset-password?token=${compte.resetToken}&subdomain=${school?.subdomain ?? ''}`;

      if (compte.contactEmail) {
        const tpl = buildOnboardingPasswordSetupTemplate({ recipientName, schoolName, setupUrl });
        await sendTransactionalEmail({
          recipientEmail: compte.contactEmail,
          subject: tpl.subject,
          template: 'password_reset',
          eventType: 'password_reset',
          html: tpl.html,
          text: tpl.text,
          metadata: { schoolId },
        }).catch((err: unknown) =>
          console.error('[Email] Échec envoi configuration mot de passe onboarding:', err instanceof Error ? err.message : String(err)),
        );
      }
      if (compte.contactTelephone) {
        void notifyOnboardingActivatedSms({ schoolId, schoolName, phone: compte.contactTelephone, setupUrl });
      }
    }
  } catch (err: unknown) {
    console.error('[Onboarding] Échec notification validation:', err instanceof Error ? err.message : String(err));
  }
}
