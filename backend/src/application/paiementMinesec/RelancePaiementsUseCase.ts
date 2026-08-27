import type { MinesecJobsRepository } from '@domain/ports/repositories/MinesecJobsRepository';
import { notifyMinesecOverdueSms } from '@infrastructure/services/sms/SmsNotificationService.ts';

function yearLabelFor(year: { startDate: Date; endDate: Date | null }): string {
  return `${year.startDate.getFullYear()}-${year.endDate?.getFullYear() ?? year.startDate.getFullYear() + 1}`;
}

export class RelancePaiementsUseCase {
  constructor(private readonly repository: MinesecJobsRepository) {}

  async execute(): Promise<{ results: { schoolId: string; schoolName: string; remindersSent: number }[]; sentAt: string }> {
    const schools = await this.repository.listerEcolesActives();
    const results: { schoolId: string; schoolName: string; remindersSent: number }[] = [];

    for (const school of schools) {
      const year = await this.repository.trouverAnneeCourante(school.id);
      if (!year) continue;

      const yearLabel = yearLabelFor(year);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const overduePayments = await this.repository.listerPaiementsEnRetard(school.id, yearLabel, sevenDaysAgo);

      const byStudent = new Map<string, { student: any; payments: any[] }>();
      for (const p of overduePayments) {
        const existing = byStudent.get(p.studentId) ?? { student: (p as any).student, payments: [] };
        existing.payments.push(p);
        byStudent.set(p.studentId, existing);
      }

      let remindersSent = 0;
      for (const [, { student, payments }] of byStudent) {
        const totalDus = payments.reduce((s: number, p: any) => s + p.montantAttendu, 0);
        const typesFrais = payments.map((p: any) => p.typeFrais).join(', ');
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
}
