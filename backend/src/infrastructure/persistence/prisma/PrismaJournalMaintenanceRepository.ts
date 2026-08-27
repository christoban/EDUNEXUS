import type { PrismaClient } from '@prisma/client';
import type { JournalMaintenanceRepository } from '@domain/ports/repositories/JournalMaintenanceRepository';

export class PrismaJournalMaintenanceRepository implements JournalMaintenanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listerEcolesActives(): Promise<Array<{ id: string; name: string }>> {
    return (this.prisma as any).school.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
    });
  }

  async purgerJournauxEcole(schoolId: string) {
    const db = this.prisma as any;
    const settings = await db.schoolSettings.findUnique({
      where: { schoolId },
      select: { logRetentionDays: true },
    });
    const logRetentionDays = (settings?.logRetentionDays as number | null) ?? 90;
    const cutoff = new Date(Date.now() - logRetentionDays * 24 * 60 * 60 * 1000);
    const [emailDeleted, smsDeleted] = await Promise.all([
      db.emailLog.deleteMany({ where: { schoolId, createdAt: { lt: cutoff } } }),
      db.smsLog.deleteMany({ where: { schoolId, createdAt: { lt: cutoff } } }),
    ]);
    return {
      schoolId,
      logRetentionDays,
      cutoff: cutoff.toISOString(),
      emailDeleted: emailDeleted.count,
      smsDeleted: smsDeleted.count,
    };
  }

  async purgerTousLesJournaux() {
    const schools = await this.listerEcolesActives();
    const results = [];
    for (const school of schools) {
      results.push(await this.purgerJournauxEcole(school.id));
    }
    return results;
  }
}
