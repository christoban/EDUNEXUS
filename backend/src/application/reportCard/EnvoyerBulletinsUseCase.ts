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
        if (!eleve?.email) continue;

        await this.emailService.envoyer({
          destinataire: eleve.email,
          sujet: `Bulletin scolaire — ${commande.nomPeriode} — ${commande.nomEtablissement}`,
          contenuHtml: `
            <p>Bonjour,</p>
            <p>Veuillez trouver ci-joint le bulletin scolaire de <strong>${eleve.nomComplet}</strong>
            pour la période : <strong>${commande.nomPeriode}</strong>.</p>
            <p>Cordialement,<br/>${commande.nomEtablissement}</p>
          `,
        });

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