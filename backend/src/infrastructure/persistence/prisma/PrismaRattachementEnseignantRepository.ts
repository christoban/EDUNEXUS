import type { PrismaClient } from '@prisma/client';
import type {
  RattachementEnseignantRepository,
  VerifierRattachementOptions,
} from '@domain/ports/repositories/RattachementEnseignantRepository';

export class PrismaRattachementEnseignantRepository implements RattachementEnseignantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async trouverClasse(classId: string, schoolId: string) {
    return this.prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { id: true, name: true, level: true, serie: true, filiere: true, academicYearId: true },
    }) as Promise<import('@domain/ports/repositories/RattachementEnseignantRepository').ClassePourAffectation | null>;
  }

  async listerCoefficients(params: { schoolId: string; classLevel?: string | null; serieCode: string | null }) {
    return this.prisma.subjectCoefficient.findMany({
      where: {
        schoolId: params.schoolId,
        classLevel: params.classLevel ?? undefined,
        OR: params.serieCode ? [{ serieCode: params.serieCode }, { serieCode: null }] : [{ serieCode: null }],
      },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: { subject: { name: 'asc' } },
    }) as Promise<import('@domain/ports/repositories/RattachementEnseignantRepository').CoefficientAvecMatiere[]>;
  }

  async listerOverrides(classId: string, schoolId: string) {
    return this.prisma.classSubjectOverride.findMany({
      where: { classId, schoolId },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: { subject: { name: 'asc' } },
    }) as Promise<import('@domain/ports/repositories/RattachementEnseignantRepository').OverrideAvecMatiere[]>;
  }

  async listerAffectations(classId: string, schoolId: string) {
    return this.prisma.teachingAssignment.findMany({
      where: { classId, schoolId },
      include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
    }) as Promise<import('@domain/ports/repositories/RattachementEnseignantRepository').AffectationAvecEnseignant[]>;
  }

  async listerEnseignantsEligibles(schoolId: string, subjectId: string) {
    return this.prisma.user.findMany({
      where: {
        schoolId,
        role: 'TEACHER',
        teacherProfile: { teacherSubjects: { some: { subjectId } } },
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }) as Promise<import('@domain/ports/repositories/RattachementEnseignantRepository').EnseignantEligible[]>;
  }

  async verifierEnseignant(teacherId: string, schoolId: string): Promise<boolean> {
    const teacher = await this.prisma.user.findFirst({
      where: { id: teacherId, schoolId, role: 'TEACHER' },
      select: { id: true },
    });
    return !!teacher;
  }

  async assigner(params: { classId: string; subjectId: string; teacherId: string; schoolId: string; academicYearId: string }): Promise<void> {
    await this.prisma.teachingAssignment.upsert({
      where: { classId_subjectId: { classId: params.classId, subjectId: params.subjectId } },
      create: {
        classId: params.classId,
        subjectId: params.subjectId,
        teacherId: params.teacherId,
        schoolId: params.schoolId,
        academicYearId: params.academicYearId,
      },
      update: { teacherId: params.teacherId },
    });
  }

  async retirer(params: { classId: string; subjectId: string; schoolId: string }): Promise<void> {
    await this.prisma.teachingAssignment.deleteMany({
      where: { classId: params.classId, subjectId: params.subjectId, schoolId: params.schoolId },
    });
  }

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
