import { describe, it, expect } from 'bun:test';
import { LoginMasterUseCase } from '../../../../src/application/masterAdmin/LoginMasterUseCase.ts';
import bcrypt from 'bcryptjs';

type MasterStore = {
  id: string;
  email: string;
  isActive: boolean;
  passwordHash: string;
  passwordChangeEmailOtpHash: string | null;
  passwordChangeEmailOtpExpiresAt: Date | null;
  passwordChangeEmailOtpAttempts: number;
};

function makeStore(overrides: Partial<MasterStore> = {}): MasterStore {
  return {
    id: 'm1',
    email: 'master@zekoulabia.cm',
    isActive: true,
    passwordHash: 'hash-initial',
    passwordChangeEmailOtpHash: null,
    passwordChangeEmailOtpExpiresAt: null,
    passwordChangeEmailOtpAttempts: 0,
    ...overrides,
  };
}

function prismaMock(store: MasterStore) {
  return {
    masterUser: {
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.id && where.id !== store.id) return null;
        if (where.email && where.email !== store.email) return null;
        return store;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'object' && value !== null && 'increment' in value) {
            const record = store as unknown as Record<string, number>;
            record[key] = record[key] + (value as { increment: number }).increment;
          } else {
            (store as unknown as Record<string, unknown>)[key] = value;
          }
        }
        return store;
      },
    },
  } as unknown as import('@prisma/client').PrismaClient;
}

function makeUseCase(store: MasterStore) {
  const sent: string[] = [];
  const useCase = new LoginMasterUseCase(prismaMock(store), async ({ otp }) => { sent.push(otp); });
  return { useCase, sent };
}

describe('LoginMasterUseCase — forgot password (récupération Master)', () => {
  it('envoie un OTP et permet de réinitialiser avec le bon code', async () => {
    const store = makeStore();
    const { useCase, sent } = makeUseCase(store);

    await useCase.executeForgotPasswordOtp(store.email);
    expect(sent.length).toBe(1);

    const newPassword = 'NouveauMotDePasseS3curisé!';
    await useCase.executeResetForgottenPassword(store.email, newPassword, sent[0]);

    const hashOk = await bcrypt.compare(newPassword, store.passwordHash);
    expect(hashOk).toBe(true);
    expect(store.passwordChangeEmailOtpHash).toBeNull();
  });

  it('rejette un code OTP incorrect et incrémente les tentatives', async () => {
    const store = makeStore();
    const { useCase, sent } = makeUseCase(store);

    await useCase.executeForgotPasswordOtp(store.email);

    await expect(
      useCase.executeResetForgottenPassword(store.email, 'NouveauMotDePasseS3curisé!', '000000'),
    ).rejects.toThrow('Code de vérification incorrect');
    expect(store.passwordChangeEmailOtpAttempts).toBe(1);
  });

  it('rejette un code expiré', async () => {
    const store = makeStore();
    const { useCase, sent } = makeUseCase(store);

    await useCase.executeForgotPasswordOtp(store.email);
    store.passwordChangeEmailOtpExpiresAt = new Date(Date.now() - 1000);

    await expect(
      useCase.executeResetForgottenPassword(store.email, 'NouveauMotDePasseS3curisé!', sent[0]),
    ).rejects.toThrow('Le code de vérification a expiré');
  });

  it('rejette un mot de passe de moins de 12 caractères', async () => {
    const store = makeStore();
    const { useCase, sent } = makeUseCase(store);

    await useCase.executeForgotPasswordOtp(store.email);

    await expect(
      useCase.executeResetForgottenPassword(store.email, 'court', sent[0]),
    ).rejects.toThrow('au moins 12 caractères');
  });

  it('rejette un email inconnu ou un compte inactif', async () => {
    const store = makeStore();
    const { useCase } = makeUseCase(store);

    await expect(useCase.executeForgotPasswordOtp('inconnu@example.com')).rejects.toThrow('Email introuvable');

    store.isActive = false;
    await expect(useCase.executeForgotPasswordOtp(store.email)).rejects.toThrow('Email introuvable');
  });
});