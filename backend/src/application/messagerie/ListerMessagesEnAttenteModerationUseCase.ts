import type { PrismaClient } from '@prisma/client';

export interface ListerMessagesEnAttenteModerationCommande {
  schoolId: string;
  appelantRole: string;
}

/** File d'attente de modération pour le Staff/Admin — n'a de sens que si activée pour l'école. */
export class ListerMessagesEnAttenteModerationUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: ListerMessagesEnAttenteModerationCommande) {
    if (!['ADMIN', 'STAFF'].includes(cmd.appelantRole.toUpperCase())) {
      throw new Error('Seuls Admin et Staff peuvent consulter la file de modération.');
    }

    return (this.prisma as any).message.findMany({
      where: { moderationStatus: 'PENDING', conversation: { schoolId: cmd.schoolId } },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true } },
        conversation: { select: { id: true, type: true, name: true, classId: true } },
      },
    });
  }
}
