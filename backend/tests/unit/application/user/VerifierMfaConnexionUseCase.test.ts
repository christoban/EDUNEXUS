import { describe, it, expect } from 'bun:test';
import { VerifierMfaConnexionUseCase } from '../../../../src/application/user/VerifierMfaConnexionUseCase.ts';
import { generateSecret, generateSync } from 'otplib';
import bcrypt from 'bcryptjs';

function prismaMock(user: { id: string; mfaEnabled: boolean; mfaSecret: string | null; mfaRecoveryCodeHashes: string[] } | null) {
  const store = { user };
  return {
    user: {
      findUnique: async () => store.user,
      update: async ({ data }: { data: { mfaRecoveryCodeHashes: string[] } }) => {
        if (store.user) store.user.mfaRecoveryCodeHashes = data.mfaRecoveryCodeHashes;
      },
    },
  } as unknown as import('@prisma/client').PrismaClient;
}

describe('VerifierMfaConnexionUseCase (V0.3)', () => {
  const secret = generateSecret();

  it('valide un TOTP correct', async () => {
    const prisma = prismaMock({ id: 'u1', mfaEnabled: true, mfaSecret: secret, mfaRecoveryCodeHashes: [] });
    const useCase = new VerifierMfaConnexionUseCase(prisma);
    const token = generateSync({ secret });
    await expect(useCase.execute('u1', token)).resolves.toBeUndefined();
  });

  it('rejette si MFA non configuré (mfaEnabled false)', async () => {
    const prisma = prismaMock({ id: 'u1', mfaEnabled: false, mfaSecret: secret, mfaRecoveryCodeHashes: [] });
    const useCase = new VerifierMfaConnexionUseCase(prisma);
    await expect(useCase.execute('u1', '123456')).rejects.toThrow('MFA non configuré');
  });

  it('rejette si utilisateur introuvable', async () => {
    const prisma = prismaMock(null);
    const useCase = new VerifierMfaConnexionUseCase(prisma);
    await expect(useCase.execute('u1', '123456')).rejects.toThrow('MFA non configuré');
  });

  it('rejette un code invalide (ni TOTP ni recovery)', async () => {
    const prisma = prismaMock({ id: 'u1', mfaEnabled: true, mfaSecret: secret, mfaRecoveryCodeHashes: [] });
    const useCase = new VerifierMfaConnexionUseCase(prisma);
    await expect(useCase.execute('u1', '000000')).rejects.toThrow('Code MFA invalide');
  });

  it('valide un code de récupération et le consomme', async () => {
    const recovery = 'ABCD-1234';
    const hash = await bcrypt.hash(recovery.toUpperCase().replace(/[^A-Z0-9]/g, ''), 4);
    const prisma = prismaMock({ id: 'u1', mfaEnabled: true, mfaSecret: secret, mfaRecoveryCodeHashes: [hash] });
    const useCase = new VerifierMfaConnexionUseCase(prisma);
    await useCase.execute('u1', recovery);
    // Le code est consommé (tableau vidé)
    expect((await prisma.user.findUnique({} as never) as unknown as { mfaRecoveryCodeHashes: string[] }).mfaRecoveryCodeHashes).toHaveLength(0);
  });

  it('normalise le code de récupération (trim, uppercase, tirets)', async () => {
    const recovery = 'abcd-1234';
    const hash = await bcrypt.hash('ABCD1234', 4);
    const prisma = prismaMock({ id: 'u1', mfaEnabled: true, mfaSecret: secret, mfaRecoveryCodeHashes: [hash] });
    const useCase = new VerifierMfaConnexionUseCase(prisma);
    await expect(useCase.execute('u1', '  abcd-1234  ')).resolves.toBeUndefined();
  });
});
