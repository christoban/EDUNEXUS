import type { PrismaClient } from '@prisma/client';
import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';

export class PrismaClassCouncilRepository implements ClassCouncilRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async sessionVerrouilleeExiste(classId: string, academicPeriodId: string): Promise<boolean> {
    const count = await this.prisma.classCouncilSession.count({
      where: { classId, academicPeriodId, status: 'LOCKED' },
    });
    return count > 0;
  }
}
