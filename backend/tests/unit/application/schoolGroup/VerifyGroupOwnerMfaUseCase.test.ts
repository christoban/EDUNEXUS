import { describe, it, expect } from 'bun:test';
import { VerifyGroupOwnerMfaUseCase } from '../../../../src/application/schoolGroup/VerifyGroupOwnerMfaUseCase.ts';
import { generateSecret, generateSync } from 'otplib';
import bcrypt from 'bcryptjs';

function prismaMock(owner: { id: string; email: string; name: string; mfaEnabled: boolean; mfaSecret: string | null; mfaRecoveryCodeHashes: string[] } | null) {
  const store: { owner: typeof owner } = { owner };
  return {
    schoolGroupOwner: {
      findUnique: async () => store.owner,
      update: async ({ data }: { data: { mfaRecoveryCodeHashes: string[] } }) => {
        if (store.owner) store.owner.mfaRecoveryCodeHashes = data.mfaRecoveryCodeHashes;
      },
    },
  } as unknown as import('@prisma/client').PrismaClient;
}

const baseOwner = { id: 'o1', email: 'owner@groupe.cm', name: 'Owner' };

describe('VerifyGroupOwnerMfaUseCase (V0.3)', () => {
  const secret = generateSecret();

  it('getMfaStatus false si non configuré', async () => {
    const prisma = prismaMock({ ...baseOwner, mfaEnabled: false, mfaSecret: null, mfaRecoveryCodeHashes: [] });
    const useCase = new VerifyGroupOwnerMfaUseCase(prisma);
    expect(await useCase.getMfaStatus('o1')).toEqual({ mfaEnabled: false });
  });

  it('valide un TOTP correct', async () => {
    const prisma = prismaMock({ ...baseOwner, mfaEnabled: true, mfaSecret: secret, mfaRecoveryCodeHashes: [] });
    const useCase = new VerifyGroupOwnerMfaUseCase(prisma);
    const token = generateSync({ secret });
    const result = await useCase.execute('o1', token);
    expect(result.email).toBe(baseOwner.email);
  });

  it('rejette si MFA non configuré', async () => {
    const prisma = prismaMock({ ...baseOwner, mfaEnabled: false, mfaSecret: null, mfaRecoveryCodeHashes: [] });
    const useCase = new VerifyGroupOwnerMfaUseCase(prisma);
    await expect(useCase.execute('o1', '123456')).rejects.toThrow('MFA non configuré');
  });

  it('rejette un code invalide', async () => {
    const prisma = prismaMock({ ...baseOwner, mfaEnabled: true, mfaSecret: secret, mfaRecoveryCodeHashes: [] });
    const useCase = new VerifyGroupOwnerMfaUseCase(prisma);
    await expect(useCase.execute('o1', '000000')).rejects.toThrow('Code MFA invalide');
  });

  it('valide un code de récupération', async () => {
    const recovery = 'QWER-5678';
    const hash = await bcrypt.hash('QWER5678', 4);
    const prisma = prismaMock({ ...baseOwner, mfaEnabled: true, mfaSecret: secret, mfaRecoveryCodeHashes: [hash] });
    const useCase = new VerifyGroupOwnerMfaUseCase(prisma);
    const result = await useCase.execute('o1', recovery);
    expect(result.email).toBe(baseOwner.email);
  });
});
