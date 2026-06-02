/**
 * APPLICATION LAYER — Use Case : Connecter un utilisateur
 *
 * Logique extraite de controllers/user.ts → login handler
 * - Vérifie que l'école est ACTIVE ou APPROVED
 * - Auto-active l'école si ADMIN + école APPROVED (premier login)
 * - Récupère les permissions STAFF
 * - Enregistre lastLogin
 *
 * Note : la vérification bcrypt est faite dans l'adapter HTTP avant d'appeler ce use case.
 */
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { TokenService } from '@domain/ports/services/TokenService';
import type { StaffPermissionType } from '@domain/types/enums';

export interface ConnecterUtilisateurCommande {
  email: string;
  plainPassword: string;
  schoolId: string; // Résolu depuis le subdomain dans l'adapter
}

export interface ConnecterUtilisateurResultat {
  userId: string;
  schoolId: string;
  role: string;
  permissions: StaffPermissionType[];
  nomComplet: string;
  accessToken: string;
  refreshToken: string;
}

export class ConnecterUtilisateurUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(commande: ConnecterUtilisateurCommande): Promise<ConnecterUtilisateurResultat> {
    // 1. Vérifier que l'école est accessible
    const school = await this.schoolRepository.findById(commande.schoolId);
    if (!school) throw new Error('École introuvable');
    if (school.estSuspendue()) {
      throw new Error("Cet établissement est suspendu. Contactez l'administrateur EduNexus.");
    }
    if (school.status !== 'ACTIVE' && school.status !== 'APPROVED') {
      throw new Error("Cet établissement n'est pas encore actif.");
    }

    // 2. Charger et authentifier l'utilisateur (bcrypt dans l'adapter)
    const user = await this.userRepository.authentifier(
      commande.email,
      commande.schoolId,
      commande.plainPassword
    );
    if (!user || !user.isActive) {
      throw new Error('Email ou mot de passe incorrect');
    }

    // 3. Auto-activation : si ADMIN + école APPROVED → passer ACTIVE
    if (user.estAdmin() && school.status === 'APPROVED') {
      school.activer();
      await this.schoolRepository.update(school);
    }

    // 4. Enregistrer le dernier login
    user.enregistrerConnexion();
    await this.userRepository.update(user);

    // 5. Générer les tokens
    const tokens = this.tokenService.genererTokens({
      userId: user.id,
      schoolId: user.schoolId,
      role: user.role,
      permissions: user.staffPermissions,
      tokenType: 'access',
    });

    return {
      userId: user.id,
      schoolId: user.schoolId,
      role: user.role,
      permissions: user.staffPermissions,
      nomComplet: user.nomComplet,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }
}
