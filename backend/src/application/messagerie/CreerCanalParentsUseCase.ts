import type { PrismaClient } from '@prisma/client';

export interface CreerCanalParentsCommande {
  schoolId: string;
  classId: string;
  className: string;
}

/** Même principe que CreerCanalClasseUseCase, pour le PARENT_CHANNEL. */
export class CreerCanalParentsUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: CreerCanalParentsCommande) {
    const existant = await this.prisma.conversation.findFirst({
      where: { schoolId: cmd.schoolId, classId: cmd.classId, type: 'PARENT_CHANNEL' },
    });
    if (existant) return existant;

    return this.prisma.conversation.create({
      data: {
        schoolId: cmd.schoolId,
        classId: cmd.classId,
        type: 'PARENT_CHANNEL',
        name: `Parents — ${cmd.className}`,
      },
    });
  }
}
