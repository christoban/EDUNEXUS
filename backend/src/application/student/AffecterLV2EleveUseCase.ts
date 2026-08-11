import type { PrismaClient } from '@prisma/client';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';
import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupMembershipRepository } from '@domain/ports/repositories/StudentGroupMembershipRepository';
import { synchroniserAppartenanceLV2 } from '@application/studentGroup/syncGroupMembership';

export interface AffecterLV2EleveCommande {
  studentUserId: string;
  schoolId: string;
  lv2SubjectId: string | null;
}

export class AffecterLV2EleveUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly groupSetRepository: StudentGroupSetRepository,
    private readonly groupRepository: StudentGroupRepository,
    private readonly membershipRepository: StudentGroupMembershipRepository,
  ) {}

  async execute(cmd: AffecterLV2EleveCommande): Promise<void> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId: cmd.studentUserId, user: { schoolId: cmd.schoolId } },
      select: { id: true },
    });
    if (!profile) throw new Error('Élève introuvable dans cet établissement');

    if (cmd.lv2SubjectId !== null) {
      const subject = await this.prisma.subject.findFirst({
        where: { id: cmd.lv2SubjectId, schoolId: cmd.schoolId },
        select: { id: true },
      });
      if (!subject) throw new Error('Matière LV2 introuvable dans cet établissement');
    }

    await this.prisma.studentProfile.update({
      where: { id: profile.id },
      data: { lv2SubjectId: cmd.lv2SubjectId },
    });

    await synchroniserAppartenanceLV2(
      { prisma: this.prisma, groupSetRepository: this.groupSetRepository, groupRepository: this.groupRepository, membershipRepository: this.membershipRepository },
      { schoolId: cmd.schoolId, studentProfileId: profile.id, lv2SubjectId: cmd.lv2SubjectId }
    );
  }
}
