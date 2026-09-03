import { describe, it, expect } from 'bun:test';
import { ConfigurerEtablissementUseCase, type OnboardingState } from '../../../../src/application/school/ConfigurerEtablissementUseCase.ts';
import { InMemorySchoolActivationRepository } from '../../../helpers/repositories/InMemorySchoolActivationRepository.ts';

class FakeActiver {
  async execute(cmd: { schoolId: string }) {
    return { schoolId: cmd.schoolId, message: 'ok', classCount: 1, subjectCount: 1, academicYear: '2026-2027' } as any;
  }
}

function baseState(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    schoolId: 's1',
    schoolName: 'Lycée Test',
    template: 'LYCEE_FR',
    cycles: ['PREMIER_CYCLE'],
    ...overrides,
  };
}

function makeSchool(status = 'APPROVED') {
  return { id: 's1', name: 'Lycée Test', status, onboardingConfig: null, templateCode: null, template: null, configurationForm: null, features: null } as any;
}

describe('ConfigurerEtablissementUseCase — validation template', () => {
  it('rejette template inconnu', async () => {
    const repo = new InMemorySchoolActivationRepository();
    repo.schools.set('s1', makeSchool());
    const uc = new ConfigurerEtablissementUseCase(repo as never, new FakeActiver() as never);
    await expect(uc.execute(baseState({ template: 'NOT_A_TEMPLATE' }))).rejects.toThrow('Template inconnu');
  });

  it('rejette template vide', async () => {
    const repo = new InMemorySchoolActivationRepository();
    repo.schools.set('s1', makeSchool());
    const uc = new ConfigurerEtablissementUseCase(repo as never, new FakeActiver() as never);
    await expect(uc.execute(baseState({ template: '' as any }))).rejects.toThrow('Template inconnu');
    await expect(uc.execute(baseState({ template: undefined as any }))).rejects.toThrow('Template inconnu');
  });

  it('accepte LYCEE_FR', async () => {
    const repo = new InMemorySchoolActivationRepository();
    repo.schools.set('s1', makeSchool());
    const uc = new ConfigurerEtablissementUseCase(repo as never, new FakeActiver() as never);
    const res = await uc.execute(baseState({ template: 'LYCEE_FR' }));
    expect(res.schoolId).toBe('s1');
  });

  it('accepte SAR_SM (PROFESSIONAL)', async () => {
    const repo = new InMemorySchoolActivationRepository();
    repo.schools.set('s1', makeSchool());
    const uc = new ConfigurerEtablissementUseCase(repo as never, new FakeActiver() as never);
    await expect(uc.execute(baseState({ template: 'SAR_SM' }))).resolves.toBeDefined();
  });
});
