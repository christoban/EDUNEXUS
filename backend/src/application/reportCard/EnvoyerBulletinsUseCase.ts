/**
 * APPLICATION LAYER — Use Case : Envoyer les bulletins aux parents
 * Envoie les PDFs par email à tous les parents d'une classe.
 */
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { EmailService } from '@domain/ports/services/EmailService';

export interface EnvoyerBulletinsCommande {
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  nomEtablissement: string;
  nomPeriode: string;
  /** Langue de l'email (résolue par l'appelant : sous-système + section de la classe). Défaut 'fr'. */
  langue?: 'fr' | 'en';
}

export interface EnvoyerBulletinsResultat {
  envoyes: number;
  echoues: number;
}

export class EnvoyerBulletinsUseCase {
  constructor(
    private readonly bulletinRepository: BulletinRepository,
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(commande: EnvoyerBulletinsCommande): Promise<EnvoyerBulletinsResultat> {
    const bulletins = await this.bulletinRepository.findByClasse(
      commande.classId,
      commande.academicPeriodId
    );

    const generes = bulletins.filter((b) => b.estGenere() && !b.estEnvoye());

    let envoyes = 0;
    let echoues = 0;

    for (const bulletin of generes) {
      try {
        const eleve = await this.userRepository.findById(bulletin.studentId);
        if (!eleve) continue;

        // Envoi aux parents — pas à l'élève (qui souvent n'a pas d'email au Cameroun)
        const emailsParents = await this.userRepository.findEmailsParentsParEleve(bulletin.studentId);

        // Fallback : si aucun parent avec email, essayer l'email de l'élève lui-même
        const destinataires = emailsParents.length > 0
          ? emailsParents
          : eleve.email ? [eleve.email] : [];

        if (destinataires.length === 0) continue;

        const langue = commande.langue ?? 'fr';
        const sujet = langue === 'fr'
          ? `Bulletin scolaire — ${commande.nomPeriode} — ${commande.nomEtablissement}`
          : `Report card — ${commande.nomPeriode} — ${commande.nomEtablissement}`;
        const contenuHtml = langue === 'fr'
          ? `
          <p>Bonjour,</p>
          <p>Veuillez trouver ci-joint le bulletin scolaire de <strong>${eleve.nomComplet}</strong>
          pour la période : <strong>${commande.nomPeriode}</strong>.</p>
          <p>Cordialement,<br/>${commande.nomEtablissement}</p>
        `
          : `
          <p>Hello,</p>
          <p>Please find attached the report card of <strong>${eleve.nomComplet}</strong>
          for the period: <strong>${commande.nomPeriode}</strong>.</p>
          <p>Best regards,<br/>${commande.nomEtablissement}</p>
        `;

        for (const email of destinataires) {
          await this.emailService.envoyer({
            destinataire: email,
            sujet,
            contenuHtml,
          });
        }

        bulletin.marquerEnvoye();
        await this.bulletinRepository.update(bulletin);
        envoyes++;
      } catch {
        echoues++;
      }
    }

    return { envoyes, echoues };
  }
}