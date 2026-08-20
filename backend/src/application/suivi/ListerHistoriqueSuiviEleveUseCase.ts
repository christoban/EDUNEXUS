import type { PrismaClient } from '@prisma/client';
import type { StudentFollowUpRepository, FollowUpActionDetail } from '@domain/ports/repositories/StudentFollowUpRepository';
import type { AppelantSuivi } from './CreerActionSuiviEleveUseCase';

/**
 * Historique des actions de suivi d'un élève (B.5.3), avec le garde-fou de confidentialité de
 * B.7 appliqué à deux niveaux :
 * 1. Un gate large — le rôle de l'appelant lui donne-t-il un motif légitime de consulter la
 *    fiche de CET élève (même principe que AIController.estAutoriseAVoirRisqueEleve) ?
 * 2. Un filtre ligne par ligne — même si le gate large passe, chaque action individuelle ne
 *    reste visible que pour son créateur, la personne assignée, ou un rôle habilité (censeur,
 *    admin) — un professeur principal ne voit pas l'observation d'un collègue sur le même élève.
 */
export class ListerHistoriqueSuiviEleveUseCase {
  constructor(
    private readonly repo: StudentFollowUpRepository,
    private readonly prisma: PrismaClient,
  ) {}

  async execute(appelant: AppelantSuivi, studentId: string): Promise<FollowUpActionDetail[]> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId: studentId, user: { schoolId: appelant.schoolId } },
      select: {
        id: true,
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
          select: { classId: true },
          take: 1,
        },
      },
    });
    if (!profile) throw new Error('Élève introuvable');
    const classId = profile.enrollmentsYearScoped?.[0]?.classId ?? null;

    if (!(await this.peutConsulterFiche(appelant, classId))) {
      throw new Error('Vous n\'avez pas accès au suivi de cet élève');
    }

    const toutes = await this.repo.listForStudent(profile.id, appelant.schoolId);
    const estRoleHabilite = this.estRoleHabilite(appelant);

    return toutes.filter(
      (a) => estRoleHabilite || a.createdById === appelant.userId || a.assignedToId === appelant.userId,
    );
  }

  private estRoleHabilite(appelant: AppelantSuivi): boolean {
    const role = appelant.role.toUpperCase();
    if (role === 'ADMIN') return true;
    return role === 'STAFF' && (appelant.permissions ?? []).includes('VALIDATE_GRADES');
  }

  private async peutConsulterFiche(appelant: AppelantSuivi, studentClassId: string | null): Promise<boolean> {
    const role = appelant.role.toUpperCase();

    if (role === 'ADMIN') return true;

    if (role === 'STAFF') {
      const perms = appelant.permissions ?? [];
      return perms.includes('VALIDATE_GRADES') || perms.includes('MANAGE_ORIENTATION') || perms.includes('MANAGE_PEDAGOGICAL_BRIEF');
    }

    if (role === 'TEACHER') {
      if (!studentClassId) return false;
      const [assignment, estProfPrincipal] = await Promise.all([
        this.prisma.teachingAssignment.findFirst({ where: { teacherId: appelant.userId, classId: studentClassId }, select: { id: true } }),
        this.prisma.class.findFirst({ where: { id: studentClassId, professorPrincipalId: appelant.userId }, select: { id: true } }),
      ]);
      return !!assignment || !!estProfPrincipal;
    }

    return false;
  }
}
