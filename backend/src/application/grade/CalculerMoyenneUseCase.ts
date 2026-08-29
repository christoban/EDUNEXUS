import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import { calculateAverageScoreOn20 } from '@domain/rules/GradingEngine';

export interface CalculerMoyenneCommande {
  schoolId: string;
  studentId: string;
  classId: string;
  sequenceId: string;
}

export interface CalculerMoyenneResultat {
  average: number;
  rank: number;
  totalStudents: number;
}

export class CalculerMoyenneUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly matiereRepository: MatiereRepository,
  ) {}

  async execute(commande: CalculerMoyenneCommande): Promise<CalculerMoyenneResultat> {
    const { schoolId, studentId, classId, sequenceId } = commande;

    const grades = await this.noteRepository.findByStatuts(
      classId,
      sequenceId,
      ['LOCKED'],
    );

    const studentGrades = grades.filter(g => g.studentId === studentId);

    if (!studentGrades.length) {
      return { average: 0, rank: 0, totalStudents: 0 };
    }

    const subjectIds = [...new Set(studentGrades.map(g => g.subjectId))];
    const subjectCoefficients = new Map<string, number>();
    await Promise.all(
      subjectIds.map(async (id) => {
        const subject = await this.matiereRepository.findById(id);
        subjectCoefficients.set(id, subject?.coefficient ?? 1);
      }),
    );

    const average = calculateAverageScoreOn20(
      studentGrades.map((g) => {
        const scoreOn20 = g.sequenceAverage ?? 0;
        return {
          scoreOn20,
          percentage: scoreOn20 * 5,
          coefficient: g.coefficient ?? subjectCoefficients.get(g.subjectId) ?? 1,
        };
      }),
      true,
    );

    const classmates = await this.noteRepository.findClassmatesAverages(
      classId,
      sequenceId,
      schoolId,
    );

    const sorted = [...classmates].sort((a, b) => b.average - a.average);
    const rank = sorted.findIndex(c => c.studentId === studentId) + 1;

    return { average, rank: rank || 0, totalStudents: sorted.length };
  }
}
