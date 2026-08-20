import { describe, it, expect } from 'bun:test';
import { ProposerEmploiDuTempsUseCase } from '../ProposerEmploiDuTempsUseCase';
import { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import { Room } from '@domain/entities/Room';
import type {
  ProposerEmploiDuTempsInput,
  PropositionEmploiDuTemps,
  SchedulingSolverPort,
} from '@domain/ports/services/SchedulingSolverPort';

function edtDraft() {
  return EmploiDuTemps.reconstituer({
    id: 'edt-1', schoolId: 'school-1', classId: 'classe-1', academicYearId: 'annee-1',
    status: 'DRAFT' as const, generatedByAI: false, createdAt: new Date(),
  });
}

function salleActive() {
  return Room.create({ schoolId: 'school-1', name: 'Salle 1', type: 'NORMAL', capacity: 40 });
}

function prismaStub(indisponibilites: unknown[] = []) {
  return {
    teachingAssignment: {
      findMany: async () => [
        { teacherId: 'prof-1', subjectId: 'maths', subject: { subjectType: 'THEORETICAL' } },
      ],
    },
    timetableGridConfig: {
      findUnique: async () => ({
        joursActifs: ['LUNDI'],
        heureDebut: '08:00',
        dureePeriode: 60,
        periodesAvantP1: 1,
        dureePetitePause: 0,
        periodesAvantP2: 1,
        dureeGrandePause: 0,
        periodesApresP2: 0,
      }),
    },
    teacherUnavailability: { findMany: async () => indisponibilites },
  } as const;
}

describe('ProposerEmploiDuTempsUseCase — chargement des indisponibilités (V2.4)', () => {
  it('transmet les indisponibilités actives de l\'école au solveur', async () => {
    let inputRecu: ProposerEmploiDuTempsInput | null = null;
    const solver: SchedulingSolverPort = {
      proposer: async (input: ProposerEmploiDuTempsInput): Promise<PropositionEmploiDuTemps> => {
        inputRecu = input;
        return { statut: 'OPTIMAL', seances: [], scoreObjectif: 0, dureeResolutionMs: 0 };
      },
    };

    const useCase = new ProposerEmploiDuTempsUseCase(
      {
        findById: async () => edtDraft(),
        findOccupationEcole: async () => [],
      } as const,
      { findBySchool: async () => [salleActive()] } as const,
      { findByClasseAndAnnee: async () => null } as const,
      solver,
      prismaStub([{ teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00' }]),
    );

    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

    expect(inputRecu!.indisponibilitesEnseignants).toEqual([
      { teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00' },
    ]);
  });

  it('transmet une liste vide si aucune indisponibilité', async () => {
    let inputRecu: ProposerEmploiDuTempsInput | null = null;
    const solver: SchedulingSolverPort = {
      proposer: async (input: ProposerEmploiDuTempsInput): Promise<PropositionEmploiDuTemps> => {
        inputRecu = input;
        return { statut: 'OPTIMAL', seances: [], scoreObjectif: 0, dureeResolutionMs: 0 };
      },
    };

    const useCase = new ProposerEmploiDuTempsUseCase(
      { findById: async () => edtDraft(), findOccupationEcole: async () => [] } as const,
      { findBySchool: async () => [salleActive()] } as const,
      { findByClasseAndAnnee: async () => null } as const,
      solver,
      prismaStub([]),
    );

    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

    expect(inputRecu!.indisponibilitesEnseignants).toEqual([]);
  });
});