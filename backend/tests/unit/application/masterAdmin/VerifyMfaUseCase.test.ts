import { describe, it, expect } from 'bun:test';
import { VerifyMfaUseCase } from '../../../../src/application/masterAdmin/VerifyMfaUseCase.ts';
import { generateSecret, generateSync } from 'otplib';
import bcrypt from 'bcryptjs';

function prismaMock(masterUser: { id: string; email: string; name: string; role: string; isSuperAdmin: boolean; mfaEnabled: boolean; mfaSecret: string | null; mfaRecoveryCodeHashes: string[] } | null) {
  const store: { masterUser: typeof masterUser } = { masterUser };
  return {
    masterUser: {
      findUnique: async () => store.masterUser,
      update: async ({ data }: { data: { mfaRecoveryCodeHashes: string[] } }) => {
        if (store.masterUser) store.masterUser.mfaRecoveryCodeHashes = data.mfaRecoveryCodeHashes;
      },
    },
  } as unknown as import('@prisma/client').PrismaClient;
}

const baseMaster = { id: 'm1', email: 'master@zekoulabia.cm', name: 'Master', role: 'SUPPORT', isSuperAdmin: false };

describe('VerifyMfaUseCase (V0.3)', () => {
  const secret = generateSecret();

  it('getMfaStatus retourne false si non configuré', async () => {
    const prisma = prismaMock({ ...baseMaster, mfaEnabled: false, mfaSecret: null, mfaRecoveryCodeHashes: [] });
    const useCase = new VerifyMfaUseCase(prisma);
    expect(await useCase.getMfaStatus('m1')).toEqual({ mfaEnabled: false });
  });

  it('getMfaStatus retourne true si activé', async () => {
    const prisma = prismaMock({ ...baseMaster, mfaEnabled: true, mfaSecret: secret, mfaRecoveryCodeHashes: [] });
    const useCase = new VerifyMfaUseCase(prisma);
    expect(await useCase.getMfaStatus('m1')).toEqual({ mfaEnabled: true });
  });

  it('valide un TOTP correct et retourne les infos', async () => {
    const prisma = prismaMock({ ...baseMaster, mfaEnabled: true, mfaSecret: secret, mfaRecoveryCodeHashes: [] });
    const useCase = new VerifyMfaUseCase(prisma);
    const token = generateSync({ secret });
    const result = await useCase.execute('m1', token);
    expect(result.email).toBe(baseMaster.email);
  });

  it('rejette si MFA non configuré', async () => {
    const prisma = prismaMock({ ...baseMaster, mfaEnabled: false, mfaSecret: null, mfaRecoveryCodeHashes: [] });
    const useCase = new VerifyMfaUseCase(prisma);
    await expect(useCase.execute('m1', '123456')).rejects.toThrow('MFA non configuré');
  });

  it('rejette un code invalide', async () => {
    const prisma = prismaMock({ ...baseMaster, mfaEnabled: true, mfaSecret: secret, mfaRecoveryCodeHashes: [] });
    const useCase = new VerifyMfaUseCase(prisma);
    await expect(useCase.execute('m1', '000000')).rejects.toThrow('Code MFA invalide');
  });

  it('valide un code de récupération', async () => {
    const recovery = 'WXYZ-9999';
    const hash = await bcrypt.hash('WXYZ9999', 4);
    const prisma = prismaMock({ ...baseMaster, mfaEnabled: true, mfaSecret: secret, mfaRecoveryCodeHashes: [hash] });
    const useCase = new VerifyMfaUseCase(prisma);
    const result = await useCase.execute('m1', recovery);
    expect(result.email).toBe(baseMaster.email);
  });
});
