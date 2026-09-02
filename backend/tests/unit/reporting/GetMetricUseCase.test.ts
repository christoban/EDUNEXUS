import { describe, it, expect, beforeEach } from 'bun:test';
import { MetricCache } from '../../../src/infrastructure/cache/MetricCache';
import { MetricRegistry } from '../../../src/domain/reporting/MetricRegistryImpl';
import { GetMetricUseCase } from '../../../src/application/reporting/GetMetricUseCase';
import { InMemoryPresenceRepository } from '../../helpers/repositories/InMemoryPresenceRepository';
import { InMemoryNoteRepository } from '../../helpers/repositories/InMemoryNoteRepository';
import { Presence } from '@domain/entities/Presence';

function makePresence(status: string, studentId = 'e1', classId = 'c1', periodId = 'p1') {
  return Presence.reconstituer({
    id: crypto.randomUUID(), schoolId: 's1', studentId, classId, academicPeriodId: periodId,
    date: new Date('2025-09-01'), status: status as any, period: 'MORNING' as any, isOfflineSync: false, createdAt: new Date(),
  });
}

function makeStatsRepo(overrides?: Partial<{ assignments: Array<{ classId: string }>; attendances: Array<{ status: string }> }>) {
  return {
    findTeachingAssignmentsForTeacher: async () => overrides?.assignments ?? [{ classId: 'c1', subjectId: 's1', subject: { name: 'Math', hoursPerWeek: 4 }, class: { name: '6e A' } } as any],
    findAttendanceForTeacher: async () => overrides?.attendances ?? [{ status: 'PRESENT', date: new Date(), classId: 'c1', subjectId: 's1' } as any],
    findTeacherById: async () => ({ id: 't1', firstName: 'A', lastName: 'B' } as any),
    findCurrentAcademicYear: async () => null,
    findGradesEvolution: async () => [],
    findClassesByLevel: async () => [],
    findGradesForClassComparison: async () => [],
    findStudentsGenderDistribution: async () => [],
    findStudentsLevelDistribution: async () => [],
    findInvoicesPaymentStatuses: async () => [],
    findGradesForTeacherPerformance: async () => [],
  } as any;
}

function setup() {
  const cache = new MetricCache();
  const registry = new MetricRegistry();
  const presenceRepo = new InMemoryPresenceRepository();
  const noteRepo = new InMemoryNoteRepository();
  const statsRepo = makeStatsRepo();

  // 3 présences : PRESENT + LATE + ABSENT → 66.67%
  presenceRepo.ajouter(makePresence('PRESENT'));
  presenceRepo.ajouter(makePresence('LATE'));
  presenceRepo.ajouter(makePresence('ABSENT'));

  const useCase = new GetMetricUseCase(cache, registry, presenceRepo, noteRepo, statsRepo);
  return { cache, registry, useCase, presenceRepo, noteRepo, statsRepo };
}

describe('GetMetricUseCase', () => {
  it('cache miss calcule et met en cache', async () => {
    const { cache, useCase } = setup();
    const res1 = await useCase.execute({ key: 'taux_presence', dimensions: { schoolId: 's1', classId: 'c1', studentId: 'e1' } });
    expect(res1.fromCache).toBe(false);
    expect(res1.value).toBe(67); // (PRESENT+LATE)/3 = 2/3 ≈ 66.67 → round 67

    const res2 = await useCase.execute({ key: 'taux_presence', dimensions: { schoolId: 's1', classId: 'c1', studentId: 'e1' } });
    expect(res2.fromCache).toBe(true);
    expect(res2.value).toBe(res1.value);
    expect(cache.size()).toBe(1);
  });

  it('forceRefresh bypass le cache', async () => {
    const { useCase } = setup();
    await useCase.execute({ key: 'taux_presence', dimensions: { schoolId: 's1', classId: 'c1', studentId: 'e1' } });
    const res = await useCase.execute({ key: 'taux_presence', dimensions: { schoolId: 's1', classId: 'c1', studentId: 'e1' }, forceRefresh: true });
    expect(res.fromCache).toBe(false);
  });

  it('valide les dimensions — schoolId requis', async () => {
    const { useCase } = setup();
    await expect(useCase.execute({ key: 'taux_presence', dimensions: { schoolId: '', classId: 'c1' } as any })).rejects.toThrow('schoolId requis');
  });

  it('valide dimension hors liste blanche', async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute({ key: 'moyenne_generale', dimensions: { schoolId: 's1', teacherId: 't1' } as any }),
    ).rejects.toThrow('non autorisée');
  });

  it('taux_presence : total=0 retourne 100', async () => {
    const { useCase } = setup();
    const res = await useCase.execute({ key: 'taux_presence', dimensions: { schoolId: 's1', classId: 'c-x', studentId: 'inconnu' } });
    expect(res.value).toBe(100);
  });

  it('taux_presence teacherId : même valeur qu\'avant migration (total>0)', async () => {
    const cache = new MetricCache();
    const registry = new MetricRegistry();
    const presenceRepo = new InMemoryPresenceRepository();
    const noteRepo = new InMemoryNoteRepository();
    const statsRepo = makeStatsRepo({
      assignments: [{ classId: 'c1' } as any, { classId: 'c2' } as any],
      attendances: [
        { status: 'PRESENT', date: new Date(), classId: 'c1', subjectId: 's1' } as any,
        { status: 'LATE', date: new Date(), classId: 'c1', subjectId: 's1' } as any,
        { status: 'ABSENT', date: new Date(), classId: 'c2', subjectId: 's1' } as any,
      ],
    });
    const useCase = new GetMetricUseCase(cache, registry, presenceRepo, noteRepo, statsRepo);
    const res = await useCase.execute({ key: 'taux_presence', dimensions: { schoolId: 's1', teacherId: 't1' } });
    // Avant migration : (PRESENT+LATE)/3 = 2/3 → 66.67 (2 décimales)
    expect(res.value).toBe(66.67);
    expect(res.fromCache).toBe(false);
    const res2 = await useCase.execute({ key: 'taux_presence', dimensions: { schoolId: 's1', teacherId: 't1' } });
    expect(res2.fromCache).toBe(true);
    expect(res2.value).toBe(66.67);
  });

  it('taux_presence teacherId : total=0 → 100 (avant: null, après: 100 — alignement canonique fix 4f7a9b9)', async () => {
    const cache = new MetricCache();
    const registry = new MetricRegistry();
    const presenceRepo = new InMemoryPresenceRepository();
    const noteRepo = new InMemoryNoteRepository();
    const statsRepo = makeStatsRepo({ assignments: [], attendances: [] });
    const useCase = new GetMetricUseCase(cache, registry, presenceRepo, noteRepo, statsRepo);
    const res = await useCase.execute({ key: 'taux_presence', dimensions: { schoolId: 's1', teacherId: 't-unknown' } });
    expect(res.value).toBe(100);
  });

  it('pilote {classId, studentId} toujours identique après généralisation', async () => {
    const { useCase } = setup();
    const res = await useCase.execute({ key: 'taux_presence', dimensions: { schoolId: 's1', classId: 'c1', studentId: 'e1' } });
    // Pilote : 3 présences (PRESENT+LATE+ABSENT) → 67, doit rester 67 après extension teacherId
    expect(res.value).toBe(67);
  });
});