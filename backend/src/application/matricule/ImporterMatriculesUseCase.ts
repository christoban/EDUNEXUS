import type { PrismaClient, Prisma } from '@prisma/client';
import type { ImportMatriculeRow, ImportMatriculeResult, FuzzyMatchCandidate } from './types';
import { normalizeForMatch, compareNames } from './stringSimilarity';
import { parseDateFR as parseDateNaissance } from '../../utils/dateParsing';

/**
 * Seuil de similarité (0-1) pour classer une paire nom/prénom comme "correspondance
 * probable" plutôt que "non-matché". Conservateur par conception : mieux vaut renvoyer
 * un cas ambigu en non-matché (traitement manuel complet) qu'accepter un faux rapprochement.
 * Les DEUX champs (nom ET prénom) doivent individuellement dépasser ce seuil.
 */
const FUZZY_SIMILARITY_THRESHOLD = 0.85;

export class ImporterMatriculesUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    schoolId: string,
    rows: ImportMatriculeRow[],
    uploadedBy: string,
    fileName: string,
  ): Promise<ImportMatriculeResult> {
    // Créer le job de suivi
    const job = await this.prisma.matriculeImportJob.create({
      data: {
        schoolId,
        uploadedBy,
        fileName,
        status: 'PROCESSING',
        totalRows: rows.length,
      },
    });

    // Charger tous les profils de l'école une seule fois (réutilisé pour exact ET fuzzy).
    const profiles: any[] = await this.prisma.studentProfile.findMany({
      where: { user: { schoolId } },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    let matchedExact = 0;
    let conflicts = 0;
    let errors = 0;
    const unmatchedDetails: ImportMatriculeResult['unmatchedDetails'] = [];
    const fuzzyMatches: FuzzyMatchCandidate[] = [];

    for (const row of rows) {
      try {
        const result = await this.processRow(row, profiles);
        if (result.action === 'UPDATED' || result.action === 'ALREADY_MATCHED') {
          matchedExact++;
        } else if (result.action === 'CONFLICT') {
          conflicts++;
          unmatchedDetails.push({
            ligne: row.ligne,
            nom: row.nom,
            prenom: row.prenom,
            raison: `Conflit : matricule existant "${result.matriculeActuel}" différent du nouveau "${result.matriculeNouveau}"`,
          });
        } else if (result.action === 'FUZZY_PENDING') {
          fuzzyMatches.push(result.fuzzyMatch);
        }
      } catch (err: any) {
        errors++;
        unmatchedDetails.push({
          ligne: row.ligne,
          nom: row.nom,
          prenom: row.prenom,
          raison: err.message || 'Erreur inconnue',
        });
      }
    }

    const unmatched = unmatchedDetails.filter(d => !d.raison.includes('Conflit')).length;

    // Mettre à jour le job — matchedRows compte exact + fuzzy déjà confirmés (aucun à l'import).
    await this.prisma.matriculeImportJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        matchedRows: matchedExact,
        matchedRowsExact: matchedExact,
        matchedRowsFuzzyConfirmed: 0,
        flaggedForCorrection: 0,
        unmatchedRows: unmatched,
        errorRows: errors,
        resultDetails: { unmatched: unmatchedDetails, fuzzyMatches } as unknown as Prisma.InputJsonValue,
        processedAt: new Date(),
      },
    });

    return {
      jobId: job.id,
      total: rows.length,
      matched: matchedExact,
      matchedExact,
      fuzzyPending: fuzzyMatches.length,
      unmatched,
      conflicts,
      errors,
      unmatchedDetails,
      fuzzyMatches,
    };
  }

  private async processRow(
    row: ImportMatriculeRow,
    profiles: any[],
  ): Promise<
    | { action: 'UPDATED' | 'CONFLICT' | 'ALREADY_MATCHED'; studentProfileId: string; userId: string; nom: string; prenom: string; matriculeActuel: string | null; matriculeNouveau: string }
    | { action: 'FUZZY_PENDING'; fuzzyMatch: FuzzyMatchCandidate }
  > {
    const targetNom = normalizeForMatch(row.nom);
    const targetPrenom = normalizeForMatch(row.prenom);

    // ── NIVEAU 1 : correspondance exacte (comportement inchangé) ──────────────
    const exact = profiles.find((p: any) => {
      const userNom = normalizeForMatch(p.user.lastName ?? '');
      const userPrenom = normalizeForMatch(p.user.firstName ?? '');
      if (userNom !== targetNom || userPrenom !== targetPrenom) return false;
      if (row.dateNaissance && p.dateOfBirth) {
        const rowDate = parseDateNaissance(row.dateNaissance);
        if (rowDate && rowDate.getTime() !== new Date(p.dateOfBirth).getTime()) return false;
      }
      return true;
    });

    if (exact) {
      if (exact.matricule === row.matricule) {
        return {
          action: 'ALREADY_MATCHED', studentProfileId: exact.id, userId: exact.userId,
          nom: row.nom, prenom: row.prenom, matriculeActuel: exact.matricule, matriculeNouveau: row.matricule,
        };
      }
      if (exact.matricule && exact.matricule !== row.matricule) {
        return {
          action: 'CONFLICT', studentProfileId: exact.id, userId: exact.userId,
          nom: row.nom, prenom: row.prenom, matriculeActuel: exact.matricule, matriculeNouveau: row.matricule,
        };
      }
      await this.prisma.studentProfile.update({
        where: { id: exact.id },
        data: { matricule: row.matricule, matriculeSource: 'EXCEL_IMPORT', matriculeMatchType: 'EXACT' },
      });
      return {
        action: 'UPDATED', studentProfileId: exact.id, userId: exact.userId,
        nom: row.nom, prenom: row.prenom, matriculeActuel: null, matriculeNouveau: row.matricule,
      };
    }

    // ── NIVEAU 2 : correspondance probable — date de naissance exacte requise ──
    // Signal le plus fiable (peu de coïncidences) ; sans elle, jamais de fuzzy match.
    const rowDate = row.dateNaissance ? parseDateNaissance(row.dateNaissance) : null;
    if (rowDate) {
      const dateCandidats = profiles.filter((p: any) => {
        if (!p.dateOfBirth) return false;
        return new Date(p.dateOfBirth).getTime() === rowDate.getTime();
      });

      let best: { profile: any; score: number } | null = null;
      for (const cand of dateCandidats) {
        const nom = cand.user.lastName ?? '';
        const prenom = cand.user.firstName ?? '';
        const score = compareNames(row.nom, row.prenom, nom, prenom);
        if (!best || score > best.score) best = { profile: cand, score };
      }

      if (best && best.score >= FUZZY_SIMILARITY_THRESHOLD) {
        return {
          action: 'FUZZY_PENDING',
          fuzzyMatch: {
            ligne: row.ligne,
            studentProfileId: best.profile.id,
            userId: best.profile.userId,
            nomFichier: row.nom,
            prenomFichier: row.prenom,
            nomBase: best.profile.user.lastName ?? '',
            prenomBase: best.profile.user.firstName ?? '',
            dateNaissance: row.dateNaissance ?? null,
            matriculeNouveau: row.matricule,
            similarityPercent: Math.round(best.score * 100),
            status: 'PENDING',
          },
        };
      }
    }

    // ── NIVEAU 3 : non-matché ───────────────────────────────────────────────
    throw new Error(`Élève "${row.nom} ${row.prenom}" non trouvé dans l'établissement`);
  }
}
