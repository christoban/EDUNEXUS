import bcrypt from 'bcryptjs';
import { verifySync } from 'otplib';
import type { PrismaClient } from '@prisma/client';

export class VerifyMfaUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async getMfaStatus(masterUserId: string): Promise<{ mfaEnabled: boolean }> {
    const masterUser = await this.prisma.masterUser.findUnique({
      where: { id: masterUserId },
      select: { mfaEnabled: true },
    });
    return { mfaEnabled: masterUser?.mfaEnabled ?? false };
  }

  async execute(
    masterUserId: string,
    code: string,
  ): Promise<{
    email: string;
    name: string;
    role: string;
    isSuperAdmin: boolean;
  }> {
    const masterUser = await this.prisma.masterUser.findUnique({
      where: { id: masterUserId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isSuperAdmin: true,
        mfaEnabled: true,
        mfaSecret: true,
        mfaRecoveryCodeHashes: true,
      },
    });

    if (!masterUser || !masterUser.mfaEnabled) {
      throw new Error('MFA non configuré');
    }

    if (masterUser.mfaSecret) {
      try {
        const totpValid = verifySync({ token: code, secret: masterUser.mfaSecret }).valid;
        if (totpValid) {
          return {
            email: masterUser.email,
            name: masterUser.name,
            role: masterUser.role,
            isSuperAdmin: masterUser.isSuperAdmin,
          };
        }
      } catch {
        /* fall through to recovery code check */
      }
    }

    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const hashes = masterUser.mfaRecoveryCodeHashes || [];

    for (let i = 0; i < hashes.length; i++) {
      const hash = hashes[i];
      if (!hash) continue;
      const matches = await bcrypt.compare(normalized, hash);
      if (matches) {
        const updated = [...hashes];
        updated.splice(i, 1);
        await this.prisma.masterUser.update({
          where: { id: masterUser.id },
          data: { mfaRecoveryCodeHashes: updated },
        });
        return {
          email: masterUser.email,
          name: masterUser.name,
          role: masterUser.role,
          isSuperAdmin: masterUser.isSuperAdmin,
        };
      }
    }

    throw new Error('Code MFA invalide');
  }
}
