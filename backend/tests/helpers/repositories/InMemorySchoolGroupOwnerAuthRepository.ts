import type {
  SchoolGroupOwnerAuthRepository,
  GroupOwnerAuthData,
} from '@domain/ports/repositories/SchoolGroupOwnerAuthRepository';

export class InMemorySchoolGroupOwnerAuthRepository implements SchoolGroupOwnerAuthRepository {
  private store = new Map<string, GroupOwnerAuthData>();

  setOwner(owner: GroupOwnerAuthData): void {
    this.store.set(owner.id, owner);
  }

  async findByEmail(email: string): Promise<GroupOwnerAuthData | null> {
    return [...this.store.values()].find((o) => o.email === email) ?? null;
  }

  async findById(ownerId: string): Promise<GroupOwnerAuthData | null> {
    return this.store.get(ownerId) ?? null;
  }

  async getMfaStatus(ownerId: string): Promise<{ mfaEnabled: boolean }> {
    const owner = this.store.get(ownerId);
    return { mfaEnabled: owner?.mfaEnabled ?? false };
  }

  async updateLoginOtp(ownerId: string, data: { loginEmailOtpHash: string; loginEmailOtpExpiresAt: Date; loginEmailOtpAttempts: number; loginEmailOtpSentAt: Date }): Promise<void> {
    const owner = this.store.get(ownerId);
    if (owner) Object.assign(owner, data);
  }

  async incrementLoginOtpAttempts(ownerId: string): Promise<void> {
    const owner = this.store.get(ownerId);
    if (owner) owner.loginEmailOtpAttempts += 1;
  }

  async clearLoginOtp(ownerId: string): Promise<void> {
    const owner = this.store.get(ownerId);
    if (owner) {
      owner.loginEmailOtpHash = null;
      owner.loginEmailOtpExpiresAt = null;
      owner.loginEmailOtpAttempts = 0;
      owner.loginEmailOtpSentAt = null;
    }
  }

  async updateMfaRecoveryCodes(ownerId: string, hashes: string[]): Promise<void> {
    const owner = this.store.get(ownerId);
    if (owner) owner.mfaRecoveryCodeHashes = hashes;
  }
}