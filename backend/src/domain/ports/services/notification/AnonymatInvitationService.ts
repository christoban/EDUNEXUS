import type { AnonymatInvitationPort } from '@domain/ports/services/AnonymatInvitationPort';
import type { EmailService } from '@domain/ports/services/EmailService';
// adapte les noms exacts de ton EmailService

export class AnonymatInvitationService implements AnonymatInvitationPort {
  constructor(private readonly emailService: EmailService) {}

  async envoyerInvitationAnonymat(params: {
    email: string;
    listUrl: string;
    schoolName: string;
    expiresAt: Date;
  }): Promise<void> {
    const expiryLabel = params.expiresAt.toLocaleString('fr-FR');
    await this.emailService.envoyer({
      destinataire: params.email,
      sujet: `Liste d'anonymisation – ${params.schoolName}`,
      contenuTexte:
        `Bonjour,\n\nVoici votre lien pour la liste d'anonymisation (valable jusqu'au ${expiryLabel}) :\n` +
        `${params.listUrl}\n\nAprès avoir apposé les codes sur les copies, cliquez sur « J'ai terminé ».`,
      contenuHtml:
        `<p>Bonjour,</p><p><a href="${params.listUrl}">Ouvrir ma liste d'anonymisation</a></p>` +
        `<p>Lien valable jusqu'au ${expiryLabel}. Cliquez sur « J'ai terminé » une fois les codes apposés.</p>`,
      eventType: 'anonymat_team_invite',
      metadata: {},
    });
  }
}