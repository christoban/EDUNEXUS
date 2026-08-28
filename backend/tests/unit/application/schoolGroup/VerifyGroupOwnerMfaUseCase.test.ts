import { describe, it, expect } from 'bun:test';
import { VerifyGroupOwnerMfaUseCase } from '../../../../src/application/schoolGroup/VerifyGroupOwnerMfaUseCase.ts';
import { InMemorySchoolGroupOwnerAuthRepository } from '../../../helpers/repositories/InMemorySchoolGroupOwnerAuthRepository.ts';
import { generateSecret, generateSync } from 'otplib';
import bcrypt from 'bcryptjs';
import type { GroupOwnerAuthData } from '@domain/ports/repositories/SchoolGroupOwnerAuthRepository';

function repoMock(owner: Partial<GroupOwnerAuthData> & { id: string; email: string; name: string; mfaEnabled: boolean; mfaSecret: string | null; mfaRecoveryCodeHashes: string[] }) {
  const repo = new InMemorySchoolGroupOwnerAuthRepository();
  repo.setOwner({
    id: owner.id,
    email: owner.email,
    name: owner.name,
    isActive: true,
    passwordHash: 'hash',
    mfaEnabled: owner.mfaEnabled,
    mfaSecret: owner.mfaSecret,
    mfaTempSecret: null,
    mfaRecoveryCodeHashes: owner.mfaRecoveryCodeHashes,
    loginEmailOtpHash: null,
    loginEmailOtpExpiresAt: null,
    loginEmailOtpAttempts: 0,
    loginEmailOtpSentAt: null,
  });
  return repo;
}

const baseOwner = { id: 'o1', email: 'owner@groupe.cm', name: 'Owner' };

describe('VerifyGroupOwnerMfaUseCase (V0.3)', () => {
  const secret = generateSecret();

  it('getMfaStatus false si non configuré', async () => {
    const repo = repoMock({ ...baseOwner, mfaEnabled: false, mfaSecret: null, mfaRecoveryCodeHashes: [] });
    const useCase = new VerifyGroupOwnerMfaUseCase(repo);
    expect(await useCase.getMfaStatus('o1')).toEqual({ mfaEnabled: false });
  });

  it('valide un TOTP correct', async () => {
    const repo = repoMock({ ...baseOwner, mfaEnabled: true, mfaSecret: secret, mfaRecoveryCodeHashes: [] });
    const useCase = new VerifyGroupOwnerMfaUseCase(repo);
    const token = generateSync({ secret });
    const result = await useCase.execute('o1', token);
    expect(result.email).toBe(baseOwner.email);
  });

  it('rejette si MFA non configuré', async () => {
    const repo = repoMock({ ...baseOwner, mfaEnabled: false, mfaSecret: null, mfaRecoveryCodeHashes: [] });
    const useCase = new VerifyGroupOwnerMfaUseCase(repo);
    await expect(useCase.execute('o1', '123456')).rejects.toThrow('MFA non configuré');
  });

  it('rejette un code invalide', async () => {
    const repo = repoMock({ ...baseOwner, mfaEnabled: true, mfaSecret: secret, mfaRecoveryCodeHashes: [] });
    const useCase = new VerifyGroupOwnerMfaUseCase(repo);
    await expect(useCase.execute('o1', '000000')).rejects.toThrow('Code MFA invalide');
  });

  it('valide un code de récupération', async () => {
    const recovery = 'QWER-5678';
    const hash = await bcrypt.hash('QWER5678', 4);
    const repo = repoMock({ ...baseOwner, mfaEnabled: true, mfaSecret: secret, mfaRecoveryCodeHashes: [hash] });
    const useCase = new VerifyGroupOwnerMfaUseCase(repo);
    const result = await useCase.execute('o1', recovery);
    expect(result.email).toBe(baseOwner.email);
  });
});
