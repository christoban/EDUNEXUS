import type { FinanceJobsRepository } from '@domain/ports/repositories/FinanceJobsRepository';
import { sendTransactionalEmail } from '@infrastructure/services/email/EmailService.ts';
import { notifyAbsenceThresholdSms } from '@infrastructure/services/sms/SmsNotificationService.ts';

export class VerifierSeuilAbsencesUseCase {
  constructor(private readonly financeJobsRepository: FinanceJobsRepository) {}

  async execute(): Promise<{ alertsSent: number }> {
    const schools = await this.financeJobsRepository.findActiveSchools();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let alertsSent = 0;

    for (const school of schools) {
      const thresholdRaw = await this.financeJobsRepository.getSchoolConfigAbsenceThreshold(school.id);
      const threshold = thresholdRaw ?? 3;

      const absenceCounts = await this.financeJobsRepository.countAbsencesGrouped(school.id, since);
      const overThreshold = absenceCounts.filter((a) => a._count.id >= threshold);
      if (overThreshold.length === 0) continue;

      const surveillants = await this.financeJobsRepository.findStaffByPermissionWithUser(school.id, "MANAGE_ATTENDANCE");

      for (const entry of overThreshold) {
        const student = await this.financeJobsRepository.findUserById(entry.studentId);
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

        void notifyAbsenceThresholdSms({ schoolId: school.id, studentId: entry.studentId, studentName, count, threshold });
        alertsSent++;
      }
    }

    return { alertsSent };
  }
}
