import type { PrismaClient } from '@prisma/client';
import type { SauvegardeRepository } from '@domain/ports/repositories/SauvegardeRepository';
import { createSchoolBackup } from '../../backup/SchoolBackupService';

export class PrismaSauvegardeRepository implements SauvegardeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listerEcoles(params: { schoolId?: string }): Promise<Array<{ id: string; name: string }>> {
    const db = this.prisma as any;
    if (params.schoolId) {
      return db.school.findMany({ where: { id: params.schoolId }, select: { id: true, name: true } });
    }
    return db.school.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true } });
  }

  async sauvegarderEcole(params: {
    schoolId: string;
    requestedByMasterId?: string | null;
    source?: 'cron' | 'manual';
  }): Promise<{ schoolId: string; fileName: string; filePath: string; createdAt: string }> {
    return createSchoolBackup(this.prisma, {
      schoolId: params.schoolId,
      requestedByMasterId: params.requestedByMasterId ?? null,
      source: params.source ?? 'manual',
    });
  }
}
