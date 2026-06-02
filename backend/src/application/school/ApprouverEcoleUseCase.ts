/**
 * APPLICATION LAYER — Use Case : Approuver une école (MasterAdmin)
 * PENDING → APPROVED → ACTIVE
 * Déclenche la configuration automatique atomique post-approbation.
 */
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { EmailService } from '@domain/ports/services/EmailService';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface ApprouverEcoleCommande {
  schoolId: string;
  masterAdminId: string;
}

export interface ApprouverEcoleResultat {
  schoolId: string;
  subdomain: string;
  message: string;
}

export class ApprouverEcoleUseCase {
  constructor(
    private readonly schoolRepository: SchoolRepository,
    private readonly userRepository: UserRepository,
    private readonly anneeAcademiqueRepository: AnneeAcademiqueRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(commande: ApprouverEcoleCommande): Promise<ApprouverEcoleResultat> {
    // 1. Charger l'école
    const school = await this.schoolRepository.findById(commande.schoolId);
    if (!school) {
      throw new Error(`École introuvable : ${commande.schoolId}`);
    }

    // 2. Approuver puis activer (workflow dans l'entité)
    school.approuver();
    school.activer();
    await this.schoolRepository.update(school);

    // 3. Créer l'année académique courante
    const anneeEnCours = new Date().getFullYear();
    const annee = {
      id: crypto.randomUUID(),
      schoolId: school.id,
      name: `${anneeEnCours}-${anneeEnCours + 1}`,
      startDate: new Date(`${anneeEnCours}-09-01`),
      endDate: new Date(`${anneeEnCours + 1}-07-31`),
      isCurrent: true,
      status: 'ACTIVE' as const,
    };
    await this.anneeAcademiqueRepository.save(annee);

    // 4. Notifier l'Admin de l'école
    const admins = await this.userRepository.findByRole(school.id, 'ADMIN');
    for (const admin of admins) {
      if (admin.email) {
        await this.emailService.envoyer({
          destinataire: admin.email,
          sujet: `🎉 Bienvenue sur EduNexus — ${school.name}`,
          contenuHtml: `
            <h2>Félicitations ${admin.nomComplet} !</h2>
            <p>L'établissement <strong>${school.name}</strong> est maintenant actif sur EduNexus.</p>
            <p>Connectez-vous sur : <strong>https://${school.subdomain}.edunexus.cm</strong></p>
          `,
        });
      }
    }

    return {
      schoolId: school.id,
      subdomain: school.subdomain,
      message: `École "${school.name}" activée avec succès`,
    };
  }
}
