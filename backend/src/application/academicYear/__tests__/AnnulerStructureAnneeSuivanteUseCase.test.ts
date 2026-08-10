import { describe, it, expect, beforeEach } from 'bun:test';
import { AnnulerStructureAnneeSuivanteUseCase } from '../AnnulerStructureAnneeSuivanteUseCase';
import { InMemoryAnneeAcademiqueRepository } from './helpers/InMemoryAnneeAcademiqueRepository';
import { InMemoryClasseRepository } from './helpers/InMemoryClasseRepository';
import { InMemoryPromotionRepository } from './helpers/InMemoryPromotionRepository';
import { Classe } from '@domain/entities/Classe';

describe('AnnulerStructureAnneeSuivanteUseCase', () => {
  let anneeRepo: InMemoryAnneeAcademiqueRepository;
  let classeRepo: InMemoryClasseRepository;
  let promotionRepo: InMemoryPromotionRepository;
  let useCase: AnnulerStructureAnneeSuivanteUseCase;

  beforeEach(() => {
    anneeRepo = new InMemoryAnneeAcademiqueRepository();
    classeRepo = new InMemoryClasseRepository();
    promotionRepo = new InMemoryPromotionRepository();
    useCase = new AnnulerStructureAnneeSuivanteUseCase(anneeRepo, classeRepo, promotionRepo);

    anneeRepo.ajouterAnnee({
      id: 'annee-suivante', schoolId: 'school-1', name: '2026-2027',
      startDate: new Date('2026-09-01'), endDate: new Date('2027-07-31'), isCurrent: false, status: 'ACTIVE',
    });
  });

  it('supprime toutes les classes DRAFT de l\'année et leurs mappings ClassPromotion', async () => {
    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-1', schoolId: 'school-1', academicYearId: 'annee-suivante',
      name: '4e A', capacity: 40, status: 'DRAFT', createdAt: new Date(),
    }));
    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-2', schoolId: 'school-1', academicYearId: 'annee-suivante',
      name: '4e B', capacity: 40, status: 'DRAFT', createdAt: new Date(),
    }));
    promotionRepo.definirMappings([
      { fromClassId: 'classe-source-1', toClassId: 'classe-1' },
      { fromClassId: 'classe-source-2', toClassId: 'classe-2' },
    ]);

    const resultat = await useCase.execute({ schoolId: 'school-1', anneeSuivanteId: 'annee-suivante' });

    expect(resultat.classesSupprimees).toBe(2);
    const classesRestantes = await classeRepo.findBySchoolAndYear('school-1', 'annee-suivante');
    expect(classesRestantes).toHaveLength(0);
    const mappingsRestants = await promotionRepo.findMappingsPromotion('school-1', 'peu-importe');
    expect(mappingsRestants).toHaveLength(0);
  });

  it('ne touche pas les classes déjà ACTIVE', async () => {
    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-draft', schoolId: 'school-1', academicYearId: 'annee-suivante',
      name: 'Draft', capacity: 40, status: 'DRAFT', createdAt: new Date(),
    }));
    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-active', schoolId: 'school-1', academicYearId: 'annee-suivante',
      name: 'Déjà active', capacity: 40, status: 'ACTIVE', createdAt: new Date(),
    }));

    const resultat = await useCase.execute({ schoolId: 'school-1', anneeSuivanteId: 'annee-suivante' });

    expect(resultat.classesSupprimees).toBe(1);
    const classesRestantes = await classeRepo.findBySchoolAndYear('school-1', 'annee-suivante');
    expect(classesRestantes).toHaveLength(1);
    expect(classesRestantes[0]?.id).toBe('classe-active');
  });

  it('refuse si aucune classe DRAFT n\'existe pour cette année (rien à annuler)', async () => {
    await expect(useCase.execute({ schoolId: 'school-1', anneeSuivanteId: 'annee-suivante' }))
      .rejects.toThrow('aucune structure proposée');
  });

  it('refuse d\'annuler une structure déjà validée (plus de DRAFT, des classes ACTIVE existent)', async () => {
    classeRepo.ajouter(Classe.reconstituer({
      id: 'classe-active', schoolId: 'school-1', academicYearId: 'annee-suivante',
      name: 'Déjà active', capacity: 40, status: 'ACTIVE', createdAt: new Date(),
    }));

    await expect(useCase.execute({ schoolId: 'school-1', anneeSuivanteId: 'annee-suivante' }))
      .rejects.toThrow('déjà été validée');
  });

  it('refuse un accès inter-établissement', async () => {
    await expect(useCase.execute({ schoolId: 'autre-ecole', anneeSuivanteId: 'annee-suivante' }))
      .rejects.toThrow('Accès refusé');
  });

  it('refuse une année inexistante', async () => {
    await expect(useCase.execute({ schoolId: 'school-1', anneeSuivanteId: 'inexistante' }))
      .rejects.toThrow('introuvable');
  });
});
