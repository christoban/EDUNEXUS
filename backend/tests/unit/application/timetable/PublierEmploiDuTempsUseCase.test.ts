import { describe, it, expect, beforeEach } from 'bun:test';
import { PublierEmploiDuTempsUseCase } from '../../../../src/application/timetable/PublierEmploiDuTempsUseCase.ts';
import { InMemoryTimetableRepository } from '../../../helpers/repositories/InMemoryTimetableRepository.ts';
import { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire';

describe('PublierEmploiDuTempsUseCase', () => {
  let repo: InMemoryTimetableRepository;
  let useCase: PublierEmploiDuTempsUseCase;

  const creerEdtDraft = () =>
    EmploiDuTemps.reconstituer({
      id: 'edt-1',
      schoolId: 'school-1',
      classId: 'classe-1',
      academicYearId: 'annee-1',
      status: 'DRAFT',
      generatedByAI: false,
      createdAt: new Date(),
    });

  beforeEach(() => {
    repo = new InMemoryTimetableRepository();
    useCase = new PublierEmploiDuTempsUseCase(repo);
    repo.ajouterEDT(creerEdtDraft());
  });

  it('devrait publier un EDT avec au moins un créneau', async () => {
    repo.ajouterCreneau(
      CreneauHoraire.create({
        timetableId: 'edt-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
      })
    );

    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

    const edt = await repo.findById('edt-1');
    expect(edt?.status).toBe('PUBLISHED');
  });

  it('devrait rejeter si aucun créneau', async () => {
    await expect(
      useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' })
    ).rejects.toThrow('sans créneaux');
  });

  it('devrait rejeter si déjà publié', async () => {
    const edtPublie = EmploiDuTemps.reconstituer({
      id: 'edt-publie',
      schoolId: 'school-1',
      classId: 'classe-1',
      academicYearId: 'annee-1',
      status: 'PUBLISHED',
      generatedByAI: false,
      createdAt: new Date(),
    });
    repo.ajouterEDT(edtPublie);
    repo.ajouterCreneau(
      CreneauHoraire.create({
        timetableId: 'edt-publie', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
      })
    );

    await expect(
      useCase.execute({ timetableId: 'edt-publie', schoolId: 'school-1' })
    ).rejects.toThrow('déjà publié');
  });

  it('devrait rejeter si EDT introuvable', async () => {
    await expect(
      useCase.execute({ timetableId: 'inconnu', schoolId: 'school-1' })
    ).rejects.toThrow('introuvable');
  });

  it('devrait rejeter si schoolId ne correspond pas', async () => {
    repo.ajouterCreneau(
      CreneauHoraire.create({
        timetableId: 'edt-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
      })
    );

    await expect(
      useCase.execute({ timetableId: 'edt-1', schoolId: 'school-mauvaise' })
    ).rejects.toThrow('Accès refusé');
  });
});
