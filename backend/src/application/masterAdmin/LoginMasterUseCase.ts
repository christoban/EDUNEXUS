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

    await this.sendEmail({ recipientEmail: normalizedEmail, otp });
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

  async executeChangePassword(masterUserId: string, newPassword: string): Promise<void> {
    if (newPassword.length < 12) {
      throw new Error('Le mot de passe doit contenir au moins 12 caractères');
    }
    const masterUser = await this.prisma.masterUser.findUnique({
      where: { id: masterUserId },
      select: { id: true },
    });
    if (!masterUser) throw new Error('Utilisateur introuvable');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.masterUser.update({
      where: { id: masterUserId },
      data: { passwordHash },
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

    await this.sendEmail({ recipientEmail: normalizedEmail, otp });
  }
}
