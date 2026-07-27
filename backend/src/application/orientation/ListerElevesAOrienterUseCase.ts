import type { PrismaClient } from '@prisma/client';
import type { OrientationCheckpointType } from '@domain/entities/FicheOrientation';

export interface EleveAOrienter {
  studentId: string;
  firstName: string;
  lastName: string;
  className: string;
  hasRecommendation: boolean;
  recommendationStatus: string | null;
}

/**
 * Détermine les élèves éligibles à un checkpoint (niveau/série de leur classe actuelle) et
 * indique s'ils ont déjà une recommandation — sert à la fois de filet de sécurité pour le
 * conseiller (A.1.3 point 5) et de base au déclenchement automatique du moteur (Phase 4).
 */
export class ListerElevesAOrienterUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  static eligibiliteWhere(checkpointType: OrientationCheckpointType) {
    return checkpointType === 'FIN_TROISIEME'
      ? { level: '3e' }
      : { level: '2nde', serie: 'C' };
  }

  async execute(params: { schoolId: string; checkpointType: OrientationCheckpointType; academicYearId: string }): Promise<EleveAOrienter[]> {
    const eleves = await this.prisma.studentProfile.findMany({
      where: {
        studentStatus: 'ACTIVE',
        class: ListerElevesAOrienterUseCase.eligibiliteWhere(params.checkpointType),
        user: { schoolId: params.schoolId },
      },
      select: {
        userId: true,
        class: { select: { name: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    });
    if (eleves.length === 0) return [];

    const studentIds = eleves.map((e) => e.userId);
    const recommandations = await this.prisma.recommandationSerie.findMany({
      where: {
        studentId: { in: studentIds },
        checkpointType: params.checkpointType,
        fiche: { academicYearId: params.academicYearId },
      },
      select: { studentId: true, status: true },
    });
    const recoByStudent = new Map(recommandations.map((r) => [r.studentId, r.status]));

    return eleves.map((e) => ({
      studentId: e.userId,
      firstName: e.user.firstName,
      lastName: e.user.lastName,
      className: e.class?.name ?? '—',
      hasRecommendation: recoByStudent.has(e.userId),
      recommendationStatus: recoByStudent.get(e.userId) ?? null,
    }));
  }
}
