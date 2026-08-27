import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';

export interface VerifierDisponibiliteInput {
  classId: string;
  schoolId: string;
  academicPeriodId?: string;
}

export interface VerifierDisponibiliteResult {
  canGenerateReportCard: boolean;
  periodId: string;
  stats: { total: number; DRAFT: number; SUBMITTED: number; VALIDATED: number; LOCKED: number; REJECTED: number };
  conseilLocked: boolean;
  reason: string | null;
  // aliases for spec
  allNotesValidees: boolean;
  allConseilsVerrouilles: boolean;
  sequences: { id: string }[];
}

export class VerifierDisponibiliteBulletinUseCase {
  constructor(
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly noteRepository: NoteRepository,
    private readonly classCouncilRepository: ClassCouncilRepository,
  ) {}

  async execute(input: VerifierDisponibiliteInput): Promise<VerifierDisponibiliteResult> {
    let periodId = input.academicPeriodId;

    if (!periodId) {
      const currentYear = await this.anneeRepository.findCourante(input.schoolId);
      if (currentYear) {
        const periodes = await this.anneeRepository.findPeriodesByAnnee(currentYear.id);
        periodId = periodes[0]?.id;
      }
    }

    if (!periodId) throw new Error('Aucune période académique trouvée');

    const sequences = await this.anneeRepository.findSequencesByPeriode(periodId);
    const sequenceIds = sequences.map((s) => s.id);

    const stats = await this.noteRepository.getStatsValidationParClasse(input.classId, input.schoolId, sequenceIds);
    const conseilLocked = await this.classCouncilRepository.sessionVerrouilleeExiste(input.classId, periodId);

    const allValidated = stats.total > 0 && stats.DRAFT === 0 && stats.SUBMITTED === 0 && stats.REJECTED === 0;
    const canGenerateReportCard = allValidated && !!conseilLocked;

    return {
      canGenerateReportCard,
      periodId,
      stats,
      conseilLocked: !!conseilLocked,
      reason: !allValidated
        ? 'Notes non entièrement validées'
        : !conseilLocked
          ? 'Conseil de classe non verrouillé'
          : null,
      allNotesValidees: allValidated,
      allConseilsVerrouilles: !!conseilLocked,
      sequences: sequences.map((s) => ({ id: s.id })),
    };
  }
}
