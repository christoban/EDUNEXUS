/**
 * DOMAIN LAYER — Port Service PDF
 * Génération des bulletins scolaires via PDFKit.
 */
import type { BulletinTemplate } from '@domain/types/enums';
import type { BulletinProps } from '@domain/entities/Bulletin';

export interface ContexteBulletin {
  bulletin: BulletinProps;
  nomEleve: string;
  nomClasse: string;
  nomEtablissement: string;
  logoUrl?: string;
  anneeAcademique: string;
  nomPeriode: string;
  nomProfesseurPrincipal?: string;
  moyenneClasse?: number;
  moyennePremier?: number;
  moyenneDernier?: number;
  nbAdmis?: number;
  tauxReussite?: number;
  /** Langue de rendu (templates partagés PRIMARY/ANNUAL). Résolue via resolveLanguage(). Défaut "fr". */
  langue?: "fr" | "en";
}

export interface PdfService {
  genererBulletin(contexte: ContexteBulletin): Promise<Buffer>;
  genererBulletinsEnMasse(contextes: ContexteBulletin[]): Promise<{
    bulletinId: string;
    pdf: Buffer;
  }[]>;
}
