import type { PrismaClient } from '@prisma/client';
import type { AjouterCandidatsCommande } from './types';

export class AjouterCandidatsConcoursUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: AjouterCandidatsCommande): Promise<{ added: number }> {
    // Vérifier que la session existe et appartient à l'école
    const session = await (this.prisma as any).entranceExamSession.findUnique({
      where: { id: cmd.sessionId },
    });
    if (!session) throw new Error('Session de concours introuvable');
    if (session.schoolId !== cmd.schoolId) throw new Error('Accès refusé');
    if (session.status === 'CLOSED') throw new Error('La session est clôturée');

    let added = 0;
    for (const c of cmd.candidats) {
      try {
        await (this.prisma as any).entranceExamCandidate.create({
          data: {
            sessionId: cmd.sessionId,
            firstName: c.firstName,
            lastName: c.lastName,
            dateOfBirth: c.dateOfBirth ?? null,
            originSchool: c.originSchool ?? null,
            examScore: c.examScore ?? null,
            parentPhone: c.parentPhone ?? null,
            admissionStatus: 'PENDING',
            cepResult: 'NON_PASSE',
          },
        });
        added++;
      } catch {
        // Doublon ou erreur sur une ligne — continuer
      }
    }

    // Mettre à jour le statut de la session
    if (session.status === 'DRAFT' && added > 0) {
      await (this.prisma as any).entranceExamSession.update({
        where: { id: cmd.sessionId },
        data: { status: 'RESULTS_PENDING' },
      });
    }

    return { added };
  }
}
