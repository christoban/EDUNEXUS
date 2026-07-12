import type { PrismaClient } from '@prisma/client';
import type { AjouterCandidatsPebsCommande } from './types';

export class AjouterCandidatsPebsUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: AjouterCandidatsPebsCommande): Promise<{ added: number }> {
    const session = await (this.prisma as any).pebsExamSession.findUnique({
      where: { id: cmd.sessionId },
    });
    if (!session) throw new Error('Session PEBS introuvable');
    if (session.schoolId !== cmd.schoolId) throw new Error('Accès refusé');
    if (session.status === 'APPLIED') throw new Error('La session a déjà été appliquée');

    let added = 0;
    for (const profileId of cmd.studentProfileIds) {
      try {
        // Vérifier que le profil appartient à l'école
        const profile = await (this.prisma as any).studentProfile.findFirst({
          where: { id: profileId, user: { schoolId: cmd.schoolId } },
        });
        if (!profile) continue;

        // Vérifier doublon
        const existing = await (this.prisma as any).pebsExamCandidate.findFirst({
          where: { sessionId: cmd.sessionId, studentProfileId: profileId },
        });
        if (existing) continue;

        await (this.prisma as any).pebsExamCandidate.create({
          data: {
            sessionId: cmd.sessionId,
            studentProfileId: profileId,
            currentClassId: profile.classId,
            selectionResult: 'PENDING',
          },
        });
        added++;
      } catch {
        // Erreur sur un candidat — continuer
      }
    }

    if (session.status === 'DRAFT' && added > 0) {
      await (this.prisma as any).pebsExamSession.update({
        where: { id: cmd.sessionId },
        data: { status: 'RESULTS_PENDING' },
      });
    }

    return { added };
  }
}
