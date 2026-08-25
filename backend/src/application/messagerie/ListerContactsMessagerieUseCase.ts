import type { MessagerieRepository } from '@domain/ports/repositories/MessagerieRepository';

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
  constructor(private readonly messagerieRepository: MessagerieRepository) {}

  async execute(cmd: ListerContactsMessagerieCommande) {
    const autorises = await this.messagerieRepository.destinatairesAutorises(cmd.schoolId, cmd.appelantId, cmd.appelantRole);

    const where: Record<string, unknown> = {
      schoolId: cmd.schoolId,
      isActive: true,
      id: { not: cmd.appelantId, ...(autorises ? { in: Array.from(autorises) } : {}) },
    };

    return this.messagerieRepository.listerContacts(where);
  }
}
