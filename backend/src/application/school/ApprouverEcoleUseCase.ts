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
    const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const loginUrl = `${clientUrl}/login?subdomain=${encodeURIComponent(school.subdomain)}`;

    const admins = await this.userRepository.findByRole(school.id, 'ADMIN');
    for (const admin of admins) {
      if (admin.email) {
        await this.emailService.envoyer({
          destinataire: admin.email,
          sujet: `🎉 Votre établissement est approuvé — ${school.name}`,
          contenuHtml: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:#1a2e1e;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
                <h1 style="color:white;margin:0;font-size:24px;">🎓 EduNexus</h1>
              </div>
              <div style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e8e0d4;">
                <h2 style="color:#1a1209;margin-top:0;">Félicitations ${admin.nomComplet} !</h2>
                <p style="color:#6b5c45;font-size:16px;line-height:1.6;">
                  La demande d'inscription de <strong>${school.name}</strong> a été <strong style="color:#059669;">approuvée</strong>.
                  Votre espace est désormais actif sur EduNexus.
                </p>
                <div style="text-align:center;margin:32px 0;">
                  <a href="${loginUrl}" style="background:linear-gradient(135deg,#059669,#047857);color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
                    🚀 Accéder à mon espace
                  </a>
                </div>
                <p style="color:#a89478;font-size:13px;">
                  Lien direct : <a href="${loginUrl}" style="color:#059669;">${loginUrl}</a>
                </p>
                <hr style="border:none;border-top:1px solid #e8e0d4;margin:24px 0;" />
                <p style="color:#a89478;font-size:12px;margin:0;">
                  EduNexus · Plateforme de gestion scolaire · Cameroun
                </p>
              </div>
            </div>
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
