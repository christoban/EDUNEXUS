import { describe, it, expect } from 'bun:test';
import type { PrismaClient } from '@prisma/client';
import { ProposerEmploiDuTempsUseCase } from '../ProposerEmploiDuTempsUseCase';
import { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import { Room } from '@domain/entities/Room';
import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { RoomRepository } from '@domain/ports/repositories/RoomRepository';
import type { ClassRoomAssignmentRepository } from '@domain/ports/repositories/ClassRoomAssignmentRepository';
import type {
  CreneauOccupe,
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

function roomRepositoryStub(): RoomRepository {
  return {
    findById: async () => null,
    findBySchool: async () => [salleActive()],
    existsByName: async () => false,
    save: async () => {},
    update: async () => {},
    supprimerAvecCascade: async () => {},
    restaurer: async () => {},
  };
}

function classRoomAssignmentRepositoryStub(): ClassRoomAssignmentRepository {
  return {
    findByClasseAndAnnee: async () => null,
    findBySchool: async () => [],
    upsert: async () => {},
    delete: async () => {},
  };
}

/** Stub complet de TimetableRepository : toutes les méthodes en no-op, sauf findById/findOccupationEcole. */
function timetableRepositoryStub(edt: EmploiDuTemps, occupation: CreneauOccupe[] = []): TimetableRepository {
  return {
    findById: async () => edt,
    findByClasse: async () => null,
    save: async () => {},
    update: async () => {},
    countCreneaux: async () => 0,
    findCreneauById: async () => null,
    findCreneauxByTimetable: async () => [],
    saveCreneaux: async () => {},
    updateCreneau: async () => {},
    deleteCreneau: async () => {},
    findCreneauxEnseignantParJour: async () => [],
    calculerVolumeHoraireHebdo: async () => 0,
    getInfosEnseignant: async () => null,
    getInfosSalle: async () => null,
    findCreneauxSalleParJour: async () => [],
    sousGroupeAppartientAClasse: async () => false,
    findOccupationEcole: async () => occupation,
    creerCreneauxEnLot: async () => ({ creneauxCrees: 0 }),
  };
}

function prismaStub(options: {
  indisponibilites?: unknown[];
  hoursPerWeek?: number | null;
  blocDureeCases?: number | null;
  nbPeriodesParJour?: number;
  joursActifs?: string[];
} = {}): PrismaClient {
  const {
    indisponibilites = [],
    hoursPerWeek = 2,
    blocDureeCases = null,
    nbPeriodesParJour = 2,
    joursActifs = ['LUNDI'],
  } = options;
  return {
    teachingAssignment: {
      findMany: async () => [
        { teacherId: 'prof-1', subjectId: 'maths', subject: { subjectType: 'THEORETICAL', hoursPerWeek, name: 'Maths', blocDureeCases } },
      ],
    },
    timetableGridConfig: {
      findUnique: async () => ({
        joursActifs,
        heureDebut: '08:00',
        dureePeriode: 60,
        periodesAvantP1: nbPeriodesParJour,
        dureePetitePause: 0,
        periodesAvantP2: 0,
        dureeGrandePause: 0,
        periodesApresP2: 0,
      }),
    },
    teacherUnavailability: { findMany: async () => indisponibilites },
    user: { findMany: async () => [{ id: 'prof-1', firstName: 'Prof', lastName: 'Un' }] },
  } as unknown as PrismaClient;
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
      timetableRepositoryStub(edtDraft()),
      roomRepositoryStub(),
      classRoomAssignmentRepositoryStub(),
      solver,
      prismaStub({ indisponibilites: [{ teacherId: "prof-1", dayOfWeek: 0, startTime: "08:00", endTime: "09:00" }] }),
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
      timetableRepositoryStub(edtDraft()),
      roomRepositoryStub(),
      classRoomAssignmentRepositoryStub(),
      solver,
      prismaStub(),
    );

    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

    expect(inputRecu!.indisponibilitesEnseignants).toEqual([]);
  });
});

describe('ProposerEmploiDuTempsUseCase — volume horaire exact multi-séances (V2.5)', () => {
  function solverCapturant(): { solver: SchedulingSolverPort; input: () => ProposerEmploiDuTempsInput | null } {
    let inputRecu: ProposerEmploiDuTempsInput | null = null;
    return {
      solver: {
        proposer: async (input: ProposerEmploiDuTempsInput): Promise<PropositionEmploiDuTemps> => {
          inputRecu = input;
          return { statut: 'OPTIMAL', seances: [], scoreObjectif: 0, dureeResolutionMs: 0 };
        },
      },
      input: () => inputRecu,
    };
  }

  function construireUseCase(solver: SchedulingSolverPort, prisma: PrismaClient) {
    return new ProposerEmploiDuTempsUseCase(
      timetableRepositoryStub(edtDraft()),
      roomRepositoryStub(),
      classRoomAssignmentRepositoryStub(),
      solver,
      prisma,
    );
  }

  it('hoursPerWeek=4 sur cases d\'1 h → 4 exigences pour cette matière', async () => {
    const { solver, input } = solverCapturant();
    const useCase = construireUseCase(solver, prismaStub({ hoursPerWeek: 4, nbPeriodesParJour: 4 }));

    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

    const exigences = input()!.exigences;
    expect(exigences).toHaveLength(4);
    expect(exigences.every(e => e.subjectId === 'maths' && e.teacherId === 'prof-1')).toBe(true);
    // Chaque séance porte un identifiant interne distinct (dédoublonnage / explicatifs).
    expect(new Set(exigences.map(e => e.seanceId)).size).toBe(4);
  });

  it('hoursPerWeek non renseigné → défaut 2 (schéma Prisma)', async () => {
    const { solver, input } = solverCapturant();
    const useCase = construireUseCase(solver, prismaStub({ hoursPerWeek: null, nbPeriodesParJour: 4 }));

    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

    expect(input()!.exigences).toHaveLength(2);
  });

  it('volume > capacité de la grille → erreur explicite (Fail Fast)', async () => {
    const { solver } = solverCapturant();
    // Grille : 1 jour × 2 cases = 2 cases plaçables, mais hoursPerWeek=4 → 4 séances.
    const useCase = construireUseCase(solver, prismaStub({ hoursPerWeek: 4, nbPeriodesParJour: 2, joursActifs: ['LUNDI'] }));

    await expect(useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' }))
      .rejects.toThrow('Le volume hebdomadaire des matières (4 séances) dépasse la capacité de la grille (2 cases)');
  });

  it('expansion remplit subjectName, teacherName et durationMinutes', async () => {
    const { solver, input } = solverCapturant();
    const useCase = construireUseCase(solver, prismaStub({ hoursPerWeek: 2, nbPeriodesParJour: 2 }));

    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

    const e = input()!.exigences[0]!;
    expect(e.subjectName).toBe('Maths');
    expect(e.teacherName).toBe('Prof Un');
    expect(e.durationMinutes).toBe(60);
  });

  it('bloc=2 : nombre de séances arrondi au pair inférieur, champ propagé', async () => {
    const { solver, input } = solverCapturant();
    // 3 h/semaine sur cases d'1 h → 3 séances, arrondies à 2 (pair) pour former un bloc.
    const useCase = construireUseCase(solver, prismaStub({ hoursPerWeek: 3, blocDureeCases: 2, nbPeriodesParJour: 4 }));

    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

    const exigences = input()!.exigences;
    expect(exigences).toHaveLength(2);
    expect(exigences.every(e => e.blocDureeCases === 2)).toBe(true);
  });

  it('contraintes douces transmises telles quelles au solveur', async () => {
    const { solver, input } = solverCapturant();
    const useCase = construireUseCase(solver, prismaStub({ nbPeriodesParJour: 2 }));

    await useCase.execute({
      timetableId: 'edt-1', schoolId: 'school-1',
      contraintes: { trouEnseignant: true, volumeMaxEnseignantParJour: 240 },
    });

    expect(input()!.contraintes).toEqual({ trouEnseignant: true, volumeMaxEnseignantParJour: 240 });
  });

  it('sans contraintes → le solveur ne reçoit pas de champ contraintes', async () => {
    const { solver, input } = solverCapturant();
    const useCase = construireUseCase(solver, prismaStub({ nbPeriodesParJour: 2 }));

    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

    expect(input()!.contraintes).toBeUndefined();
  });
});