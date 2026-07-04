import type { PrismaClient } from '@prisma/client';

export interface AffecterLV2EleveCommande {
  studentUserId: string;
  schoolId: string;
  lv2SubjectId: string | null;
}

export class AffecterLV2EleveUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: AffecterLV2EleveCommande): Promise<void> {
    const profile = await (this.prisma as any).studentProfile.findFirst({
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

    await (this.prisma as any).studentProfile.update({
      where: { id: profile.id },
      data: { lv2SubjectId: cmd.lv2SubjectId },
    });
  }
}
