/**
 * APPLICATION LAYER — Use Case : connexion du Fondateur de Groupe (SchoolGroupOwner)
 *
 * Miroir de LoginMasterUseCase (partie OTP) — compte séparé au même titre que MasterUser,
 * voir Plan_Groupe_Scolaire_ZekoulABia.md Section 1/3.
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';

export interface SendEmailOTP {
  (params: { recipientEmail: string; otp: string }): Promise<void>;
}

export class LoginGroupOwnerUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sendEmail: SendEmailOTP,
  ) {}

  async executeLogin(email: string, password: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    const owner = await this.prisma.schoolGroupOwner.findUnique({
      where: { email: normalizedEmail },
    });

    if (!owner || !owner.isActive) {
      throw new Error('Identifiants invalides');
    }

    const passwordOk = await bcrypt.compare(password, owner.passwordHash);
    if (!passwordOk) {
      throw new Error('Identifiants invalides');
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHashed = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.schoolGroupOwner.update({
      where: { id: owner.id },
      data: {
        loginEmailOtpHash: otpHashed,
        loginEmailOtpExpiresAt: expiresAt,
        loginEmailOtpAttempts: 0,
        loginEmailOtpSentAt: new Date(),
      },
    });

    void this.sendEmail({ recipientEmail: normalizedEmail, otp }).catch(err =>
      console.error('[Email] Échec OTP login groupe scolaire:', (err as Error)?.message),
    );
  }

  async executeVerifyOtp(
    email: string,
    otp: string,
  ): Promise<{
    ownerId: string;
    ownerEmail: string;
    ownerName: string;
    mfaRequired: boolean;
  }> {
    const normalizedEmail = email.toLowerCase().trim();

    const owner = await this.prisma.schoolGroupOwner.findUnique({
      where: { email: normalizedEmail },
    });

    if (!owner) {
      throw new Error('Code de vérification invalide');
    }

    if (!owner.loginEmailOtpHash || !owner.loginEmailOtpExpiresAt) {
      throw new Error('Aucun code de vérification demandé. Veuillez vous reconnecter.');
    }

    if (owner.loginEmailOtpAttempts >= 5) {
      throw new Error('Trop de tentatives. Veuillez redemander un nouveau code.');
    }

    if (new Date() > owner.loginEmailOtpExpiresAt) {
      throw new Error('Le code de vérification a expiré. Veuillez redemander un nouveau code.');
    }

    const otpOk = await bcrypt.compare(otp, owner.loginEmailOtpHash);
    if (!otpOk) {
      await this.prisma.schoolGroupOwner.update({
        where: { id: owner.id },
        data: { loginEmailOtpAttempts: { increment: 1 } },
      });
      throw new Error('Code de vérification incorrect');
    }

    await this.prisma.schoolGroupOwner.update({
      where: { id: owner.id },
      data: {
        loginEmailOtpHash: null,
        loginEmailOtpExpiresAt: null,
        loginEmailOtpAttempts: 0,
        loginEmailOtpSentAt: null,
      },
    });

    return {
      ownerId: owner.id,
      ownerEmail: owner.email,
      ownerName: owner.name,
      mfaRequired: owner.mfaEnabled,
    };
  }

  async executeResendOtp(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    const owner = await this.prisma.schoolGroupOwner.findUnique({
      where: { email: normalizedEmail },
    });

    if (!owner || !owner.isActive) {
      throw new Error('Email invalide');
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHashed = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.schoolGroupOwner.update({
      where: { id: owner.id },
      data: {
        loginEmailOtpHash: otpHashed,
        loginEmailOtpExpiresAt: expiresAt,
        loginEmailOtpAttempts: 0,
        loginEmailOtpSentAt: new Date(),
      },
    });

    void this.sendEmail({ recipientEmail: normalizedEmail, otp }).catch(err =>
      console.error('[Email] Échec OTP resend groupe scolaire:', (err as Error)?.message),
    );
  }
}
