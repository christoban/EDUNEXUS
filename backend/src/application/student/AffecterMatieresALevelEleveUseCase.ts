import type { PrismaClient } from '@prisma/client';

/**
 * Choix individuel des matières A-Level d'un élève (GCE Advanced Level).
 * Règles GCE Board : minimum 3, maximum 5 matières. Remplace la sélection entière (idempotent).
 * Même philosophie que la LV2 : la matière appartient à l'élève, pas à la classe.
 */
export const ALEVEL_MIN_SUBJECTS = 3;
export const ALEVEL_MAX_SUBJECTS = 5;

export interface AffecterMatieresALevelCommande {
  studentUserId: string;
  schoolId: string;
  subjectIds: string[];
}

export class AffecterMatieresALevelEleveUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: AffecterMatieresALevelCommande): Promise<{ count: number }> {
    // Dédoublonnage
    const subjectIds = [...new Set(cmd.subjectIds ?? [])];

    if (subjectIds.length < ALEVEL_MIN_SUBJECTS) {
      throw new Error(`Un élève A-Level doit avoir au moins ${ALEVEL_MIN_SUBJECTS} matières (minimum GCE Board).`);
    }
    if (subjectIds.length > ALEVEL_MAX_SUBJECTS) {
      throw new Error(`Un élève A-Level ne peut avoir plus de ${ALEVEL_MAX_SUBJECTS} matières (maximum GCE Board).`);
    }

    // L'élève doit appartenir à cet établissement
    const profile = await (this.prisma as any).studentProfile.findFirst({
      where: { userId: cmd.studentUserId, user: { schoolId: cmd.schoolId } },
      select: { id: true },
    });
    if (!profile) throw new Error('Élève introuvable dans cet établissement');

    // Les matières doivent appartenir à l'établissement ET être des matières A-Level officielles
    const schoolSubjects = await this.prisma.subject.findMany({
      where: { id: { in: subjectIds }, schoolId: cmd.schoolId },
      select: { id: true, name: true },
    });
    if (schoolSubjects.length !== subjectIds.length) {
      throw new Error('Une ou plusieurs matières sont introuvables dans cet établissement');
    }

    const officialALevel = await (this.prisma as any).aLevelSubject.findMany({ select: { subjectName: true } });
    const officialNames = new Set<string>(officialALevel.map((a: any) => a.subjectName));
    const invalides = schoolSubjects.filter((s) => !officialNames.has(s.name));
    if (invalides.length > 0) {
      throw new Error(`Matière(s) non A-Level : ${invalides.map((s) => s.name).join(', ')}`);
    }

    // Remplacement idempotent de la sélection
    await this.prisma.$transaction(async (tx) => {
      await (tx as any).studentALevelSubject.deleteMany({ where: { studentId: profile.id } });
      await (tx as any).studentALevelSubject.createMany({
        data: subjectIds.map((subjectId) => ({ studentId: profile.id, subjectId })),
      });
    });

    return { count: subjectIds.length };
  }
}
