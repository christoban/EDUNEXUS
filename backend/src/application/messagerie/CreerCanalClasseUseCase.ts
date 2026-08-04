import type { PrismaClient } from '@prisma/client';

export interface CreerCanalClasseCommande {
  schoolId: string;
  classId: string;
  className: string;
}

/**
 * Crée le CLASS_CHANNEL d'une classe — appelé automatiquement à la création de la classe
 * (hook dans CreerClasseUseCase), jamais manuellement. Idempotent : si le canal existe déjà
 * pour cette classe, le retourne tel quel plutôt que d'en créer un second.
 */
export class CreerCanalClasseUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: CreerCanalClasseCommande) {
    const existant = await (this.prisma as any).conversation.findFirst({
      where: { schoolId: cmd.schoolId, classId: cmd.classId, type: 'CLASS_CHANNEL' },
    });
    if (existant) return existant;

    return (this.prisma as any).conversation.create({
      data: {
        schoolId: cmd.schoolId,
        classId: cmd.classId,
        type: 'CLASS_CHANNEL',
        name: `Classe — ${cmd.className}`,
      },
    });
  }
}
