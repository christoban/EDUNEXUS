import type { PrismaClient } from '@prisma/client';
import { destinatairesAutorises } from './MessagerieAccessHelpers';

export interface ListerContactsMessagerieCommande {
  schoolId: string;
  appelantId: string;
  appelantRole: string;
}

/**
 * Contacts éligibles pour démarrer une conversation privée — alimente le sélecteur de
 * destinataire de NouveauMessagePrive.tsx. Réutilise exactement la même restriction que
 * EnvoyerMessageUseCase (destinatairesAutorises) : un Parent/Élève ne doit même pas VOIR un
 * autre parent/élève dans la liste, pas juste être bloqué à l'envoi.
 */
export class ListerContactsMessagerieUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: ListerContactsMessagerieCommande) {
    const autorises = await destinatairesAutorises(this.prisma, cmd.schoolId, cmd.appelantId, cmd.appelantRole);

    const where: Record<string, unknown> = {
      schoolId: cmd.schoolId,
      isActive: true,
      id: { not: cmd.appelantId, ...(autorises ? { in: Array.from(autorises) } : {}) },
    };

    return (this.prisma as any).user.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
  }
}
