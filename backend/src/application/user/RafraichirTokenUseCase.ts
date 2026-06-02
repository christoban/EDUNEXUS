/**
 * APPLICATION LAYER — Use Case : Rafraîchir les tokens
 * Logique extraite de controllers/user.ts → refreshToken handler
 * Vérifie refreshTokenVersion pour la révocation de session.
 */
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { TokenService, PayloadToken } from '@domain/ports/services/TokenService';

export interface RafraichirTokenResultat {
  accessToken: string;
  refreshToken: string;
}

export class RafraichirTokenUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(refreshTokenPayload: PayloadToken & { refreshTokenVersion: number }): Promise<RafraichirTokenResultat> {
    // 1. Charger user avec refreshTokenVersion actuelle
    const result = await this.userRepository.findByIdWithRefreshVersion(
      refreshTokenPayload.userId
    );
    if (!result || !result.user.isActive) {
      throw new Error('Utilisateur introuvable ou inactif');
    }

    // 2. Vérifier que la version du token correspond (mécanisme de révocation de session)
    if (result.refreshTokenVersion !== refreshTokenPayload.refreshTokenVersion) {
      throw new Error('Session expirée — veuillez vous reconnecter');
    }

    // 3. Vérifier que l'école est toujours active
    const school = await this.schoolRepository.findById(result.user.schoolId);
    if (!school?.estActive()) {
      throw new Error("Cet établissement n'est plus actif");
    }

    // 4. Rotation : invalider l'ancien token en incrémentant la version
    result.user.invaliderTokens();
    await this.userRepository.update(result.user);

    // 5. Générer nouveau couple de tokens avec la nouvelle version
    return this.tokenService.genererTokens({
      userId: result.user.id,
      schoolId: result.user.schoolId,
      role: result.user.role,
      permissions: result.user.staffPermissions,
      tokenType: 'access',
      refreshTokenVersion: result.refreshTokenVersion + 1,
    });
  }
}
