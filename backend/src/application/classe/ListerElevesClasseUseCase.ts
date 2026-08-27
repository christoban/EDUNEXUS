import { calculateAverageScoreOn20 } from '@domain/rules/GradingEngine';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { PresenceRepository } from '@domain/ports/repositories/PresenceRepository';

export interface ListerElevesClasseCommande {
  classId: string;
  schoolId: string;
}

export interface EleveClasseDto {
  id: string;
  firstName: string;
  lastName: string;
  moyenne: number | null;
  tauxPresence: number | null;
  rang: number;
}

export class ListerElevesClasseUseCase {
  constructor(
    private readonly classeRepository: ClasseRepository,
    private readonly userRepository: UserRepository,
    private readonly noteRepository: NoteRepository,
    private readonly presenceRepository: PresenceRepository,
  ) {}

  async execute(cmd: ListerElevesClasseCommande): Promise<EleveClasseDto[]> {
    const classe = await this.classeRepository.findById(cmd.classId);
    if (!classe || classe.schoolId !== cmd.schoolId) {
      throw new Error('Classe introuvable');
    }

    const students = await this.userRepository.findByClass(cmd.schoolId, cmd.classId);
    if (students.length === 0) return [];

    const studentIds = students.map(s => s.id);

    const [grades, attendances] = await Promise.all([
      this.noteRepository.findValideesParClasseEtEleves(cmd.schoolId, cmd.classId, studentIds),
      this.presenceRepository.findByClasseEtEleves(cmd.classId, studentIds),
    ]);

    const gradesByStudent = new Map<string, { sequenceAverage: number | null; coefficient: number }[]>();
    for (const g of grades) {
      if (!gradesByStudent.has(g.studentId)) gradesByStudent.set(g.studentId, []);
      gradesByStudent.get(g.studentId)!.push(g);
    }

    const attByStudent = new Map<string, string[]>();
    for (const a of attendances) {
      if (!attByStudent.has(a.studentId)) attByStudent.set(a.studentId, []);
      attByStudent.get(a.studentId)!.push(a.status);
    }

    const result = students.map(s => {
      const sg = gradesByStudent.get(s.id) ?? [];
      const moyenne = sg.length > 0
        ? calculateAverageScoreOn20(
            sg.map(g => ({ scoreOn20: g.sequenceAverage ?? 0, percentage: 0, coefficient: g.coefficient ?? 1 })),
            true,
          )
        : null;

      const att = attByStudent.get(s.id) ?? [];
      const presents = att.filter(a => a === 'PRESENT').length;
      const tauxPresence = att.length > 0 ? Math.round((presents / att.length) * 100) : null;

      return { id: s.id, firstName: s.firstName, lastName: s.lastName, moyenne, tauxPresence };
    });

    result.sort((a, b) => {
      if (a.moyenne === null && b.moyenne === null) return 0;
      if (a.moyenne === null) return 1;
      if (b.moyenne === null) return -1;
      return b.moyenne - a.moyenne;
    });

    return result.map((s, i) => ({ ...s, rang: i + 1 }));
  }
}
