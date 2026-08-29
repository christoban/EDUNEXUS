import type { PrismaClient } from '@prisma/client';
import type { SchoolTemplateVersion, SchoolTemplateVersionRepository } from '@domain/ports/repositories/SchoolTemplateVersionRepository';

export class PrismaSchoolTemplateVersionRepository implements SchoolTemplateVersionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async trouverVersionActive(templateCode: string): Promise<SchoolTemplateVersion | null> {
    const row = await this.prisma.schoolTemplateVersion.findFirst({
      where: { templateCode, active: true },
      orderBy: { version: 'desc' },
    });
    return row ? this.toDomain(row) : null;
  }

  async trouverParCodeEtVersion(templateCode: string, version: number): Promise<SchoolTemplateVersion | null> {
    const row = await this.prisma.schoolTemplateVersion.findUnique({
      where: { templateCode_version: { templateCode, version } },
    });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: any): SchoolTemplateVersion {
    return {
      id: row.id,
      templateCode: row.templateCode,
      version: row.version,
      config: (row.config as Record<string, unknown>) ?? {},
      publishedAt: row.publishedAt,
      active: row.active,
      createdAt: row.createdAt,
    };
  }
}
