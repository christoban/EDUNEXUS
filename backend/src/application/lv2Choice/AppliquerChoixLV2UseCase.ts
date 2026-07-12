import type { PrismaClient } from '@prisma/client';
import type { AppliquerChoixCommande } from './types';

export class AppliquerChoixLV2UseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: AppliquerChoixCommande): Promise<{ applied: number }> {
    // Vérifier que la fenêtre existe
    const window = await (this.prisma as any).lv2ChoiceWindow.findUnique({
      where: { id: cmd.windowId },
    });
    if (!window) throw new Error('Fenêtre de choix introuvable');
    if (window.schoolId !== cmd.schoolId) throw new Error('Accès refusé');

    // Récupérer toutes les soumissions de cette fenêtre
    const submissions = await (this.prisma as any).lv2ChoiceSubmission.findMany({
      where: { windowId: cmd.windowId },
    });

    if (submissions.length === 0) {
      throw new Error('Aucune soumission à appliquer');
    }

    // Appliquer chaque choix en mettant à jour lv2SubjectId sur StudentProfile
    let applied = 0;
    for (const sub of submissions) {
      try {
        await (this.prisma as any).studentProfile.update({
          where: { id: sub.studentProfileId },
          data: { lv2SubjectId: sub.chosenSubjectId },
        });
        applied++;
      } catch {
        // Élève introuvable ou déjà supprimé — ignorer silencieusement
      }
    }

    // Clôturer la fenêtre
    await (this.prisma as any).lv2ChoiceWindow.update({
      where: { id: cmd.windowId },
      data: { status: 'CLOSED' },
    });

    return { applied };
  }
}
