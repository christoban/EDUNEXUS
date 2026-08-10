import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { UserRole, StaffPermissionType } from '@domain/types/enums';
import jwt from 'jsonwebtoken';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { passwordError } from '../../../utils/passwordValidator';
import { parseDateFR } from '../../../utils/dateParsing';
import { sendTransactionalEmail } from '../../../services/emailService';
import { genererCodesRecuperation } from '../../../utils/mfaRecoveryCodes';
import { verifierMotDePasseEtMfa } from '../../../middleware/requireUserSensitiveAuth';
import { emettreJetonReauth } from '../../../middleware/requireReauthToken';
import { createHash, randomBytes } from 'crypto';
import type { ConnecterUtilisateurUseCase, RoleMismatchError, SchoolSuspendedError } from '@application/user/ConnecterUtilisateurUseCase';
import type { InscrireUtilisateurUseCase } from '@application/user/InscrireUtilisateurUseCase';
import type { RafraichirTokenUseCase } from '@application/user/RafraichirTokenUseCase';
import type { DeconnecterUtilisateurUseCase } from '@application/user/DeconnecterUtilisateurUseCase';
import type { ModifierUtilisateurUseCase } from '@application/user/ModifierUtilisateurUseCase';
import type { SupprimerUtilisateurUseCase } from '@application/user/SupprimerUtilisateurUseCase';
import type { TransfererEleveUseCase } from '@application/user/TransfererEleveUseCase';
import type { DesignerAPUseCase } from '@application/user/DesignerAPUseCase';
import type { ImporterUtilisateursUseCase } from '@application/user/ImporterUtilisateursUseCase';
import type { LoginEmailOtpUseCase } from '@application/user/LoginEmailOtpUseCase';
import type { VerifierMfaConnexionUseCase } from '@application/user/VerifierMfaConnexionUseCase';
import type { TokenService, PayloadToken } from '@domain/ports/services/TokenService';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import { getTemplateMeta } from '@application/school/schoolTemplateConfig';
import { isNiveauPrimaireOuMaternelle } from '../../../lib/classSerieValidator';
import { journaliserActionIA } from '@infrastructure/services/AIActionAuditLogger';
import * as XLSX from 'xlsx';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

const ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000; // 15 min — doit rester synchronisé avec JwtTokenService

/**
 * Durée du cookie refresh_token, graduée par rôle — doit rester synchronisée avec
 * REFRESH_EXPIRY_PAR_ROLE dans JwtTokenService.ts. Un cookie plus long que le JWT qu'il
 * transporte ne serait pas dangereux en soi (le JWT expiré serait rejeté à la vérification),
 * mais un cookie plus COURT couperait la session avant l'expiration réelle du token — les
 * deux durées doivent donc correspondre exactement.
 */
const REFRESH_COOKIE_MAX_AGE_MS_PAR_ROLE: Record<string, number> = {
  ADMIN: 7 * 24 * 60 * 60 * 1000,
  STAFF: 7 * 24 * 60 * 60 * 1000,
  TEACHER: 30 * 24 * 60 * 60 * 1000,
  STUDENT: 30 * 24 * 60 * 60 * 1000,
  PARENT: 30 * 24 * 60 * 60 * 1000,
};
const REFRESH_COOKIE_MAX_AGE_MS_DEFAUT = 7 * 24 * 60 * 60 * 1000;

function dureeCookieRefreshMs(role: string): number {
  return REFRESH_COOKIE_MAX_AGE_MS_PAR_ROLE[role.toUpperCase()] ?? REFRESH_COOKIE_MAX_AGE_MS_DEFAUT;
}

// Rôles dont la connexion exige une double authentification (MFA/TOTP) en plus du code email.
// Parent/Élève n'en font pas partie — mot de passe + code email seulement.
const MFA_REQUIRED_ROLES = ['ADMIN', 'STAFF', 'TEACHER'];

interface PendingLoginPayload {
  userId: string;
  schoolId: string;
  role: string;
  permissions: string[];
  nomComplet: string;
  roleMismatch: boolean;
  redirectTo?: string | null;
  tokenType: 'pending_login' | 'pending_mfa' | 'pending_mfa_setup';
}

export class UserController {
  constructor(
    private readonly connecter: ConnecterUtilisateurUseCase,
    private readonly inscrire: InscrireUtilisateurUseCase,
    private readonly rafraichir: RafraichirTokenUseCase,
    private readonly deconnecter: DeconnecterUtilisateurUseCase,
    private readonly modifier: ModifierUtilisateurUseCase,
    private readonly supprimer: SupprimerUtilisateurUseCase,
    private readonly transferer: TransfererEleveUseCase,
    private readonly tokenService: TokenService,
    private readonly schoolRepository: SchoolRepository,
    private readonly designerAP: DesignerAPUseCase,
    private readonly importer: ImporterUtilisateursUseCase,
    private readonly loginEmailOtp: LoginEmailOtpUseCase,
    private readonly verifierMfaConnexion: VerifierMfaConnexionUseCase,
    private readonly prisma: PrismaClient,
  ) {}

  // ── Pending login token (cookie temporaire entre les étapes de connexion) ──

  private signPendingToken(payload: Omit<PendingLoginPayload, 'tokenType'>, tokenType: PendingLoginPayload['tokenType'], expiresIn: string): string {
    return jwt.sign({ ...payload, tokenType }, process.env.JWT_SECRET!, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
  }

  private setPendingCookie(res: Response, token: string, maxAgeMs: number): void {
    res.cookie('pending_login_token', token, { ...COOKIE_OPTIONS, maxAge: maxAgeMs });
  }

  private readPendingToken(req: Request, expectedType: PendingLoginPayload['tokenType']): PendingLoginPayload {
    const raw = req.cookies?.pending_login_token;
    if (!raw) throw new Error('Session de connexion expirée. Veuillez recommencer.');
    let decoded: PendingLoginPayload & { exp?: number; iat?: number; nbf?: number };
    try {
      decoded = jwt.verify(raw, process.env.JWT_SECRET!) as PendingLoginPayload & { exp?: number; iat?: number; nbf?: number };
    } catch {
      throw new Error('Session de connexion expirée. Veuillez recommencer.');
    }
    if (decoded.tokenType !== expectedType) {
      throw new Error('Session de connexion invalide. Veuillez recommencer.');
    }
    // jwt.verify renvoie aussi les claims standard (exp/iat/nbf) dans le payload decode. Si on
    // reinjecte ce payload tel quel dans un futur jwt.sign(..., { expiresIn }) pour l-etape
    // suivante, jsonwebtoken refuse ("Bad options.expiresIn option the payload already has an
    // exp property") — on les retire ici, une fois pour toutes, plutot que dans chaque appelant.
    const { exp, iat, nbf, ...clean } = decoded;
    return clean as PendingLoginPayload;
  }

  private issueFinalSession(res: Response, payload: Omit<PendingLoginPayload, 'tokenType'>) {
    const tokens = this.tokenService.genererTokens({
      userId: payload.userId,
      schoolId: payload.schoolId,
      role: payload.role as UserRole,
      permissions: payload.permissions as StaffPermissionType[],
      tokenType: 'access',
    });
    res.cookie('access_token', tokens.accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_COOKIE_MAX_AGE_MS });
    res.cookie('refresh_token', tokens.refreshToken, { ...COOKIE_OPTIONS, maxAge: dureeCookieRefreshMs(payload.role) });
    res.clearCookie('pending_login_token', { path: '/' });
    return {
      userId: payload.userId,
      role: payload.role,
      permissions: payload.permissions,
      nomComplet: payload.nomComplet,
      roleMismatch: payload.roleMismatch,
      redirectTo: payload.redirectTo ?? null,
    };
  }

  // POST /api/v2/auth/login
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, subdomain, role } = req.body;
      if (!email || !password || !subdomain) {
        res.status(400).json({ success: false, message: 'email, password et subdomain requis' });
        return;
      }

      const school = await this.schoolRepository.findBySubdomain(subdomain);
      if (!school) {
        res.status(404).json({ success: false, message: 'Établissement introuvable' });
        return;
      }

      const resultat = await this.connecter.execute({
        email,
        plainPassword: password,
        schoolId: school.id,
        role: role || undefined,
      });

      // Identifiants valides — jamais de session immédiate : toute connexion (tous rôles)
      // passe désormais par un code de vérification envoyé par email avant l'accès complet.
      await this.loginEmailOtp.envoyer(resultat.userId);

      const pendingPayload: Omit<PendingLoginPayload, 'tokenType'> = {
        userId: resultat.userId,
        schoolId: resultat.schoolId,
        role: resultat.role,
        permissions: resultat.permissions,
        nomComplet: resultat.nomComplet,
        roleMismatch: resultat.roleMismatch ?? false,
        redirectTo: resultat.redirectTo ?? null,
      };
      const token = this.signPendingToken(pendingPayload, 'pending_login', '10m');
      this.setPendingCookie(res, token, 10 * 60 * 1000);

      res.json({ success: true, step: 'email_otp', message: 'Code de vérification envoyé par email' });
    } catch (error) {
      // École suspendue — credentials valides mais accès bloqué
      if (error instanceof Error && (error as SchoolSuspendedError).code === 'SCHOOL_SUSPENDED') {
        res.status(403).json({
          success: false,
          error: 'SCHOOL_SUSPENDED',
          message: 'Votre établissement a été suspendu. Contactez le support ZekoulABia.',
        });
        return;
      }
      // Cas multi-rôles : l'utilisateur doit choisir son rôle parmi les disponibles
      if (error instanceof Error && error.message === 'ROLE_MISMATCH_MULTIPLE') {
        res.status(422).json({
          success: false,
          code: 'ROLE_MISMATCH_MULTIPLE',
          message: 'Le rôle sélectionné ne correspond à aucun compte dans cet établissement.',
          availableRoles: (error as RoleMismatchError).availableRoles,
        });
        return;
      }
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/users/auth/verify-login-otp
  verifyLoginOtp = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const decoded = this.readPendingToken(req, 'pending_login');
      const { otp } = req.body;
      if (!otp) {
        res.status(400).json({ success: false, message: 'Code OTP requis' });
        return;
      }

      await this.loginEmailOtp.verifier(decoded.userId, otp);

      const base = { ...decoded };

      if (MFA_REQUIRED_ROLES.includes(decoded.role)) {
        const user = await this.prisma.user.findUnique({ where: { id: decoded.userId }, select: { mfaEnabled: true } });

        if (user?.mfaEnabled) {
          const token = this.signPendingToken(base, 'pending_mfa', '10m');
          this.setPendingCookie(res, token, 10 * 60 * 1000);
          res.json({ success: true, step: 'totp_required' });
          return;
        }

        // MFA jamais configuré (1re connexion, ou compte existant pas encore migré) — accès
        // bloqué tant que la configuration obligatoire n'est pas terminée (voir mfa/first-setup).
        const token = this.signPendingToken(base, 'pending_mfa_setup', '20m');
        this.setPendingCookie(res, token, 20 * 60 * 1000);
        res.json({ success: true, step: 'mfa_setup_required' });
        return;
      }

      // PARENT / STUDENT (et tout rôle hors liste MFA) — session complète immédiate
      const data = this.issueFinalSession(res, base);
      res.json({ success: true, step: 'done', data });
    } catch (error: any) {
      res.status(401).json({ success: false, message: error.message || 'Code invalide' });
    }
  };

  // POST /api/v2/users/auth/resend-login-otp
  resendLoginOtp = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const decoded = this.readPendingToken(req, 'pending_login');
      await this.loginEmailOtp.envoyer(decoded.userId);
      const token = this.signPendingToken(decoded, 'pending_login', '10m');
      this.setPendingCookie(res, token, 10 * 60 * 1000);
      res.json({ success: true, message: 'Nouveau code de vérification envoyé' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Erreur lors du renvoi' });
    }
  };

  // POST /api/v2/users/auth/verify-login-mfa
  verifyLoginMfa = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const decoded = this.readPendingToken(req, 'pending_mfa');
      const { code } = req.body;
      if (!code) {
        res.status(400).json({ success: false, message: 'Code MFA requis' });
        return;
      }

      await this.verifierMfaConnexion.execute(decoded.userId, code);

      const data = this.issueFinalSession(res, decoded);
      res.json({ success: true, step: 'done', data });
    } catch (error: any) {
      res.status(401).json({ success: false, message: error.message || 'Code MFA invalide' });
    }
  };

  // POST /api/v2/users/auth/mfa/first-setup — configuration MFA obligatoire (1re connexion Admin/Staff/Teacher)
  firstMfaSetup = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const decoded = this.readPendingToken(req, 'pending_mfa_setup');

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, mfaEnabled: true },
      });
      if (!user) { res.status(404).json({ success: false, message: 'Compte introuvable' }); return; }
      if (user.mfaEnabled) { res.status(400).json({ success: false, message: 'MFA déjà activé sur ce compte.' }); return; }

      const secret: string = generateSecret();
      await this.prisma.user.update({ where: { id: user.id }, data: { mfaTempSecret: secret } });

      const otpauthUrl: string = generateURI({ issuer: 'ZekoulABia', label: user.email || decoded.userId, secret });
      const qrDataUri: string = await QRCode.toDataURL(otpauthUrl);

      res.json({ success: true, data: { qrDataUri, manualKey: secret } });
    } catch (error: any) {
      res.status(error.message?.includes('expirée') || error.message?.includes('invalide') ? 401 : 500)
        .json({ success: false, message: error.message || 'Erreur' });
    }
  };

  // POST /api/v2/users/auth/mfa/first-enable — vérifie le TOTP, active le MFA, termine la connexion
  firstMfaEnable = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const decoded = this.readPendingToken(req, 'pending_mfa_setup');
      const { totpCode } = req.body;
      if (!totpCode) { res.status(400).json({ success: false, message: 'Code TOTP requis' }); return; }

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, mfaTempSecret: true, mfaEnabled: true },
      });
      if (!user?.mfaTempSecret) {
        res.status(400).json({ success: false, message: "Aucune configuration MFA en cours. Recommencez depuis l'étape 1." });
        return;
      }
      if (user.mfaEnabled) { res.status(400).json({ success: false, message: 'MFA déjà activé.' }); return; }

      const valid: boolean = verifySync({ token: String(totpCode).trim(), secret: user.mfaTempSecret }).valid;
      if (!valid) {
        res.status(401).json({ success: false, message: 'Code TOTP invalide. Vérifiez que votre application est synchronisée.' });
        return;
      }

      const { formatted, hashed } = await genererCodesRecuperation();

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: true,
          mfaSecret: user.mfaTempSecret,
          mfaTempSecret: null,
          mfaRecoveryCodeHashes: hashed,
          mfaRecoveryCodeGeneratedAt: new Date(),
        },
      });

      const data = this.issueFinalSession(res, decoded);
      res.json({ success: true, data: { ...data, recoveryCodes: formatted } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Erreur' });
    }
  };

  // GET /api/v2/users/mfa/status — statut MFA du compte authentifié (Admin/Staff/Teacher)
  mfaStatus = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { mfaEnabled: true } });
      res.json({ success: true, data: { mfaEnabled: user?.mfaEnabled ?? false } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // POST /api/v2/users/mfa/reconfigure/start — génère un NOUVEAU secret (gardé par requireUserSensitiveAuth)
  mfaReconfigureStart = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, mfaEnabled: true } });
      if (!user?.mfaEnabled) {
        res.status(400).json({ success: false, message: 'Configurez d\'abord le MFA depuis la connexion.' });
        return;
      }

      const secret: string = generateSecret();
      await this.prisma.user.update({ where: { id: user.id }, data: { mfaTempSecret: secret } });

      const otpauthUrl: string = generateURI({ issuer: 'ZekoulABia', label: user.email || userId, secret });
      const qrDataUri: string = await QRCode.toDataURL(otpauthUrl);

      res.json({ success: true, data: { qrDataUri, manualKey: secret } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Erreur' });
    }
  };

  // POST /api/v2/users/mfa/reconfigure/confirm — confirme le nouveau secret + régénère les codes
  mfaReconfigureConfirm = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { totpCode } = req.body;
      if (!totpCode) { res.status(400).json({ success: false, message: 'Code TOTP requis' }); return; }

      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, mfaTempSecret: true } });
      if (!user?.mfaTempSecret) {
        res.status(400).json({ success: false, message: "Aucune reconfiguration en cours. Recommencez depuis l'étape 1." });
        return;
      }

      const valid: boolean = verifySync({ token: String(totpCode).trim(), secret: user.mfaTempSecret }).valid;
      if (!valid) {
        res.status(401).json({ success: false, message: 'Code TOTP invalide.' });
        return;
      }

      const { formatted, hashed } = await genererCodesRecuperation();

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          mfaSecret: user.mfaTempSecret,
          mfaTempSecret: null,
          mfaRecoveryCodeHashes: hashed,
          mfaRecoveryCodeGeneratedAt: new Date(),
        },
      });

      res.json({ success: true, data: { recoveryCodes: formatted } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Erreur' });
    }
  };

  // POST /api/v2/users/mfa/regen-codes — régénère uniquement les codes de récupération (gardé)
  mfaRegenCodes = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, mfaEnabled: true } });
      if (!user?.mfaEnabled) { res.status(400).json({ success: false, message: 'MFA non actif.' }); return; }

      const { formatted, hashed } = await genererCodesRecuperation();

      await this.prisma.user.update({
        where: { id: user.id },
        data: { mfaRecoveryCodeHashes: hashed, mfaRecoveryCodeGeneratedAt: new Date() },
      });

      res.json({ success: true, data: { recoveryCodes: formatted } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Erreur' });
    }
  };

  // POST /api/v2/users/auth/reauth — ouvre une fenêtre de grâce de ré-authentification
  // (Couche 1, PLAN_IMPLEMENTATION_BACKUP.md §1.5) : mot de passe + MFA vérifiés une fois,
  // jeton court terme réutilisable ensuite pour les actions destructives de gravité complète.
  reauth = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { password, code } = req.body as { password?: string; code?: string };
      const resultat = await verifierMotDePasseEtMfa(userId, String(password ?? '').trim(), String(code ?? '').trim());
      if (!resultat.ok) {
        const echec = resultat as { ok: false; statusCode: number; message: string };
        res.status(echec.statusCode).json({ success: false, message: echec.message });
        return;
      }
      emettreJetonReauth(res, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Erreur' });
    }
  };

  // POST /api/v2/auth/logout
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (user?.userId) {
        await this.deconnecter.execute(user.userId);
      }
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/' });
      res.json({ success: true, message: 'Déconnecté avec succès' });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/auth/refresh
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refresh_token;
      if (!refreshToken) {
        res.status(401).json({ success: false, message: 'Token de rafraîchissement manquant' });
        return;
      }

      // JwtTokenService écrit toujours refreshTokenVersion (défaut 0) à la signature — voir
      // genererTokens — même si le port le déclare optionnel.
      const payload = this.tokenService.verifierRefreshToken(refreshToken) as PayloadToken & { refreshTokenVersion: number };
      const tokens = await this.rafraichir.execute(payload);

      res.cookie('access_token', tokens.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: ACCESS_COOKIE_MAX_AGE_MS,
      });
      res.cookie('refresh_token', tokens.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: dureeCookieRefreshMs(payload.role),
      });

      res.json({ success: true, message: 'Tokens rafraîchis' });
    } catch (error) {
      // Ne pas effacer les cookies sur erreur transitoire (redémarrage backend, réseau)
      // Seul un logout explicite ou un refresh token vraiment expiré mérite un clearCookie
      res.status(401).json({ success: false, message: 'Session expirée — reconnectez-vous' });
    }
  };

  // POST /api/v2/users
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const bcrypt = await import('bcryptjs');
      const isDevMode = process.env.EMAIL_DISABLED === 'true';

      let passwordHash: string;
      if (isDevMode) {
        // Dev : mot de passe fixe — le frontend est ignoré volontairement
        passwordHash = await bcrypt.hash('chris123456789', 10);
      } else {
        // Prod : hash aléatoire — l'utilisateur crée son mot de passe via le lien d'invitation
        const crypto = await import('crypto');
        passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      }

      // dateOfBirth traité explicitement (voir même correctif sur `update`) : évite de
      // dépendre implicitement de la coercion Date|string de Prisma.
      let dateOfBirth: Date | undefined;
      if (req.body.dateOfBirth) {
        const parsed = parseDateFR(String(req.body.dateOfBirth));
        if (!parsed) {
          res.status(400).json({ success: false, message: `Date de naissance invalide : "${req.body.dateOfBirth}"` });
          return;
        }
        dateOfBirth = parsed;
      }

      // Maternelle/primaire : jamais d'identifiants de connexion propres pour l'élève, même
      // via la création directe (même règle que le module eleveOnboarding — voir
      // determinerRecipientType). Le compte élève reste créable (StudentProfile obligatoire
      // pour notes/présences), mais sans email ni téléphone. Aucun champ "cycle" par classe/
      // section dans le schéma — signal dérivé du template de l'école (School.templateCode).
      if (req.body.role === 'STUDENT' && req.body.classeId && (req.body.email || req.body.phone)) {
        const classe = await this.prisma.class.findUnique({ where: { id: req.body.classeId }, select: { level: true } });
        const ecole = await this.prisma.school.findUnique({ where: { id: user.schoolId }, select: { templateCode: true } });
        const isPrimaireClasse = classe ? isNiveauPrimaireOuMaternelle(classe.level) : getTemplateMeta(ecole?.templateCode).isPrimaire;
        if (isPrimaireClasse) {
          res.status(400).json({
            success: false,
            message: "Un élève de maternelle/primaire ne peut pas avoir d'identifiants de connexion propres (email/téléphone) — créez plutôt un compte PARENT pour la connexion.",
          });
          return;
        }
      }

      const resultat = await this.inscrire.execute({
        schoolId: user.schoolId,
        ...req.body,
        dateOfBirth,
        passwordHash,
      });

      journaliserActionIA(this.prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'creer_eleve', targetType: 'User', targetId: resultat.userId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.status(201).json({ success: true, data: resultat });

      // Envoi du lien d'invitation (prod uniquement, tout rôle avec email — le garde-fou
      // maternelle/primaire ci-dessus garantit qu'un STUDENT avec email est bien un élève du
      // secondaire, donc éligible aux identifiants propres comme PARENT/STAFF/TEACHER).
      const recipientEmail: string | undefined = (req.body.email as string | undefined)?.trim();
      const role: string = req.body.role || '';
      if (!isDevMode && recipientEmail && ['STAFF', 'TEACHER', 'STUDENT', 'PARENT'].includes(role)) {
        (async () => {
          try {
            const jwt = await import('jsonwebtoken');
            const inviteToken = jwt.default.sign(
              { sub: resultat.userId, email: recipientEmail, schoolId: user.schoolId, type: 'user_invite' },
              process.env.JWT_SECRET!,
              { expiresIn: '7d' },
            );

            const school = await this.prisma.school.findUnique({
              where: { id: user.schoolId },
              select: { name: true },
            });
            const schoolName = school?.name ?? 'votre établissement';
            const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
            const inviteUrl = `${frontendUrl}/invite/set-password?token=${inviteToken}`;

            console.log(`[Invite] Lien d'invitation pour ${recipientEmail}: ${inviteUrl}`);

            const { sendTransactionalEmail } = await import('../../../services/emailService');
            await sendTransactionalEmail({
              recipientEmail,
              subject: `ZekoulABia — Créez votre mot de passe · ${schoolName}`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
                  <div style="background:#1a2e1e;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
                    <h1 style="color:white;margin:0;font-size:20px;">🎓 ZekoulABia</h1>
                  </div>
                  <div style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e8e0d4;">
                    <h2 style="color:#1a1209;margin-top:0;">Bonjour ${String(req.body.firstName || '').trim()} ${String(req.body.lastName || '').trim()},</h2>
                    <p style="color:#6b5c45;font-size:15px;line-height:1.6;">
                      Vous avez été invité(e) à rejoindre <strong>${schoolName}</strong> sur ZekoulABia.
                      Cliquez sur le bouton ci-dessous pour créer votre mot de passe et accéder à votre espace.
                    </p>
                    <div style="text-align:center;margin:28px 0 16px;">
                      <a href="${inviteUrl}" style="background:linear-gradient(135deg,#059669,#047857);color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">
                        🔑 Créer mon mot de passe
                      </a>
                    </div>
                    <p style="color:#a89478;font-size:13px;text-align:center;">Ce lien expire dans 7 jours.</p>
                    <hr style="border:none;border-top:1px solid #e8e0d4;margin:20px 0;" />
                    <p style="color:#a89478;font-size:12px;margin:0;text-align:center;">
                      ZekoulABia · Plateforme de gestion scolaire · Cameroun
                    </p>
                  </div>
                </div>
              `,
              template: 'user_invitation',
              eventType: 'user_invite',
              metadata: { schoolId: user.schoolId },
            });
          } catch (emailErr) {
            console.error('[Email] Invitation error:', emailErr);
          }
        })();
      }
    } catch (error) {
      const user = req.user;
      journaliserActionIA(this.prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'creer_eleve', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  // GET /api/v2/users/auth/invite/validate?token=...
  validateInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.query.token as string;
      if (!token) {
        res.status(400).json({ success: false, message: 'Token manquant' });
        return;
      }

      const jwt = await import('jsonwebtoken');
      let payload: any;
      try {
        payload = jwt.default.verify(token, process.env.JWT_SECRET!);
      } catch {
        res.status(401).json({ success: false, message: 'Lien invalide ou expiré. Contactez votre administrateur.' });
        return;
      }

      if (payload.type !== 'user_invite') {
        res.status(401).json({ success: false, message: 'Lien invalide.' });
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub as string },
        select: { id: true, firstName: true, lastName: true, email: true, schoolId: true },
      });
      if (!user) {
        res.status(404).json({ success: false, message: 'Compte introuvable.' });
        return;
      }

      const school = await this.prisma.school.findUnique({
        where: { id: user.schoolId },
        select: { name: true, subdomain: true },
      });

      res.json({
        success: true,
        data: {
          email: user.email || payload.email,
          firstName: user.firstName,
          lastName: user.lastName,
          schoolName: school?.name ?? '',
          subdomain: school?.subdomain ?? '',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/users/auth/invite/complete
  completeInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, password, confirmPassword } = req.body as {
        token?: string;
        password?: string;
        confirmPassword?: string;
      };

      if (!token || !password) {
        res.status(400).json({ success: false, message: 'Token et mot de passe requis.' });
        return;
      }
      if (password !== confirmPassword) {
        res.status(400).json({ success: false, message: 'Les mots de passe ne correspondent pas.' });
        return;
      }
      const pwdErr = passwordError(password);
      if (pwdErr) {
        res.status(400).json({ success: false, message: pwdErr });
        return;
      }

      const jwt = await import('jsonwebtoken');
      let payload: any;
      try {
        payload = jwt.default.verify(token, process.env.JWT_SECRET!);
      } catch {
        res.status(401).json({ success: false, message: 'Lien invalide ou expiré. Contactez votre administrateur.' });
        return;
      }

      if (payload.type !== 'user_invite') {
        res.status(401).json({ success: false, message: 'Lien invalide.' });
        return;
      }

      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);

      await this.prisma.user.update({
        where: { id: payload.sub as string },
        data: { passwordHash },
      });

      res.json({ success: true, message: 'Mot de passe créé avec succès. Vous pouvez maintenant vous connecter.' });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/users/auth/forgot-password
  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, subdomain } = req.body as { email?: string; subdomain?: string };
      if (!email || !subdomain) {
        res.status(400).json({ success: false, message: 'email et subdomain requis.' });
        return;
      }

      const school = await this.schoolRepository.findBySubdomain(subdomain);
      if (!school) {
        // Réponse identique pour ne pas révéler l'existence du sous-domaine
        res.json({ success: true, message: 'Si ce compte existe, un email de réinitialisation a été envoyé.' });
        return;
      }

      const user = await this.prisma.user.findFirst({
        where: { schoolId: school.id, email: email.toLowerCase().trim() },
        select: { id: true, firstName: true, lastName: true, email: true },
      });

      if (user?.email) {
        const plainToken = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(plainToken).digest('hex');
        const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1h

        await this.prisma.user.update({
          where: { id: user.id },
          data: { resetPasswordToken: tokenHash, resetPasswordTokenExpiry: expiry },
        });

        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        const resetUrl = `${clientUrl}/reset-password?token=${plainToken}&subdomain=${subdomain}`;
        const name = `${user.firstName} ${user.lastName}`;

        await sendTransactionalEmail({
          recipientEmail: user.email,
          subject: 'Réinitialisation de votre mot de passe — ZekoulABia',
          template: 'password_reset',
          eventType: 'password_reset',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;background:#f9f7f4;border-radius:12px">
              <div style="background:linear-gradient(135deg,#059669,#047857);border-radius:10px;padding:24px 28px;margin-bottom:28px">
                <h1 style="color:white;margin:0;font-size:22px;font-weight:800">🔐 Réinitialisation du mot de passe</h1>
              </div>
              <p style="color:#374151;font-size:16px">Bonjour <strong>${name}</strong>,</p>
              <p style="color:#374151;font-size:15px">Vous avez demandé la réinitialisation de votre mot de passe pour votre compte ZekoulABia.</p>
              <p style="color:#374151;font-size:15px">Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expirera dans <strong>1 heure</strong>.</p>
              <div style="text-align:center;margin:32px 0">
                <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#059669,#047857);color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:16px;font-weight:800">
                  Réinitialiser mon mot de passe
                </a>
              </div>
              <p style="color:#6b7280;font-size:13px">Si vous n'avez pas fait cette demande, ignorez simplement cet email. Votre mot de passe ne sera pas modifié.</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
              <p style="color:#9ca3af;font-size:12px;text-align:center">ZekoulABia — Système de gestion scolaire</p>
            </div>`,
          metadata: { schoolId: school.id },
        });
      }

      res.json({ success: true, message: 'Si ce compte existe, un email de réinitialisation a été envoyé.' });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/users/auth/reset-password
  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, password, confirmPassword } = req.body as {
        token?: string; password?: string; confirmPassword?: string;
      };

      if (!token || !password) {
        res.status(400).json({ success: false, message: 'Token et mot de passe requis.' });
        return;
      }
      if (password !== confirmPassword) {
        res.status(400).json({ success: false, message: 'Les mots de passe ne correspondent pas.' });
        return;
      }
      const pwdErr = passwordError(password);
      if (pwdErr) {
        res.status(400).json({ success: false, message: pwdErr });
        return;
      }

      const tokenHash = createHash('sha256').update(token).digest('hex');
      const user = await this.prisma.user.findFirst({
        where: {
          resetPasswordToken: tokenHash,
          resetPasswordTokenExpiry: { gt: new Date() },
        },
        select: { id: true },
      });

      if (!user) {
        res.status(400).json({ success: false, message: 'Lien invalide ou expiré. Demandez un nouveau lien.' });
        return;
      }

      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetPasswordToken: null,
          resetPasswordTokenExpiry: null,
          refreshTokenVersion: { increment: 1 },
        },
      });

      res.json({ success: true, message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.' });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/users/auth/change-password  (authentifié)
  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authUser = req.user as { userId: string };
      const { currentPassword, newPassword, confirmPassword } = req.body as {
        currentPassword?: string; newPassword?: string; confirmPassword?: string;
      };

      if (!currentPassword || !newPassword) {
        res.status(400).json({ success: false, message: 'Mot de passe actuel et nouveau mot de passe requis.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        res.status(400).json({ success: false, message: 'Les mots de passe ne correspondent pas.' });
        return;
      }
      if (newPassword === currentPassword) {
        res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit être différent de l\'ancien.' });
        return;
      }
      const pwdErr = passwordError(newPassword);
      if (pwdErr) {
        res.status(400).json({ success: false, message: pwdErr });
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: authUser.userId },
        select: { id: true, passwordHash: true },
      });
      if (!user) {
        res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        return;
      }
      if (!user.passwordHash) {
        res.status(400).json({ success: false, message: 'Aucun mot de passe défini. Contactez votre administrateur.' });
        return;
      }

      const bcrypt = await import('bcryptjs');
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) {
        res.status(401).json({ success: false, message: 'Mot de passe actuel incorrect.' });
        return;
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, refreshTokenVersion: { increment: 1 } },
      });

      res.json({ success: true, message: 'Mot de passe modifié avec succès.' });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/v2/users/:id
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      let passwordHash: string | undefined;

      if (req.body.password) {
        const bcrypt = await import('bcryptjs');
        passwordHash = await bcrypt.hash(req.body.password, 10);
      }

      // dateOfBirth traité explicitement (pas via le spread ...req.body) : parseDateFR valide
      // le format et construit en UTC, plutôt que de compter sur la coercion implicite de Prisma.
      let dateOfBirth: Date | undefined;
      if (req.body.dateOfBirth) {
        const parsed = parseDateFR(String(req.body.dateOfBirth));
        if (!parsed) {
          res.status(400).json({ success: false, message: `Date de naissance invalide : "${req.body.dateOfBirth}"` });
          return;
        }
        dateOfBirth = parsed;
      }

      // Maternelle/primaire : même garde-fou qu'à la création (voir register ci-dessus) — un
      // élève ne doit jamais se voir attribuer un email/téléphone propre par une modification
      // ultérieure, même si la création initiale ne l'avait pas fait. Aucun champ "cycle" par
      // classe/section dans le schéma — signal dérivé du template de l'école (l'admin et sa
      // cible appartiennent nécessairement à la même école, portée multi-tenant oblige).
      if (req.body.email || req.body.phone) {
        const cible = await this.prisma.user.findUnique({
          where: { id: req.params.id as string },
          select: { role: true, studentProfile: { select: { class: { select: { level: true } } } } },
        });
        const effectiveRole = req.body.role ?? cible?.role;
        if (effectiveRole === 'STUDENT') {
          const ecole = await this.prisma.school.findUnique({ where: { id: user.schoolId }, select: { templateCode: true } });
          const isPrimaireClasse = cible?.studentProfile?.class?.level
            ? isNiveauPrimaireOuMaternelle(cible.studentProfile.class.level)
            : getTemplateMeta(ecole?.templateCode).isPrimaire;
          if (isPrimaireClasse) {
            res.status(400).json({
              success: false,
              message: "Un élève de maternelle/primaire ne peut pas avoir d'identifiants de connexion propres (email/téléphone) — créez plutôt un compte PARENT pour la connexion.",
            });
            return;
          }
        }
      }

      await this.modifier.execute({
        cibleUserId: req.params.id as string,
        demandeurId: user.userId,
        demandeurRole: user.role,
        schoolId: user.schoolId,
        ...req.body,
        dateOfBirth,
        passwordHash,
      });

      journaliserActionIA(this.prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'modifier_eleve', targetType: 'User', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.json({ success: true, message: 'Utilisateur mis à jour' });
    } catch (error) {
      const user = req.user;
      journaliserActionIA(this.prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'modifier_eleve', targetType: 'User', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  // DELETE /api/v2/users/:id
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.supprimer.execute({
        userId: req.params.id as string,
        schoolId: user.schoolId,
        demandeurRole: user.role,
        demandeurId: user.userId,
      });
      res.json({ success: true, message: 'Utilisateur mis à la corbeille' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/students/:id/transfer
  transfer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { fromClasseId, toClasseId } = req.body;

      if (!fromClasseId || !toClasseId) {
        res.status(400).json({ success: false, message: 'fromClasseId et toClasseId requis' });
        return;
      }

      await this.transferer.execute({
        studentId: req.params.id as string,
        fromClasseId,
        toClasseId,
        schoolId: user.schoolId,
        demandeurId: user.userId,
      });

      journaliserActionIA(this.prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'transferer_eleve', targetType: 'User', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { fromClasseId, toClasseId },
      });
      res.json({ success: true, message: 'Élève transféré avec succès' });
    } catch (error) {
      const user = req.user;
      journaliserActionIA(this.prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'transferer_eleve', targetType: 'User', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/users/import
  importUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const role = req.body.role as string;
      const file = req.file as Express.Multer.File | undefined;

      if (!file) {
        res.status(400).json({ success: false, message: 'Fichier requis (.xlsx ou .xls)' });
        return;
      }
      if (role !== 'STUDENT' && role !== 'TEACHER') {
        res.status(400).json({ success: false, message: "role doit être 'STUDENT' ou 'TEACHER'" });
        return;
      }

      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rowsJson = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

      const rows = rowsJson.map((r, i) => ({
        ligne: i + 2,
        nom: String(r.nom || '').trim(),
        prenom: String(r.prenom || '').trim(),
        email: String(r.email || '').trim(),
        telephone: String(r.telephone || '').trim(),
        matricule: String(r.matricule || '').trim(),
        dateNaissance: String(r.date_naissance || '').trim(),
        sexe: String(r.sexe ?? r.genre ?? r.sex ?? '').trim(),
        classe: String(r.classe || '').trim(),
        nomParent: String(r.nom_parent || '').trim(),
        prenomParent: String(r.prenom_parent || '').trim(),
        emailParent: String(r.email_parent || '').trim(),
        telephoneParent: String(r.telephone_parent || '').trim(),
        matieres: String(r.matieres || '').trim(),
        classePrincipale: String(r.classe_principale || '').trim(),
        pebs: String(r.pebs ?? r.PEBS ?? '').trim(),
        lv2: String(r.lv2 ?? r.LV2 ?? '').trim(),
      }));

      if (rows.length === 0) {
        res.status(400).json({ success: false, message: 'Aucune ligne trouvée dans le fichier' });
        return;
      }

      const resultat = await this.importer.execute(user.schoolId, rows, role as 'STUDENT' | 'TEACHER');

      res.json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // PATCH /api/v2/users/:id/ap-designation
  apDesignation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { departmentSubjectIds, action } = req.body as {
        departmentSubjectIds?: string[];
        action?: string;
      };

      if (action !== 'ASSIGN' && action !== 'REMOVE') {
        res.status(400).json({ success: false, message: "action doit être 'ASSIGN' ou 'REMOVE'" });
        return;
      }
      if (!Array.isArray(departmentSubjectIds)) {
        res.status(400).json({ success: false, message: 'departmentSubjectIds (tableau) requis' });
        return;
      }

      await this.designerAP.execute({
        userId: req.params.id as string,
        schoolId: user.schoolId,
        demandeurRole: user.role,
        departmentSubjectIds,
        action,
      });

      const msg = action === 'ASSIGN'
        ? 'Enseignant désigné Animateur Pédagogique avec succès'
        : 'Désignation AP retirée avec succès';
      res.json({ success: true, message: msg });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof Error) {
      if (error.message.includes('existe déjà')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('incorrect') || error.message.includes('expirée')) {
        res.status(401).json({ success: false, message: error.message });
        return;
      }
      // 'refusé' (racine) plutôt que 'refusée' : matche aussi bien "Accès refusé" (masculin,
      // ex. isolation multi-tenant) que "Permission refusée" (féminin) — les use cases de ce
      // controller sont censés préfixer toute erreur d'autorisation par "Accès refusé : ...".
      if (error.message.includes('refusé')) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
