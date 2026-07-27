/**
 * APPLICATION LAYER — Use Case : vérification MFA du Fondateur de Groupe
 * Miroir de VerifyMfaUseCase (MasterUser) — voir Plan_Groupe_Scolaire_ZekoulABia.md Section 3.
 */
import bcrypt from 'bcryptjs';
import { verifySync } from 'otplib';
import type { PrismaClient } from '@prisma/client';

export class VerifyGroupOwnerMfaUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async getMfaStatus(ownerId: string): Promise<{ mfaEnabled: boolean }> {
    const owner = await this.prisma.schoolGroupOwner.findUnique({
      where: { id: ownerId },
      select: { mfaEnabled: true },
    });
    return { mfaEnabled: owner?.mfaEnabled ?? false };
  }

  async execute(
    ownerId: string,
    code: string,
  ): Promise<{ email: string; name: string }> {
    const owner = await this.prisma.schoolGroupOwner.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        email: true,
        name: true,
        mfaEnabled: true,
        mfaSecret: true,
        mfaRecoveryCodeHashes: true,
      },
    });

    if (!owner || !owner.mfaEnabled) {
      throw new Error('MFA non configuré');
    }

    if (owner.mfaSecret) {
      try {
        const totpValid = verifySync({ token: code, secret: owner.mfaSecret }).valid;
        if (totpValid) {
          return { email: owner.email, name: owner.name };
        }
      } catch {
        /* fall through to recovery code check */
      }
    }

    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const hashes = owner.mfaRecoveryCodeHashes || [];

    for (let i = 0; i < hashes.length; i++) {
      const hash = hashes[i];
      if (!hash) continue;
      const matches = await bcrypt.compare(normalized, hash);
      if (matches) {
        const updated = [...hashes];
        updated.splice(i, 1);
        await this.prisma.schoolGroupOwner.update({
          where: { id: owner.id },
          data: { mfaRecoveryCodeHashes: updated },
        });
        return { email: owner.email, name: owner.name };
      }
    }

    throw new Error('Code MFA invalide');
  }
}
