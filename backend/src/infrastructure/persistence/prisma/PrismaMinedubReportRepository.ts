import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  MinedubReportRepository,
  MinedubSupplementData,
} from '@domain/ports/repositories/MinedubReportRepository';

export class PrismaMinedubReportRepository implements MinedubReportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async trouverSupplementPrimaire(schoolId: string): Promise<MinedubSupplementData | null> {
    const supplement = await this.prisma.minedubSchoolSupplement.findUnique({
      where: { schoolId },
      select: {
        zoneImplantation: true,
        ordreEnseignement: true,
        elevesVulnerablesDetail: true,
        infrastructuresDetail: true,
        commoditesDetail: true,
        manuelsDetail: true,
      },
    });
    return supplement;
  }

  async creerRapport(data: {
    schoolId: string;
    generatedBy: string;
    filePath: string;
    champsNonResolus: unknown;
  }): Promise<{ id: string }> {
    return this.prisma.minedubStatisticalReport.create({
      data: {
        schoolId: data.schoolId,
        generatedBy: data.generatedBy,
        filePath: data.filePath,
        champsNonResolus: data.champsNonResolus as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
  }
}
