import type { SchoolTemplateVersion, SchoolTemplateVersionRepository } from '@domain/ports/repositories/SchoolTemplateVersionRepository';

export class InMemorySchoolTemplateVersionRepository implements SchoolTemplateVersionRepository {
  private versions: SchoolTemplateVersion[] = [];

  constructor(versions: SchoolTemplateVersion[] = []) {
    this.versions = versions;
  }

  async trouverVersionActive(templateCode: string): Promise<SchoolTemplateVersion | null> {
    return this.versions.find((v) => v.templateCode === templateCode && v.active) ?? null;
  }

  async trouverParCodeEtVersion(templateCode: string, version: number): Promise<SchoolTemplateVersion | null> {
    return this.versions.find((v) => v.templateCode === templateCode && v.version === version) ?? null;
  }
}
