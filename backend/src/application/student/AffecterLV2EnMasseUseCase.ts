import type { PrismaClient } from '@prisma/client';

export interface AffecterLV2EnMasseCommande {
  studentUserIds: string[];
  schoolId: string;
  lv2SubjectId: string | null;
}

export interface AffecterLV2EnMasseResultat {
  modifies: number;
}

export class AffecterLV2EnMasseUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: AffecterLV2EnMasseCommande): Promise<AffecterLV2EnMasseResultat> {
    if (cmd.studentUserIds.length === 0) return { modifies: 0 };

    if (cmd.lv2SubjectId !== null) {
      const subject = await this.prisma.subject.findFirst({
        where: { id: cmd.lv2SubjectId, schoolId: cmd.schoolId },
        select: { id: true },
      });
      if (!subject) throw new Error('Matière LV2 introuvable dans cet établissement');
    }

    // Vérifier que tous les élèves appartiennent à cette école
    const profiles = await this.prisma.studentProfile.findMany({
      where: {
        userId: { in: cmd.studentUserIds },
        user: { schoolId: cmd.schoolId },
      },
      select: { id: true },
    });

    if (profiles.length === 0) return { modifies: 0 };

    const profileIds = profiles.map((p: any) => p.id);
    const result = await this.prisma.studentProfile.updateMany({
      where: { id: { in: profileIds } },
      data: { lv2SubjectId: cmd.lv2SubjectId },
    });

    return { modifies: result.count };
  }
}
