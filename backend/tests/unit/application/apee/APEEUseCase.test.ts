import { describe, it, expect } from 'bun:test';
import { CreerTransactionAPEEUseCase } from '../../../../src/application/apee/CreerTransactionAPEEUseCase.ts';
import { ValiderDepenseAPEEUseCase } from '../../../../src/application/apee/ValiderDepenseAPEEUseCase.ts';

function prismaCreerMock() {
  let tx: { id: string; schoolId: string; creeParId: string; type: string; valide: boolean; justificatifUrl: string | null } | null = null;
  return {
    aPEETransaction: {
      create: async ({ data }: { data: { schoolId: string; creeParId: string; type: string; montant: number; valide: boolean } }) => {
        tx = { id: 'tx1', schoolId: data.schoolId, creeParId: data.creeParId, type: data.type, valide: data.valide, justificatifUrl: null };
        return tx;
      },
      findFirst: async () => tx,
      update: async ({ data }: { data: { valide: boolean; valideParId: string; valideAt: Date } }) => {
        if (tx) Object.assign(tx, data);
        return tx;
      },
    },
  } as unknown as import('@prisma/client').PrismaClient;
}

function prismaValiderMock(overrides: Partial<{ creeParId: string; valide: boolean; justificatifUrl: string | null; type: string }> = {}) {
  const tx = {
    id: 'tx1', schoolId: 'school-1', creeParId: 'user-crea', type: 'DEPENSE', valide: false, justificatifUrl: 'http://justif.pdf',
    ...overrides,
  };
  return {
    aPEETransaction: {
      findFirst: async () => tx as never,
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...tx, ...data }),
    },
  } as unknown as import('@prisma/client').PrismaClient;
}

describe('APEE — CreerTransactionAPEEUseCase', () => {
  it('crée une collecte valide d emblée', async () => {
    const prisma = prismaCreerMock();
    const useCase = new CreerTransactionAPEEUseCase(prisma);
    const tx = await useCase.execute({ schoolId: 'school-1', creeParId: 'u1', type: 'COLLECTE', montant: 5000 });
    expect((tx as { valide: boolean }).valide).toBe(true);
  });
  it('crée une dépense non validée', async () => {
    const prisma = prismaCreerMock();
    const useCase = new CreerTransactionAPEEUseCase(prisma);
    const tx = await useCase.execute({ schoolId: 'school-1', creeParId: 'u1', type: 'DEPENSE', montant: 2000 });
    expect((tx as { valide: boolean }).valide).toBe(false);
  });
  it('rejette un montant non positif', async () => {
    const prisma = prismaCreerMock();
    const useCase = new CreerTransactionAPEEUseCase(prisma);
    await expect(useCase.execute({ schoolId: 'school-1', creeParId: 'u1', type: 'DEPENSE', montant: 0 })).rejects.toThrow('strictement positif');
  });
});

describe('APEE — ValiderDepenseAPEEUseCase (4 yeux + justificatif)', () => {
  it('valide une dépense avec justificatif par un autre utilisateur', async () => {
    const prisma = prismaValiderMock({ creeParId: 'user-crea', justificatifUrl: 'http://justif.pdf' });
    const useCase = new ValiderDepenseAPEEUseCase(prisma);
    const result = await useCase.execute({ schoolId: 'school-1', transactionId: 'tx1', valideParId: 'user-valideur' });
    expect((result as { valide: boolean }).valide).toBe(true);
  });
  it('rejette si le créateur tente de valider lui-même (4 yeux)', async () => {
    const prisma = prismaValiderMock({ creeParId: 'user-1', justificatifUrl: 'http://justif.pdf' });
    const useCase = new ValiderDepenseAPEEUseCase(prisma);
    await expect(useCase.execute({ schoolId: 'school-1', transactionId: 'tx1', valideParId: 'user-1' })).rejects.toThrow('4 yeux');
  });
  it('rejette si aucun justificatif joint', async () => {
    const prisma = prismaValiderMock({ creeParId: 'user-crea', justificatifUrl: null });
    const useCase = new ValiderDepenseAPEEUseCase(prisma);
    await expect(useCase.execute({ schoolId: 'school-1', transactionId: 'tx1', valideParId: 'user-valideur' })).rejects.toThrow('aucun justificatif');
  });
  it('rejette une dépense déjà validée', async () => {
    const prisma = prismaValiderMock({ creeParId: 'user-crea', valide: true, justificatifUrl: 'http://justif.pdf' });
    const useCase = new ValiderDepenseAPEEUseCase(prisma);
    await expect(useCase.execute({ schoolId: 'school-1', transactionId: 'tx1', valideParId: 'user-valideur' })).rejects.toThrow('déjà validée');
  });
  it('rejette une collecte (pas besoin de validation)', async () => {
    const prisma = prismaValiderMock({ creeParId: 'user-crea', type: 'COLLECTE', justificatifUrl: null });
    const useCase = new ValiderDepenseAPEEUseCase(prisma);
    await expect(useCase.execute({ schoolId: 'school-1', transactionId: 'tx1', valideParId: 'user-valideur' })).rejects.toThrow('Seule une dépense');
  });
});
