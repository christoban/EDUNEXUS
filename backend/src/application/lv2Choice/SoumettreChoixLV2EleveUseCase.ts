import type { PrismaClient } from '@prisma/client';
import type { SoumettreChoixCommande } from './types';

export class SoumettreChoixLV2EleveUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: SoumettreChoixCommande): Promise<void> {
    // Récupérer le profil élève
    const profile = await this.prisma.studentProfile.findFirst({
      where: { user: { id: cmd.studentUserId, schoolId: cmd.schoolId } },
      include: {
        user: { select: { schoolId: true } },
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
          select: { classId: true },
          take: 1,
        },
      },
    });
    if (!profile) throw new Error('Profil élève introuvable');

    // Trouver la fenêtre ouverte pour le niveau de l'élève
    const classe = await this.prisma.class.findUnique({ where: { id: profile.enrollmentsYearScoped[0]?.classId ?? '' } });
    if (!classe) throw new Error('Classe introuvable');

    const window = await this.prisma.lv2ChoiceWindow.findFirst({
      where: {
        schoolId: cmd.schoolId,
        level: classe.level,
        status: 'OPEN',
        openDate: { lte: new Date() },
        closeDate: { gte: new Date() },
      },
    });
    if (!window) throw new Error('Aucune fenêtre de choix LV2 ouverte pour votre niveau');

    // Vérifier que la matière existe et est bien une LV2 dans cette école
    const subject = await this.prisma.subject.findFirst({
      where: { id: cmd.chosenSubjectId, schoolId: cmd.schoolId },
    });
    if (!subject) throw new Error('Matière introuvable');

    // Upsert : si déjà soumis, mettre à jour le choix
    await this.prisma.lv2ChoiceSubmission.upsert({
      where: {
        windowId_studentProfileId: { windowId: window.id, studentProfileId: profile.id },
      },
      create: {
        windowId: window.id,
        studentProfileId: profile.id,
        chosenSubjectId: cmd.chosenSubjectId,
        submissionMethod: 'STUDENT_DIRECT',
      },
      update: {
        chosenSubjectId: cmd.chosenSubjectId,
        submittedAt: new Date(),
      },
    });
  }
}
