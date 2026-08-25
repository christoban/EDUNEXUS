import type { PrismaClient } from '@prisma/client';
import type {
  ImportUtilisateursRepository,
  ImportContexte,
  AffectationPedagogiqueData,
} from '@domain/ports/repositories/ImportUtilisateursRepository';

export class PrismaImportUtilisateursRepository implements ImportUtilisateursRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async chargerContexte(schoolId: string): Promise<ImportContexte> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, subdomain: true, hasPEBSFrancophone: true, hasPEBSAnglophone: true },
    });
    const classes = await this.prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true } });
    const lv2Subjects = await this.prisma.subject.findMany({
      where: { schoolId, isLV2: true },
      select: { id: true, name: true },
    });
    return {
      schoolName: school?.name ?? 'ZekoulABia',
      hasPEBS: !!(school?.hasPEBSFrancophone || school?.hasPEBSAnglophone),
      classes,
      lv2Subjects,
    };
  }

  async findParentParEmail(schoolId: string, email: string): Promise<string | null> {
    const existingParent = await this.prisma.user.findFirst({
      where: { schoolId, email, role: 'PARENT' },
      select: { id: true },
    });
    return existingParent?.id ?? null;
  }

  async findStudentProfileId(userId: string): Promise<string | null> {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  async updatePeBSFiliere(userId: string, pebsFiliere: string): Promise<void> {
    await this.prisma.studentProfile.updateMany({
      where: { userId },
      data: { pebsFiliere },
    });
  }

  async updateLv2Subject(userId: string, lv2SubjectId: string): Promise<void> {
    await this.prisma.studentProfile.updateMany({
      where: { userId },
      data: { lv2SubjectId },
    });
  }

  async findSubjectsParNoms(schoolId: string, noms: string[]): Promise<{ id: string; name: string }[]> {
    return this.prisma.subject.findMany({
      where: { schoolId, name: { in: noms } },
      select: { id: true, name: true },
    });
  }

  async findClassePourPP(schoolId: string, name: string): Promise<{ id: string; professorPrincipalId: string | null } | null> {
    return this.prisma.class.findFirst({
      where: { schoolId, name },
      select: { id: true, professorPrincipalId: true },
    });
  }

  async findNomProfesseurPrincipal(userId: string): Promise<string | null> {
    const pp = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    return pp ? `${pp.firstName} ${pp.lastName}` : null;
  }

  async findAutreClasseDePP(teacherId: string, schoolId: string, excludeClassId: string): Promise<{ name: string } | null> {
    return this.prisma.class.findFirst({
      where: { professorPrincipalId: teacherId, schoolId, id: { not: excludeClassId } },
      select: { name: true },
    });
  }

  async assignerProfesseurPrincipal(classId: string, teacherId: string): Promise<void> {
    await this.prisma.class.update({
      where: { id: classId },
      data: { professorPrincipalId: teacherId },
    });
  }

  async findClasseProgramme(schoolId: string, name: string): Promise<{ id: string; level: string | null; serie: string | null; filiere: string | null; academicYearId: string } | null> {
    return this.prisma.class.findFirst({
      where: { schoolId, name },
      select: { id: true, level: true, serie: true, filiere: true, academicYearId: true },
    });
  }

  async findSubjectsDuProgramme(schoolId: string, level: string | null, codeSerie: string | null, classId: string): Promise<string[]> {
    const [coefficients, overrides] = await Promise.all([
      this.prisma.subjectCoefficient.findMany({
        where: {
          schoolId,
          classLevel: level ?? undefined,
          OR: [{ serieCode: codeSerie }, { serieCode: null }],
        },
        select: { subjectId: true },
      }),
      this.prisma.classSubjectOverride.findMany({
        where: { classId, schoolId },
        select: { subjectId: true },
      }),
    ]);
    return [...new Set([
      ...coefficients.map(c => c.subjectId),
      ...overrides.map(o => o.subjectId),
    ])];
  }

  async creerAffectations(assignments: AffectationPedagogiqueData[]): Promise<number> {
    if (assignments.length === 0) return 0;
    const result = await this.prisma.teachingAssignment.createMany({
      data: assignments,
      skipDuplicates: true,
    });
    return result.count;
  }
}
