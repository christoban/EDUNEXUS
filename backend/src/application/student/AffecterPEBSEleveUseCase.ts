import type { PrismaClient } from '@prisma/client';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';
import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupMembershipRepository } from '@domain/ports/repositories/StudentGroupMembershipRepository';
import { synchroniserAppartenanceProgramme } from '@application/studentGroup/syncGroupMembership';

export interface AffecterPEBSEleveCommande {
  studentUserId: string;
  schoolId: string;
  pebsFiliere: string | null;
}

export class AffecterPEBSEleveUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly groupSetRepository: StudentGroupSetRepository,
    private readonly groupRepository: StudentGroupRepository,
    private readonly membershipRepository: StudentGroupMembershipRepository,
  ) {}

  async execute(cmd: AffecterPEBSEleveCommande): Promise<void> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId: cmd.studentUserId, user: { schoolId: cmd.schoolId } },
      select: { id: true },
    });
    if (!profile) throw new Error('Élève introuvable dans cet établissement');

    if (cmd.pebsFiliere !== null && !['FR_PEBS', 'EN_PEBS'].includes(cmd.pebsFiliere)) {
      throw new Error('Valeur pebsFiliere invalide. Utilisez FR_PEBS, EN_PEBS ou null');
    }

    await this.prisma.studentProfile.update({
      where: { id: profile.id },
      data: { pebsFiliere: cmd.pebsFiliere },
    });

    await synchroniserAppartenanceProgramme(
      { prisma: this.prisma, groupSetRepository: this.groupSetRepository, groupRepository: this.groupRepository, membershipRepository: this.membershipRepository },
      { schoolId: cmd.schoolId, studentProfileId: profile.id, pebsFiliere: cmd.pebsFiliere }
    );
  }
}
