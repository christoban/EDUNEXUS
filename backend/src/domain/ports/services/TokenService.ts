/**
 * DOMAIN LAYER — Port Service Token JWT
 * Génération et vérification des tokens d'authentification.
 */
import type { UserRole, StaffPermissionType } from '@domain/types/enums';

export interface PayloadToken {
  userId: string;
  schoolId: string;
  role: UserRole;
  permissions: StaffPermissionType[];
  tokenType: 'access' | 'refresh';
  refreshTokenVersion?: number;
}

export interface TokensGeneres {
  accessToken: string;  // 15 minutes
  refreshToken: string; // 7 jours
}

export interface TokenService {
  genererTokens(payload: PayloadToken): TokensGeneres;
  verifierAccessToken(token: string): PayloadToken;
  verifierRefreshToken(token: string): PayloadToken;
}
