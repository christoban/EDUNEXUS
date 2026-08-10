import type { PrismaClient } from '@prisma/client';

/**
 * Regroupement A-Level : tous les élèves ayant une matière A-Level donnée dans leur sélection,
 * potentiellement issus de plusieurs classes (équivalent A-Level de la logique de regroupement LV2).
 * Sert à la saisie de notes et présences par matière sur les créneaux électifs.
 */
export interface EleveALevel {
  id: string;          // userId
  firstName: string;
  lastName: string;
  className: string | null;
}

export interface GetElevesParMatiereResultat {
  subjectId: string;
  subjectName: string;
  eleves: EleveALevel[];
}

export class GetElevesParMatiereALevelUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(subjectId: string, schoolId: string, classId?: string): Promise<GetElevesParMatiereResultat> {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, schoolId },
      select: { id: true, name: true },
    });
    if (!subject) throw new Error('Matière introuvable dans cet établissement');

    const links = await this.prisma.studentALevelSubject.findMany({
      where: {
        subjectId,
        student: {
          user: { schoolId, isActive: true },
          ...(classId ? { classId } : {}),
        },
      },
      select: {
        student: {
          select: {
            class: { select: { name: true } },
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    const eleves: EleveALevel[] = links
      .map((l: any) => ({
        id: l.student.user.id,
        firstName: l.student.user.firstName,
        lastName: l.student.user.lastName,
        className: l.student.class?.name ?? null,
      }))
      .sort((a: EleveALevel, b: EleveALevel) =>
        a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

    return { subjectId: subject.id, subjectName: subject.name, eleves };
  }
}
