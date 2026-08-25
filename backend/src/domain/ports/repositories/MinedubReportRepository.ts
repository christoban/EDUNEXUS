/**
 * MinedubReportRepository — CRUD pour les rapports statistiques MINEDUB (préscolaire/primaire).
 * Écritures : création de rapport PDF.
 * Lectures : supplement primaire.
 * Les lectures d'effectifs/personnel (resolve*PrimaryAutoFields) vivent dans StatisticalQueryPort (9.1).
 */

export interface MinedubSupplementData {
  zoneImplantation: string | null;
  ordreEnseignement: string | null;
  elevesVulnerablesDetail: unknown;
  infrastructuresDetail: unknown;
  commoditesDetail: unknown;
  manuelsDetail: unknown;
}

export interface MinedubReportRepository {
  trouverSupplementPrimaire(schoolId: string): Promise<MinedubSupplementData | null>;
  creerRapport(data: {
    schoolId: string;
    generatedBy: string;
    filePath: string;
    champsNonResolus: unknown;
  }): Promise<{ id: string }>;
}
