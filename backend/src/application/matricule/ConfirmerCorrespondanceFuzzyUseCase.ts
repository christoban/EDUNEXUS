/**
 * APPLICATION — Use case : Confirmer une correspondance approximative (Niveau 2)
 *
 * L'admin a visuellement vérifié qu'un candidat "fuzzy" (nom similaire, date de
 * naissance identique) est bien le même élève. Applique le matricule et trace la
 * confiance de la correspondance via `matriculeMatchType = 'FUZZY_CONFIRMED'`
 * (distinct des correspondances exactes automatiques).
 */
import type { PrismaClient } from '@prisma/client';
import type { ConfirmerFuzzyCommande, FuzzyMatchCandidate } from './types';

export interface ConfirmerFuzzyResultat {
  studentProfileId: string;
  matricule: string;
}

export class ConfirmerCorrespondanceFuzzyUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: ConfirmerFuzzyCommande): Promise<ConfirmerFuzzyResultat> {
    const job = await (this.prisma as any).matriculeImportJob.findUnique({ where: { id: cmd.jobId } });
    if (!job) throw new Error('Import introuvable');
    if (job.schoolId !== cmd.schoolId) throw new Error('Accès refusé');

    const details = (job.resultDetails ?? { unmatched: [], fuzzyMatches: [] }) as { unmatched: unknown[]; fuzzyMatches: FuzzyMatchCandidate[] };
    const fuzzyMatches = details.fuzzyMatches ?? [];
    const entry = fuzzyMatches.find(f => f.ligne === cmd.ligne);
    if (!entry) throw new Error('Correspondance approximative introuvable pour cette ligne');
    if (entry.status !== 'PENDING') throw new Error(`Cette correspondance a déjà été traitée (statut : ${entry.status})`);

    const profile = await (this.prisma as any).studentProfile.findFirst({
      where: { id: entry.studentProfileId, user: { schoolId: cmd.schoolId } },
    });
    if (!profile) throw new Error('Élève introuvable');
    if (profile.matricule && profile.matricule !== entry.matriculeNouveau) {
      throw new Error(`Cet élève a déjà un matricule différent ("${profile.matricule}") — à traiter manuellement`);
    }

    await (this.prisma as any).studentProfile.update({
      where: { id: profile.id },
      data: { matricule: entry.matriculeNouveau, matriculeSource: 'EXCEL_IMPORT', matriculeMatchType: 'FUZZY_CONFIRMED' },
    });

    entry.status = 'CONFIRMED';
    await (this.prisma as any).matriculeImportJob.update({
      where: { id: job.id },
      data: {
        resultDetails: { ...details, fuzzyMatches },
        matchedRows: job.matchedRows + 1,
        matchedRowsFuzzyConfirmed: job.matchedRowsFuzzyConfirmed + 1,
      },
    });

    return { studentProfileId: profile.id, matricule: entry.matriculeNouveau };
  }
}
