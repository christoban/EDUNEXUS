import type { NotificationService } from '@domain/ports/services/NotificationService';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { Language } from '../../utils/languageHelper';

export interface DemanderRattrapageCommande {
  schoolId: string;
  classId: string;
  subjectId?: string;
  teacherId: string;
  proposedDate: Date;
  proposedStartTime?: string;
  proposedEndTime?: string;
  reason?: string;
  lang?: Language;
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

    const lang = commande.lang ?? 'fr';
    const dateStr = commande.proposedDate.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR');
    const horaire = commande.proposedStartTime
      ? (lang === 'en'
        ? ` from ${commande.proposedStartTime} to ${commande.proposedEndTime}`
        : ` de ${commande.proposedStartTime} à ${commande.proposedEndTime}`)
      : '';
    const titre = lang === 'en' ? 'Make-up class request' : 'Demande de cours de rattrapage';

    for (const destinataire of censeursEtSG) {
      await this.notificationService.envoyer({
        schoolId: commande.schoolId,
        userId: destinataire.id,
        type: 'SYSTEM',
        titre,
        corps:
          `${enseignant.nomComplet} ${lang === 'en' ? 'requests a make-up class on' : 'demande un rattrapage le'} ${dateStr}${horaire}.` +
          (commande.reason ? (lang === 'en' ? ` Reason: ${commande.reason}` : ` Motif : ${commande.reason}`) : ''),
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
