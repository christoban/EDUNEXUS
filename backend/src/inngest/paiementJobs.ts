/**
 * INNGEST — Jobs automatiques pour le module Matricule & Paiements MINESEC
 *
 * 1. syncCarteScolaire : sync nocturne des paiements depuis cartescolaire.cm
 * 2. relancePaiements : rappels hebdomadaires pour les frais en retard
 * 3. auditMatricules : détection des élèves sans matricule
 */
import { inngest } from './index';
import { PrismaClient } from '@prisma/client';
import { softDeleteExtension } from '../infrastructure/persistence/prisma/softDeleteExtension';
import { CarteScolaireScrapingAdapter } from '../infrastructure/services/CarteScolaireScrapingAdapter';
import { SyncFromCarteScolaireUseCase } from '../application/matricule/SyncFromCarteScolaireUseCase';
import { notifyMinesecOverdueSms } from '../infrastructure/services/SmsNotificationService';

const prisma = new PrismaClient().$extends(softDeleteExtension) as unknown as PrismaClient;
const carteScolaire = new CarteScolaireScrapingAdapter();
const syncUseCase = new SyncFromCarteScolaireUseCase(prisma, carteScolaire);

function yearLabelFor(year: { startDate: Date; endDate: Date | null }): string {
  return `${year.startDate.getFullYear()}-${year.endDate?.getFullYear() ?? year.startDate.getFullYear() + 1}`;
}

// ─── 1. Sync nocturne cartescolaire.cm ────────────────────────────────────
// Réutilise SyncFromCarteScolaireUseCase (au lieu de dupliquer la logique) pour ne
// pas dévier du comportement du déclenchement manuel admin (/matricules/sync) —
// notamment la distinction impayé confirmé vs échec de vérification.
export const syncCarteScolaire = inngest.createFunction(
  { id: 'sync-cartescolaire-nocturne', name: 'Sync nocturne cartescolaire.cm', triggers: [{ cron: '0 2 * * *' }] },
  async ({ step }) => {
    const schools = await prisma.school.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    const results: { schoolId: string; schoolName: string; report: unknown }[] = [];

    for (const school of schools) {
      const year = await prisma.academicYear.findFirst({
        where: { schoolId: school.id, isCurrent: true },
      });
      if (!year) continue;

      try {
        const report = await syncUseCase.execute(school.id, yearLabelFor(year));
        results.push({ schoolId: school.id, schoolName: school.name, report });
      } catch (err: any) {
        results.push({ schoolId: school.id, schoolName: school.name, report: { error: err.message } });
      }
      await step.sleep('pause-ecole', '1s');
    }

    return { results, syncedAt: new Date().toISOString() };
  }
);

// ─── 2. Relances paiements en retard ──────────────────────────────────────
export const relancePaiements = inngest.createFunction(
  { id: 'relance-paiements-hebdo', name: 'Relances paiements en retard', triggers: [{ cron: '0 8 * * 1' }] },
  async ({ step }) => {
    const schools = await prisma.school.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    const results: { schoolId: string; schoolName: string; remindersSent: number }[] = [];

    for (const school of schools) {
      const year = await prisma.academicYear.findFirst({
        where: { schoolId: school.id, isCurrent: true },
      });
      if (!year) continue;

      const yearLabel = `${year.startDate.getFullYear()}-${year.endDate?.getFullYear() ?? year.startDate.getFullYear() + 1}`;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const overduePayments = await (prisma as any).paiementMinesec.findMany({
        where: {
          schoolId: school.id,
          anneeScolaire: yearLabel,
          status: 'IMPAYE',
          dateEcheance: { lt: sevenDaysAgo },
        },
        include: {
          student: {
            include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } },
          },
        },
      });

      const byStudent = new Map<string, { student: any; payments: any[] }>();
      for (const p of overduePayments) {
        const existing = byStudent.get(p.studentId) ?? { student: p.student, payments: [] };
        existing.payments.push(p);
        byStudent.set(p.studentId, existing);
      }

      let remindersSent = 0;
      for (const [, { student, payments }] of byStudent) {
        const totalDus = payments.reduce((s: number, p: any) => s + p.montantAttendu, 0);
        const typesFrais = payments.map((p: any) => p.typeFrais).join(', ');
        // notifyMinesecOverdueSms attend le User.id (pas StudentProfile.id) — cf. getParentPhones()
        void notifyMinesecOverdueSms({
          schoolId: school.id,
          studentUserId: student.user.id,
          studentName: `${student.user.firstName} ${student.user.lastName}`,
          amount: totalDus,
          typesFrais,
        });
        remindersSent++;
      }

      results.push({ schoolId: school.id, schoolName: school.name, remindersSent });
    }

    return { results, sentAt: new Date().toISOString() };
  }
);

// ─── 3. Audit matricules ─────────────────────────────────────────────────
export const auditMatricules = inngest.createFunction(
  { id: 'audit-matricules-hebdo', name: 'Audit matricules hebdomadaire', triggers: [{ cron: '0 6 * * 0' }] },
  async ({ step }) => {
    const schools = await prisma.school.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    const results: { schoolId: string; schoolName: string; totalActive: number; withoutMatricule: number }[] = [];

    for (const school of schools) {
      const totalActive = await prisma.studentProfile.count({
        where: { user: { schoolId: school.id }, studentStatus: 'ACTIVE' },
      });

      const withoutMatricule = await prisma.studentProfile.count({
        where: {
          user: { schoolId: school.id },
          studentStatus: 'ACTIVE',
          matricule: null,
        },
      });

      results.push({ schoolId: school.id, schoolName: school.name, totalActive, withoutMatricule });
    }

    return { results, auditedAt: new Date().toISOString() };
  }
);
