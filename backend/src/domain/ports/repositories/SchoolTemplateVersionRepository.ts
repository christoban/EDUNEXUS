/**
 * DOMAIN LAYER — Port Repository SchoolTemplateVersion
 * Versionnage des templates de configuration.
 * Phase 2 du chantier V0.4 : permet de stocker les defaults SchoolConfig
 * par version de template, pour la re-application ciblée.
 */

export interface SchoolTemplateVersion {
  id: string;
  templateCode: string;
  version: number;
  config: Record<string, unknown>;
  publishedAt: Date | null;
  active: boolean;
  createdAt: Date;
}

export interface SchoolTemplateVersionRepository {
  /** Trouve la version active d'un template (active = true). */
  trouverVersionActive(templateCode: string): Promise<SchoolTemplateVersion | null>;

  /** Trouve une version par code + numéro. */
  trouverParCodeEtVersion(templateCode: string, version: number): Promise<SchoolTemplateVersion | null>;
}
