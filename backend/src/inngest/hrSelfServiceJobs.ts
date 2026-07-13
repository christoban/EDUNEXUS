/**
 * INNGEST — Job automatique pour le module RH self-service (voir HRSelfServiceController).
 *
 * relanceProfilRH : cron quotidien qui relance par email les employés (TEACHER/STAFF/ADMIN
 * actifs) n'ayant pas confirmé leur profil RH self-service (EmployeeFile.selfServiceCompletedAt
 * null), puis escalade vers les ADMIN de l'école au-delà du délai configuré — même pattern que
 * relanceOnboarding (eleveOnboardingJobs.ts).
 *
 * Canal IN_APP : contrairement à SocketNotificationService.envoyer() (émission Socket.io pure,
 * jamais persistée nulle part dans ce projet — vérifié, aucun `prisma.notification.create`
 * n'existe ailleurs), ce job écrit directement dans la table Notification pour que l'employé
 * voie sa relance dans sa cloche même s'il n'était pas connecté au moment de l'envoi.
 */
import { inngest } from './index';
import { PrismaClient } from '@prisma/client';
import { sendTransactionalEmail } from '../services/emailService';

const prisma = new PrismaClient();

const REMINDER_DELAY_DAYS = [7, 14];
const ESCALATION_DELAY_DAYS = 21;
const FRONTEND_URL = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';

export const relanceProfilRH = inngest.createFunction(
  { id: 'relance-profil-rh-quotidien', name: 'Relances profil RH self-service', triggers: [{ cron: '0 8 * * *' }] },
  async ({ step }) => {
    const employes = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['TEACHER', 'STAFF', 'ADMIN'] } },
      select: {
        id: true, schoolId: true, firstName: true, lastName: true, email: true, createdAt: true, role: true,
        school: { select: { name: true } },
        employeeFile: { select: { selfServiceCompletedAt: true, remindersSentCount: true, lastReminderAt: true, escalatedAt: true } },
      },
    });

    let reminded = 0;
    let escalated = 0;
    const escalationsBySchool = new Map<string, { schoolName: string; employes: string[] }>();

    for (const employe of employes) {
      if (employe.employeeFile?.selfServiceCompletedAt) continue; // déjà confirmé, rien à faire

      const daysSinceCreated = Math.floor((Date.now() - new Date(employe.createdAt).getTime()) / (24 * 60 * 60 * 1000));
      const schoolName = employe.school?.name ?? 'votre établissement';
      const profileUrl = `${FRONTEND_URL}/${employe.role === 'TEACHER' ? 'teacher' : 'staff'}/dashboard`;

      if (REMINDER_DELAY_DAYS.includes(daysSinceCreated)) {
        await step.run(`relance-${employe.id}-j${daysSinceCreated}`, async () => {
          if (employe.email) {
            await sendTransactionalEmail({
              recipientEmail: employe.email,
              subject: `Complétez votre profil RH — ${schoolName}`,
              template: 'user_invite',
              eventType: 'user_invite',
              html: `<p>Bonjour ${employe.firstName},</p><p><strong>${schoolName}</strong> vous invite à compléter votre profil RH (identité, diplômes, documents) depuis votre tableau de bord.</p><p><a href="${profileUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;">Compléter mon profil</a></p>`,
              text: `${schoolName} vous invite à compléter votre profil RH : ${profileUrl}`,
              metadata: { schoolId: employe.schoolId },
            }).catch((err) => console.error('[Email] Échec relance profil RH:', err?.message));
          }

          await prisma.notification.create({
            data: {
              schoolId: employe.schoolId,
              userId: employe.id,
              type: 'SYSTEM',
              title: 'Profil RH à compléter',
              body: `Merci de compléter et confirmer votre profil RH depuis votre tableau de bord.`,
              channel: 'IN_APP',
              metadata: { link: '/mon-profil-rh' },
            },
          });

          await prisma.employeeFile.upsert({
            where: { userId: employe.id },
            create: { userId: employe.id, schoolId: employe.schoolId, remindersSentCount: 1, lastReminderAt: new Date() },
            update: { remindersSentCount: { increment: 1 }, lastReminderAt: new Date() },
          });
        });
        reminded++;
      }

      if (daysSinceCreated >= ESCALATION_DELAY_DAYS && !employe.employeeFile?.escalatedAt) {
        await step.run(`escalade-${employe.id}`, async () => {
          await prisma.employeeFile.upsert({
            where: { userId: employe.id },
            create: { userId: employe.id, schoolId: employe.schoolId, escalatedAt: new Date() },
            update: { escalatedAt: new Date() },
          });
        });
        const key = employe.schoolId;
        if (!escalationsBySchool.has(key)) escalationsBySchool.set(key, { schoolName, employes: [] });
        escalationsBySchool.get(key)!.employes.push(`${employe.lastName} ${employe.firstName} (${employe.role})`);
        escalated++;
      }
    }

    // ── Escalade groupée par école vers les ADMIN — un seul email récapitulatif, pas un par employé ──
    for (const [schoolId, info] of escalationsBySchool.entries()) {
      await step.run(`escalade-admin-${schoolId}`, async () => {
        const admins = await prisma.user.findMany({ where: { schoolId, role: 'ADMIN', isActive: true }, select: { id: true, email: true } });
        const liste = info.employes.map((n) => `<li>${n}</li>`).join('');
        for (const admin of admins) {
          if (admin.email) {
            await sendTransactionalEmail({
              recipientEmail: admin.email,
              subject: `Profils RH non complétés après ${ESCALATION_DELAY_DAYS} jours — ${info.schoolName}`,
              template: 'user_invite',
              eventType: 'user_invite',
              html: `<p>Bonjour,</p><p>Les employés suivants n'ont toujours pas complété leur profil RH self-service après ${ESCALATION_DELAY_DAYS} jours :</p><ul>${liste}</ul><p>Une relance personnelle peut être nécessaire.</p>`,
              text: `Profils RH non complétés après ${ESCALATION_DELAY_DAYS} jours : ${info.employes.join(', ')}`,
              metadata: { schoolId },
            }).catch((err) => console.error('[Email] Échec escalade profil RH:', err?.message));
          }
          await prisma.notification.create({
            data: {
              schoolId, userId: admin.id, type: 'SYSTEM',
              title: 'Profils RH en attente',
              body: `${info.employes.length} employé(s) n'ont pas complété leur profil RH après ${ESCALATION_DELAY_DAYS} jours.`,
              channel: 'IN_APP',
              metadata: { link: '/admin/dashboard?section=rh', employes: info.employes },
            },
          });
        }
      });
    }

    return { reminded, escalated, processedAt: new Date().toISOString() };
  },
);
