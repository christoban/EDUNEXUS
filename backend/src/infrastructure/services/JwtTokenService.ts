/**
 * INFRASTRUCTURE LAYER — Adapter JWT Token Service
 * Implémente TokenService en wrappant la logique JWT existante.
 */
import jwt from 'jsonwebtoken';
import type { TokenService, PayloadToken, TokensGeneres } from '@domain/ports/services/TokenService';

const JWT_SECRET = process.env.JWT_SECRET || 'zekoulabia-secret-change-in-production';
const ACCESS_EXPIRY = '8h';
const REFRESH_EXPIRY = '30d';

export class JwtTokenService implements TokenService {
  genererTokens(payload: PayloadToken): TokensGeneres {
    const accessToken = jwt.sign(
      {
        userId: payload.userId,
        schoolId: payload.schoolId,
        role: payload.role,
        permissions: payload.permissions,
        tokenType: 'access',
        refreshTokenVersion: payload.refreshTokenVersion ?? 0,
      },
      JWT_SECRET,
      { algorithm: 'HS512', expiresIn: ACCESS_EXPIRY }
    );

    const refreshToken = jwt.sign(
      {
        userId: payload.userId,
        schoolId: payload.schoolId,
        role: payload.role,
        permissions: [],
        tokenType: 'refresh',
        refreshTokenVersion: payload.refreshTokenVersion ?? 0,
      },
      JWT_SECRET,
      { algorithm: 'HS512', expiresIn: REFRESH_EXPIRY }
    );

    return { accessToken, refreshToken };
  }

  verifierAccessToken(token: string): PayloadToken {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS512'] }) as any;
    if (decoded.tokenType !== 'access') {
      throw new Error('Token invalide : type incorrect');
    }
    return decoded as PayloadToken;
  }

  verifierRefreshToken(token: string): PayloadToken {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS512'] }) as any;
    if (decoded.tokenType !== 'refresh') {
      throw new Error('Token invalide : type incorrect');
    }
    return decoded as PayloadToken;
  }
}
