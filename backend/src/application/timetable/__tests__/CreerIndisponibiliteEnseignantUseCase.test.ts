import { describe, it, expect } from 'bun:test';
import { CreerIndisponibiliteEnseignantUseCase } from '../CreerIndisponibiliteEnseignantUseCase';
import { TeacherUnavailability } from '@domain/entities/TeacherUnavailability';

function userStub(overrides: Partial<{ id: string; schoolId: string; nomComplet: string; role: string }> = {}): {
  id: string;
  schoolId: string;
  nomComplet: string;
  role: string;
  estEnseignant: (r: string) => boolean;
} {
  const base = {
    id: 'prof-1', schoolId: 'school-1', nomComplet: 'M. Test', role: 'TEACHER',
    estEnseignant: (r) => (overrides.role ?? 'TEACHER') === r,
  } as const;
  return {
    id: base.id,
    schoolId: base.schoolId,
    nomComplet: base.nomComplet,
    role: base.role,
    estEnseignant: base.estEnseignant,
  };
}

function repositoryStub(existantes: TeacherUnavailability[] = []): {
  findByTeacher: (teacherId: string, schoolId: string, activeOnly?: boolean) => Promise<TeacherUnavailability[]>;
  save: (u: TeacherUnavailability) => Promise<void>;
} {
  const enregistrees: TeacherUnavailability[] = [];
  return {
    findByTeacher: async (teacherId, schoolId, activeOnly) => {
      // Simule le filtrage schoolId + activeOnly
      return existantes.filter(t => t.schoolId === schoolId && (!activeOnly || t.active));
    },
    save: async (u) => { enregistrees.push(u); },
  };
}

describe('CreerIndisponibiliteEnseignantUseCase (V2.4)', () => {
  it('crée une indisponibilité valide', async () => {
    const repo = repositoryStub();
    const useCase = new CreerIndisponibiliteEnseignantUseCase(repo, {
      findById: userStub(),
    });
    const resultat = await useCase.execute({
      schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
    });
    expect(resultat.id).toBeDefined();
    expect(repo.findByTeacher('prof-1', 'school-1', true)).toHaveLength(1);
  });

  it('rejette si l\'enseignant n\'existe pas', async () => {
    const repo = repositoryStub();
    const useCase = new CreerIndisponibiliteEnseignantUseCase(repo, {
      findById: async () => null,
    });
    await expect(useCase.execute({
      schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
    })).rejects.toThrow('Enseignant introuvable');
  });

  it('rejette si l\'utilisateur n\'est pas un enseignant', async () => {
    const repo = repositoryStub();
    const useCase = new CreerIndisponibiliteEnseignantUseCase(repo, {
      findById: async () => ({ id: 'prof-1', schoolId: 'school-1', nomComplet: 'Test', role: 'ADMIN', estEnseignant: () => false }),
    });
    await expect(useCase.execute({
      schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
    })).rejects.toThrow("n'est pas un enseignant");
  });

  it('rejette un enseignant d\'une autre école', async () => {
    const repo = repositoryStub();
    const useCase = new CreerIndisponibiliteEnseignantUseCase(repo, {
      findById: async () => ({ id: 'prof-1', schoolId: 'school-2', nomComplet: 'Test', role: 'TEACHER', estEnseignant: () => true }),
    });
    await expect(useCase.execute({
      schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
    })).rejects.toThrow("n'appartient pas");
  });

  it('rejette un chevauchement avec une plage active du même enseignant', async () => {
    const existante = TeacherUnavailability.create({
      schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:00', endTime: '10:00',
    });
    const repo = repositoryStub([existante]);
    const useCase = new CreerIndisponibiliteEnseignantUseCase(repo, {
      findById: userStub(),
    });
    await expect(useCase.execute({
      schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:30', endTime: '09:30',
    })).rejects.toThrow('chevauchement');
  });
});