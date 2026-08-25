import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  StatisticalCampaignRepository,
  SupplementData,
  TemplateData,
} from '@domain/ports/repositories/StatisticalCampaignRepository';

export class PrismaStatisticalCampaignRepository implements StatisticalCampaignRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async trouverSupplement(schoolId: string): Promise<SupplementData | null> {
    return this.prisma.schoolStatisticalSupplement.findUnique({
      where: { schoolId },
    }) as unknown as SupplementData | null;
  }

  async trouverTemplateActif(ministry: string): Promise<TemplateData | null> {
    const template = await this.prisma.statisticalCampaignTemplate.findFirst({
      where: { ministry, isActive: true },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, filePath: true },
    });
    return template;
  }

  async creerSubmission(data: {
    schoolId: string;
    templateId: string;
    generatedBy: string;
    status: 'PENDING_MANUAL_DATA' | 'DRAFT';
    filePath?: string | null;
    unresolvedFieldsReport?: unknown;
  }): Promise<{ id: string }> {
    return this.prisma.statisticalSubmission.create({
      data: {
        schoolId: data.schoolId,
        templateId: data.templateId,
        generatedBy: data.generatedBy,
        status: data.status,
        filePath: data.filePath ?? null,
        unresolvedFieldsReport: data.unresolvedFieldsReport as Prisma.InputJsonValue | undefined,
      },
      select: { id: true },
    });
  }
}
