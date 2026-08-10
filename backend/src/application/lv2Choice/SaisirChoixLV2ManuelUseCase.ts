import type { PrismaClient } from '@prisma/client';
import type { SaisirChoixManuelCommande } from './types';

export class SaisirChoixLV2ManuelUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: SaisirChoixManuelCommande): Promise<void> {
    // Vérifier que la fenêtre existe et est ouverte
    const window = await this.prisma.lv2ChoiceWindow.findUnique({
      where: { id: cmd.windowId },
    });
    if (!window) throw new Error('Fenêtre de choix introuvable');
    if (window.status !== 'OPEN') throw new Error('La fenêtre de choix est clôturée');
    if (window.schoolId !== cmd.schoolId) throw new Error('Accès refusé');

    // Vérifier que l'élève existe et appartient à l'école
    const profile = await this.prisma.studentProfile.findUnique({
      where: { id: cmd.studentProfileId },
      include: { user: { select: { schoolId: true } } },
    });
    if (!profile || profile.user.schoolId !== cmd.schoolId) {
      throw new Error('Élève introuvable');
    }

    // Vérifier que la matière existe
    const subject = await this.prisma.subject.findFirst({
      where: { id: cmd.chosenSubjectId, schoolId: cmd.schoolId },
    });
    if (!subject) throw new Error('Matière introuvable');

    // Upsert avec ADMIN_MANUAL
    await this.prisma.lv2ChoiceSubmission.upsert({
      where: {
        windowId_studentProfileId: { windowId: cmd.windowId, studentProfileId: cmd.studentProfileId },
      },
      create: {
        windowId: cmd.windowId,
        studentProfileId: cmd.studentProfileId,
        chosenSubjectId: cmd.chosenSubjectId,
        submissionMethod: 'ADMIN_MANUAL',
        submittedByUserId: cmd.submittedByUserId,
      },
      update: {
        chosenSubjectId: cmd.chosenSubjectId,
        submissionMethod: 'ADMIN_MANUAL',
        submittedByUserId: cmd.submittedByUserId,
        submittedAt: new Date(),
      },
    });
  }
}
