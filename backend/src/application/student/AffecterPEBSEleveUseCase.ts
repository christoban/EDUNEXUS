import type { PrismaClient } from '@prisma/client';

export interface AffecterPEBSEleveCommande {
  studentUserId: string;
  schoolId: string;
  pebsFiliere: string | null;
}

export class AffecterPEBSEleveUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: AffecterPEBSEleveCommande): Promise<void> {
    const profile = await (this.prisma as any).studentProfile.findFirst({
      where: { userId: cmd.studentUserId, user: { schoolId: cmd.schoolId } },
      select: { id: true },
    });
    if (!profile) throw new Error('Élève introuvable dans cet établissement');

    if (cmd.pebsFiliere !== null && !['FR_PEBS', 'EN_PEBS'].includes(cmd.pebsFiliere)) {
      throw new Error('Valeur pebsFiliere invalide. Utilisez FR_PEBS, EN_PEBS ou null');
    }

    await (this.prisma as any).studentProfile.update({
      where: { id: profile.id },
      data: { pebsFiliere: cmd.pebsFiliere },
    });
  }
}
