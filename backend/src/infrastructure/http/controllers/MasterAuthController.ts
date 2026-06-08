import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logMasterAuthAudit } from '../../../utils/masterAuthAudit';
import { LoginMasterUseCase } from '../../../application/masterAdmin/LoginMasterUseCase';
import { VerifyMfaUseCase } from '../../../application/masterAdmin/VerifyMfaUseCase';

const getMasterSecret = (): string =>
  process.env.MASTER_JWT_SECRET || process.env.JWT_SECRET || '';

export class MasterAuthController {
  constructor(
    private readonly loginUseCase: LoginMasterUseCase,
    private readonly verifyMfaUseCase: VerifyMfaUseCase,
  ) {}

  login = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
        return;
      }
      await this.loginUseCase.executeLogin(email, password);
      void logMasterAuthAudit({ req, outcome: 'success', reason: 'login_otp_sent', email });
      res.json({ success: true, message: 'Code de vérification envoyé par email' });
    } catch (error: any) {
      void logMasterAuthAudit({ req, outcome: 'failure', reason: 'login_failed', email: req.body?.email });
      res.status(401).json({ success: false, message: error.message || 'Erreur de connexion' });
    }
  };

  verifyOtp = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        res.status(400).json({ success: false, message: 'Email et code OTP requis' });
        return;
      }
      const result = await this.loginUseCase.executeVerifyOtp(email, otp);
      void logMasterAuthAudit({ req, outcome: 'success', reason: 'otp_verified', email });

      const secret = getMasterSecret();

      if (!result.mfaRequired) {
        const token = jwt.sign(
          { id: result.masterUserId, email: result.masterUserEmail, role: result.isSuperAdmin ? 'super_admin' : result.role.toLowerCase(), tokenType: 'master' },
          secret,
          { expiresIn: '30d', algorithm: 'HS512' },
        );
        res.cookie('master_jwt', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60 * 1000,
          path: '/',
        });
        res.json({ success: true, mfaRequired: false });
      } else {
        const tempToken = jwt.sign(
          { id: result.masterUserId, email: result.masterUserEmail, tokenType: 'master_temp' },
          secret,
          { expiresIn: '10m', algorithm: 'HS512' },
        );
        res.cookie('temp_master_token', tempToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 10 * 60 * 1000,
          path: '/',
        });
        res.json({ success: true, mfaRequired: true, email: result.masterUserEmail });
      }
    } catch (error: any) {
      void logMasterAuthAudit({ req, outcome: 'failure', reason: 'otp_verification_failed', email: req.body?.email });
      res.status(401).json({ success: false, message: error.message || 'Code invalide' });
    }
  };

  verifyMfa = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const rawTempToken = req.cookies?.temp_master_token;
      if (!rawTempToken) {
        res.status(401).json({ success: false, message: 'Session temporaire expirée. Veuillez vous reconnecter.' });
        return;
      }

      let decoded: { id: string; email: string; tokenType: string };
      try {
        decoded = jwt.verify(rawTempToken, getMasterSecret(), { algorithms: ['HS512'] }) as typeof decoded;
      } catch {
        res.status(401).json({ success: false, message: 'Session temporaire expirée. Veuillez vous reconnecter.' });
        return;
      }

      if (decoded.tokenType !== 'master_temp') {
        res.status(401).json({ success: false, message: 'Token temporaire invalide' });
        return;
      }

      const { code } = req.body;
      if (!code) {
        res.status(400).json({ success: false, message: 'Code MFA requis' });
        return;
      }

      const result = await this.verifyMfaUseCase.execute(decoded.id, code);
      void logMasterAuthAudit({ req, outcome: 'success', reason: 'mfa_verified', email: result.email });

      const token = jwt.sign(
        { id: decoded.id, email: result.email, role: result.isSuperAdmin ? 'super_admin' : result.role.toLowerCase(), tokenType: 'master' },
        getMasterSecret(),
        { expiresIn: '30d', algorithm: 'HS512' },
      );
      res.cookie('master_jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/',
      });
      res.clearCookie('temp_master_token', { path: '/' });
      res.json({ success: true, message: 'Authentification réussie' });
    } catch (error: any) {
      void logMasterAuthAudit({ req, outcome: 'failure', reason: 'mfa_verification_failed', email: req.body?.email });
      res.status(401).json({ success: false, message: error.message || 'Code MFA invalide' });
    }
  };

  resendOtp = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ success: false, message: 'Email requis' });
        return;
      }
      await this.loginUseCase.executeResendOtp(email);
      void logMasterAuthAudit({ req, outcome: 'success', reason: 'otp_resend', email });
      res.json({ success: true, message: 'Nouveau code de vérification envoyé' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Erreur lors du renvoi' });
    }
  };

  me = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: req.masterUser });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  mfaStatus = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const user = await this.verifyMfaUseCase.getMfaStatus(req.masterUser!.id);
      res.json({ success: true, data: user });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  changePassword = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { newPassword } = req.body;
      if (!newPassword) {
        res.status(400).json({ success: false, message: 'Nouveau mot de passe requis' });
        return;
      }
      await this.loginUseCase.executeChangePassword(req.masterUser!.id, newPassword);
      void logMasterAuthAudit({ req, outcome: 'success', reason: 'password_changed_from_security_dashboard', email: req.masterUser?.email });
      res.json({ success: true, message: 'Mot de passe modifié avec succès' });
    } catch (error: any) {
      void logMasterAuthAudit({ req, outcome: 'failure', reason: 'password_change_failed', email: req.masterUser?.email });
      res.status(400).json({ success: false, message: error.message || 'Erreur' });
    }
  };

  logout = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      void logMasterAuthAudit({ req, outcome: 'success', reason: 'logout', email: req.masterUser?.email });
      res.clearCookie('master_jwt', { path: '/' });
      res.clearCookie('temp_master_token', { path: '/' });
      res.json({ success: true, message: 'Déconnexion réussie' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
}
