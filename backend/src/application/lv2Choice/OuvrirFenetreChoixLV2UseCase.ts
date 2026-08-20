import type { PrismaClient } from '@prisma/client';
import type { OuvrirFenetreCommande } from './types';

interface EleveConcerne { studentUserId: string; studentName: string }

export class OuvrirFenetreChoixLV2UseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: OuvrirFenetreCommande): Promise<{ windowId: string; level: string; closeDate: Date; eleves: EleveConcerne[] }> {
    // Vérifier qu'aucune fenêtre OPEN n'existe déjà pour ce niveau + année
    const existing = await this.prisma.lv2ChoiceWindow.findFirst({
      where: {
        schoolId: cmd.schoolId,
        level: cmd.level,
        academicYearId: cmd.academicYearId,
        status: 'OPEN',
      },
    });
    if (existing) {
      throw new Error(`Une fenêtre de choix LV2 est déjà ouverte pour le niveau ${cmd.level}`);
    }

    const window = await this.prisma.lv2ChoiceWindow.create({
      data: {
        schoolId: cmd.schoolId,
        level: cmd.level,
        academicYearId: cmd.academicYearId,
        openDate: cmd.openDate,
        closeDate: cmd.closeDate,
        status: 'OPEN',
      },
    });

    // Élèves du niveau concerné — pour notification (SMS aux parents). StudentProfile n'a pas
    // de schoolId propre : l'établissement se filtre via la relation user.
    const eleves: any[] = await this.prisma.studentProfile.findMany({
      where: {
        user: { schoolId: cmd.schoolId },
        enrollmentsYearScoped: {
          some: { status: 'ACTIVE', academicYear: { isCurrent: true }, class: { level: cmd.level } },
        },
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });

    return {
      windowId: window.id,
      level: cmd.level,
      closeDate: cmd.closeDate,
      eleves: eleves.filter(e => e.user).map(e => ({ studentUserId: e.user.id, studentName: `${e.user.firstName} ${e.user.lastName}` })),
    };
  }
}
