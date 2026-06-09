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
  role?: string;    // Rôle sélectionné par l'utilisateur sur le formulaire
}

export interface ConnecterUtilisateurResultat {
  userId: string;
  schoolId: string;
  role: string;
  permissions: StaffPermissionType[];
  nomComplet: string;
  accessToken: string;
  refreshToken: string;
  roleMismatch?: boolean; // true si le rôle sélectionné ≠ rôle réel (1 seul rôle dispo)
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
    let user = await this.userRepository.authentifier(
      commande.email,
      commande.schoolId,
      commande.plainPassword,
      commande.role,
    );
    let roleMismatch = false;

    if (!user) {
      // Rôle sélectionné incorrect — vérifier les rôles disponibles (mot de passe déjà validé par bcrypt)
      const rolesDisponibles = await this.userRepository.listerRolesAvecMotDePasse(
        commande.email,
        commande.schoolId,
        commande.plainPassword,
      );

      if (rolesDisponibles.length === 0) {
        throw new Error('Email ou mot de passe incorrect');
      }

      if (rolesDisponibles.length > 1) {
        // Plusieurs rôles dispo → le frontend doit demander lequel choisir
        const err = new Error('ROLE_MISMATCH_MULTIPLE');
        (err as any).availableRoles = rolesDisponibles;
        throw err;
      }

      // Un seul rôle disponible (≠ sélectionné) → Option A : authentifier avec le bon rôle
      user = await this.userRepository.authentifier(
        commande.email,
        commande.schoolId,
        commande.plainPassword,
        rolesDisponibles[0],
      );
      roleMismatch = true;
    }

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
      roleMismatch,
    };
  }
}
