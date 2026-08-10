import type { PrismaClient } from '@prisma/client';
import type { CalculerAdmissionCommande } from './types';

export class CalculerAdmissionConcoursUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: CalculerAdmissionCommande): Promise<{ admis: number; nonAdmis: number; admisCandidats: { id: string; firstName: string; lastName: string; parentPhone: string | null }[] }> {
    const session = await this.prisma.entranceExamSession.findUnique({
      where: { id: cmd.sessionId },
    });
    if (!session) throw new Error('Session de concours introuvable');
    if (session.schoolId !== cmd.schoolId) throw new Error('Accès refusé');

    const threshold = session.admissionThreshold;
    const seats = session.availableSeats;

    // Récupérer tous les candidats avec une note
    const candidates: any[] = await this.prisma.entranceExamCandidate.findMany({
      where: { sessionId: cmd.sessionId, examScore: { not: null } },
      orderBy: { examScore: 'desc' },
    });

    if (candidates.length === 0) {
      throw new Error('Aucun candidat avec une note à traiter');
    }

    let admis = 0;
    let nonAdmis = 0;
    let seatsUsed = 0;
    const admisCandidats: { id: string; firstName: string; lastName: string; parentPhone: string | null }[] = [];

    for (const c of candidates) {
      let qualifies = false;

      // Critère 1 : seuil de notes
      if (threshold !== null && threshold !== undefined) {
        qualifies = (c.examScore ?? 0) >= threshold;
      } else {
        qualifies = true; // Pas de seuil = tout le monde passe
      }

      // Critère 2 : nombre de places
      if (qualifies && seats !== null && seats !== undefined) {
        qualifies = seatsUsed < seats;
      }

      const newStatus = qualifies ? 'ADMIS_PROVISOIRE' : 'PENDING';

      await this.prisma.entranceExamCandidate.update({
        where: { id: c.id },
        data: { admissionStatus: newStatus },
      });

      if (qualifies) {
        seatsUsed++;
        admis++;
        admisCandidats.push({ id: c.id, firstName: c.firstName, lastName: c.lastName, parentPhone: c.parentPhone ?? null });
      } else {
        nonAdmis++;
      }
    }

    return { admis, nonAdmis, admisCandidats };
  }
}
