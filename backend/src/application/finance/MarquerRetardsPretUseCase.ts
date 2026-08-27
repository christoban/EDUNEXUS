import type { FinanceJobsRepository } from '@domain/ports/repositories/FinanceJobsRepository';
import { SocketNotificationService } from '@infrastructure/services/notification/SocketNotificationService.ts';
import { notifierParentsPushDabord } from '@infrastructure/services/notification/PushFirstNotifier.ts';
import { notifyOverdueBookSms } from '@infrastructure/services/sms/SmsNotificationService.ts';

export class MarquerRetardsPretUseCase {
  constructor(private readonly financeJobsRepository: FinanceJobsRepository) {}

  async findOverdue(): Promise<Awaited<ReturnType<FinanceJobsRepository['findOverdueBookLoans']>>> {
    return this.financeJobsRepository.findOverdueBookLoans(new Date());
  }

  async markOverdue(ids: string[]): Promise<void> {
    await this.financeJobsRepository.markBookLoansOverdue(ids);
  }

  async notifyOverdue(loans: Awaited<ReturnType<FinanceJobsRepository['findOverdueBookLoans']>>): Promise<void> {
    const notificationService = new SocketNotificationService();
    for (const loan of loans) {
      const studentName = `${loan.student.firstName} ${loan.student.lastName}`.trim();
      const titre = "Livre en retard";
      const corps = `Le livre "${loan.book.title}" est en retard de retour à la bibliothèque.`;

      await notificationService
        .envoyer({ schoolId: loan.schoolId, userId: loan.studentId, type: "LIBRARY_OVERDUE", titre, corps, canal: "PUSH" })
        .catch((err: any) => console.error('[Library Overdue élève]', err?.message));

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
        }).catch((err: any) => console.error('[Library Overdue SMS]', err?.message));
      }
    }
  }

  async execute(): Promise<{ updated: number }> {
    const toMark = await this.findOverdue();
    if (toMark.length === 0) return { updated: 0 };
    await this.markOverdue(toMark.map((l) => l.id));
    await this.notifyOverdue(toMark);
    return { updated: toMark.length };
  }

  // Méthodes séquentielles pour respecter le découpage Inngest step.run
  async executeFindUpdateNotify(): Promise<{ updated: number }> {
    return this.execute();
  }
}
