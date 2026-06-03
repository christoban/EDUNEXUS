import type { NotificationService } from '@domain/ports/services/NotificationService';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface DemanderRattrapageCommande {
  schoolId: string;
  classId: string;
  subjectId?: string;
  teacherId: string;
  proposedDate: Date;
  proposedStartTime?: string;
  proposedEndTime?: string;
  reason?: string;
}

export class DemanderRattrapageUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async execute(commande: DemanderRattrapageCommande): Promise<void> {
    const enseignant = await this.userRepository.findById(commande.teacherId);
    if (!enseignant) throw new Error('Enseignant introuvable');

    const censeurs = await this.userRepository.findByRole(commande.schoolId, 'STAFF');
    const censeursEtSG = censeurs.filter(
      u => u.aPermission('MANAGE_TIMETABLE') || u.aPermission('MANAGE_ATTENDANCE')
    );

    const dateStr = commande.proposedDate.toLocaleDateString('fr-FR');
    const horaire = commande.proposedStartTime
      ? ` de ${commande.proposedStartTime} à ${commande.proposedEndTime}`
      : '';

    for (const destinataire of censeursEtSG) {
      await this.notificationService.envoyer({
        schoolId: commande.schoolId,
        userId: destinataire.id,
        type: 'SYSTEM',
        titre: 'Demande de cours de rattrapage',
        corps:
          `${enseignant.nomComplet} demande un rattrapage le ${dateStr}${horaire}.` +
          (commande.reason ? ` Motif : ${commande.reason}` : ''),
        canal: 'IN_APP',
        metadata: {
          classId: commande.classId,
          teacherId: commande.teacherId,
          proposedDate: commande.proposedDate.toISOString(),
        },
      });
    }
  }
}
