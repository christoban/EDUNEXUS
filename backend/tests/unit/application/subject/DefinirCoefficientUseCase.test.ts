import { describe, it, expect, beforeEach } from 'bun:test';
import { DefinirCoefficientUseCase } from '../../../../src/application/subject/DefinirCoefficientUseCase.ts';
import { InMemoryMatiereRepository } from './helpers/InMemoryMatiereRepository.ts';

describe('DefinirCoefficientUseCase — coefficients BAC camerounais', () => {
  let repo: InMemoryMatiereRepository;
  let useCase: DefinirCoefficientUseCase;

  beforeEach(() => {
    repo = new InMemoryMatiereRepository();
    repo.ajouter({
      id: 'maths-1',
      schoolId: 'school-1',
      name: 'Mathématiques',
      coefficient: 1,
      hoursPerWeek: 4,
      subjectType: 'THEORETICAL',
    });
    useCase = new DefinirCoefficientUseCase(repo);
  });

  it('devrait définir des coefficients pour plusieurs niveaux/séries', async () => {
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      subjectId: 'maths-1',
      demandeurRole: 'ADMIN',
      coefficients: [
        { classLevel: 'Tle', serieCode: 'C', coefficient: 6 },
        { classLevel: 'Tle', serieCode: 'D', coefficient: 4 },
        { classLevel: 'Tle', serieCode: 'A4', coefficient: 3 },
      ],
    });

    expect(resultat.nombreMisAJour).toBe(3);

    const coeffs = await repo.getCoefficients('school-1', 'maths-1');
    expect(coeffs).toHaveLength(3);
    expect(coeffs.find(c => c.serieCode === 'C')?.coefficient).toBe(6);
    expect(coeffs.find(c => c.serieCode === 'D')?.coefficient).toBe(4);
  });

  it('devrait mettre à jour un coefficient existant (upsert)', async () => {
    await useCase.execute({
      schoolId: 'school-1',
      subjectId: 'maths-1',
      demandeurRole: 'ADMIN',
      coefficients: [{ classLevel: 'Tle', serieCode: 'C', coefficient: 6 }],
    });

    await useCase.execute({
      schoolId: 'school-1',
      subjectId: 'maths-1',
      demandeurRole: 'ADMIN',
      coefficients: [{ classLevel: 'Tle', serieCode: 'C', coefficient: 5 }],
    });

    const coeffs = await repo.getCoefficients('school-1', 'maths-1');
    const serieC = coeffs.filter(c => c.serieCode === 'C');
    expect(serieC).toHaveLength(1);
    expect(serieC[0].coefficient).toBe(5);
  });

  it('devrait rejeter un coefficient ≤ 0', async () => {
    await expect(useCase.execute({
      schoolId: 'school-1',
      subjectId: 'maths-1',
      demandeurRole: 'ADMIN',
      coefficients: [{ classLevel: 'Tle', serieCode: 'C', coefficient: 0 }],
    })).rejects.toThrow('> 0');
  });

  it("devrait rejeter si demandeur n'est pas Admin", async () => {
    await expect(useCase.execute({
      schoolId: 'school-1',
      subjectId: 'maths-1',
      demandeurRole: 'STAFF',
      coefficients: [{ classLevel: 'Tle', coefficient: 3 }],
    })).rejects.toThrow('Admin');
  });
});
