import type { PrismaClient } from '@prisma/client';
import type {
  RattachementEnseignantRepository,
  VerifierRattachementOptions,
} from '@domain/ports/repositories/RattachementEnseignantRepository';

export class PrismaRattachementEnseignantRepository implements RattachementEnseignantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async estRattacheALaClasse(
    teacherId: string,
    classId: string,
    subjectId: string | undefined,
    options: VerifierRattachementOptions,
  ): Promise<boolean> {
    const assignation = await this.prisma.teachingAssignment.findFirst({
      where: { teacherId, classId, ...(subjectId ? { subjectId } : {}) },
      select: { id: true },
    });
    if (assignation) return true;
    if (!options.autoriserProfesseurPrincipal) return false;

    const estProfPrincipal = await this.prisma.class.findFirst({
      where: { id: classId, professorPrincipalId: teacherId },
      select: { id: true },
    });
    return !!estProfPrincipal;
  }
}