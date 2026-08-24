import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';

export interface SendEmailOTP {
  (params: { recipientEmail: string; otp: string }): Promise<void>;
}

export class LoginMasterUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sendEmail: SendEmailOTP,
  ) {}

  async executeLogin(email: string, password: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    const masterUser = await this.prisma.masterUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (!masterUser || !masterUser.isActive) {
      throw new Error('Identifiants invalides');
    }

    const passwordOk = await bcrypt.compare(password, masterUser.passwordHash);
    if (!passwordOk) {
      throw new Error('Identifiants invalides');
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHashed = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.masterUser.update({
      where: { id: masterUser.id },
      data: {
        loginEmailOtpHash: otpHashed,
        loginEmailOtpExpiresAt: expiresAt,
        loginEmailOtpAttempts: 0,
        loginEmailOtpSentAt: new Date(),
      },
    });

    void this.sendEmail({ recipientEmail: normalizedEmail, otp }).catch(err => console.error('[Email] Échec OTP login:', (err as Error)?.message));
  }

  async executeVerifyOtp(
    email: string,
    otp: string,
  ): Promise<{
    masterUserId: string;
    masterUserEmail: string;
    masterUserName: string;
    mfaRequired: boolean;
    isSuperAdmin: boolean;
    role: string;
  }> {
    const normalizedEmail = email.toLowerCase().trim();

    const masterUser = await this.prisma.masterUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (!masterUser) {
      throw new Error('Code de vérification invalide');
    }

    if (!masterUser.loginEmailOtpHash || !masterUser.loginEmailOtpExpiresAt) {
      throw new Error('Aucun code de vérification demandé. Veuillez vous reconnecter.');
    }

    if (masterUser.loginEmailOtpAttempts >= 5) {
      throw new Error('Trop de tentatives. Veuillez redemander un nouveau code.');
    }

    if (new Date() > masterUser.loginEmailOtpExpiresAt) {
      throw new Error('Le code de vérification a expiré. Veuillez redemander un nouveau code.');
    }

    const otpOk = await bcrypt.compare(otp, masterUser.loginEmailOtpHash);
    if (!otpOk) {
      await this.prisma.masterUser.update({
        where: { id: masterUser.id },
        data: { loginEmailOtpAttempts: { increment: 1 } },
      });
      throw new Error('Code de vérification incorrect');
    }

    await this.prisma.masterUser.update({
      where: { id: masterUser.id },
      data: {
        loginEmailOtpHash: null,
        loginEmailOtpExpiresAt: null,
        loginEmailOtpAttempts: 0,
        loginEmailOtpSentAt: null,
      },
    });

    return {
      masterUserId: masterUser.id,
      masterUserEmail: masterUser.email,
      masterUserName: masterUser.name,
      mfaRequired: masterUser.mfaEnabled,
      isSuperAdmin: masterUser.isSuperAdmin,
      role: masterUser.role,
    };
  }

  // Étape 1 — Envoie un OTP par email pour confirmer le changement de mot de passe
  // (appelé après que requireMasterSensitiveAuth a déjà vérifié l'ancien password + MFA)
  async executeSendPasswordChangeOtp(masterUserId: string): Promise<{ email: string }> {
    const masterUser = await this.prisma.masterUser.findUnique({
      where: { id: masterUserId },
      select: { id: true, email: true, isActive: true },
    });
    if (!masterUser || !masterUser.isActive) throw new Error('Compte introuvable');

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHashed = await bcrypt.hash(otp, 10);

    await this.prisma.masterUser.update({
      where: { id: masterUser.id },
      data: {
        passwordChangeEmailOtpHash: otpHashed,
        passwordChangeEmailOtpExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        passwordChangeEmailOtpAttempts: 0,
        passwordChangeEmailOtpSentAt: new Date(),
      },
    });

    void this.sendEmail({ recipientEmail: masterUser.email, otp }).catch(err => console.error('[Email] Échec OTP password-change:', (err as Error)?.message));
    return { email: masterUser.email };
  }

  // Étape 2 — Vérifie l'OTP email et applique le nouveau mot de passe
  async executeChangePassword(masterUserId: string, newPassword: string, otp: string): Promise<void> {
    await this.appliquerNouveauMotDePasse(masterUserId, newPassword, otp);
  }

  // Forgot password — Étape 1 : envoie un OTP email (sans authentification préalable)
  async executeForgotPasswordOtp(email: string): Promise<{ email: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const masterUser = await this.prisma.masterUser.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, isActive: true },
    });
    if (!masterUser || !masterUser.isActive) throw new Error('Email introuvable');

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHashed = await bcrypt.hash(otp, 10);

    await this.prisma.masterUser.update({
      where: { id: masterUser.id },
      data: {
        passwordChangeEmailOtpHash: otpHashed,
        passwordChangeEmailOtpExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        passwordChangeEmailOtpAttempts: 0,
        passwordChangeEmailOtpSentAt: new Date(),
      },
    });

    void this.sendEmail({ recipientEmail: masterUser.email, otp }).catch(err => console.error('[Email] Échec OTP forgot-password:', (err as Error)?.message));
    return { email: masterUser.email };
  }

  // Forgot password — Étape 2 : vérifie l'OTP email et applique le nouveau mot de passe
  async executeResetForgottenPassword(email: string, newPassword: string, otp: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const masterUser = await this.prisma.masterUser.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, isActive: true },
    });
    if (!masterUser || !masterUser.isActive) throw new Error('Email introuvable');
    await this.appliquerNouveauMotDePasse(masterUser.id, newPassword, otp);
  }

  // Partagé par change-password (authentifié) et forgot-password (publique) :
  // vérifie l'OTP email stocké et applique le nouveau mot de passe.
  private async appliquerNouveauMotDePasse(masterUserId: string, newPassword: string, otp: string): Promise<void> {
    if (newPassword.length < 12) {
      throw new Error('Le mot de passe doit contenir au moins 12 caractères');
    }

    const masterUser = await this.prisma.masterUser.findUnique({
      where: { id: masterUserId },
      select: {
        id: true,
        passwordChangeEmailOtpHash: true,
        passwordChangeEmailOtpExpiresAt: true,
        passwordChangeEmailOtpAttempts: true,
      },
    });
    if (!masterUser) throw new Error('Utilisateur introuvable');

    if (!masterUser.passwordChangeEmailOtpHash) {
      throw new Error('Aucun code de vérification demandé. Recommencez depuis l\'étape 1.');
    }
    if (masterUser.passwordChangeEmailOtpExpiresAt && new Date() > masterUser.passwordChangeEmailOtpExpiresAt) {
      throw new Error('Le code de vérification a expiré. Recommencez.');
    }
    if ((masterUser.passwordChangeEmailOtpAttempts ?? 0) >= 5) {
      throw new Error('Trop de tentatives. Recommencez depuis l\'étape 1.');
    }

    const otpOk = await bcrypt.compare(otp, masterUser.passwordChangeEmailOtpHash);
    if (!otpOk) {
      await this.prisma.masterUser.update({
        where: { id: masterUser.id },
        data: { passwordChangeEmailOtpAttempts: { increment: 1 } },
      });
      throw new Error('Code de vérification incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.masterUser.update({
      where: { id: masterUser.id },
      data: {
        passwordHash,
        passwordChangeEmailOtpHash: null,
        passwordChangeEmailOtpExpiresAt: null,
        passwordChangeEmailOtpAttempts: 0,
        passwordChangeEmailOtpSentAt: null,
      },
    });
  }

  async executeResendOtp(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    const masterUser = await this.prisma.masterUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (!masterUser || !masterUser.isActive) {
      throw new Error('Email invalide');
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHashed = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.masterUser.update({
      where: { id: masterUser.id },
      data: {
        loginEmailOtpHash: otpHashed,
        loginEmailOtpExpiresAt: expiresAt,
        loginEmailOtpAttempts: 0,
        loginEmailOtpSentAt: new Date(),
      },
    });

    void this.sendEmail({ recipientEmail: normalizedEmail, otp }).catch(err => console.error('[Email] Échec OTP resend:', (err as Error)?.message));
  }
}
