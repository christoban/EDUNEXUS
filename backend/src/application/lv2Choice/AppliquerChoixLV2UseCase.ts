import type { PrismaClient } from '@prisma/client';
import type { AppliquerChoixCommande } from './types';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';
import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupMembershipRepository } from '@domain/ports/repositories/StudentGroupMembershipRepository';
import { synchroniserAppartenanceLV2 } from '@application/studentGroup/syncGroupMembership';

export class AppliquerChoixLV2UseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly groupSetRepository: StudentGroupSetRepository,
    private readonly groupRepository: StudentGroupRepository,
    private readonly membershipRepository: StudentGroupMembershipRepository,
  ) {}

  async execute(cmd: AppliquerChoixCommande): Promise<{ applied: number }> {
    // Vérifier que la fenêtre existe
    const window = await this.prisma.lv2ChoiceWindow.findUnique({
      where: { id: cmd.windowId },
    });
    if (!window) throw new Error('Fenêtre de choix introuvable');
    if (window.schoolId !== cmd.schoolId) throw new Error('Accès refusé');

    // Récupérer toutes les soumissions de cette fenêtre
    const submissions = await this.prisma.lv2ChoiceSubmission.findMany({
      where: { windowId: cmd.windowId },
    });

    if (submissions.length === 0) {
      throw new Error('Aucune soumission à appliquer');
    }

    // Appliquer chaque choix en mettant à jour lv2SubjectId sur StudentProfile
    const syncRepos = { prisma: this.prisma, groupSetRepository: this.groupSetRepository, groupRepository: this.groupRepository, membershipRepository: this.membershipRepository };
    let applied = 0;
    for (const sub of submissions) {
      try {
        await this.prisma.studentProfile.update({
          where: { id: sub.studentProfileId },
          data: { lv2SubjectId: sub.chosenSubjectId },
        });
        await synchroniserAppartenanceLV2(syncRepos, {
          schoolId: cmd.schoolId, studentProfileId: sub.studentProfileId,
          lv2SubjectId: sub.chosenSubjectId, academicYearId: window.academicYearId,
        });
        applied++;
      } catch {
        // Élève introuvable ou déjà supprimé — ignorer silencieusement
      }
    }

    // Clôturer la fenêtre
    await this.prisma.lv2ChoiceWindow.update({
      where: { id: cmd.windowId },
      data: { status: 'CLOSED' },
    });

    return { applied };
  }
}
