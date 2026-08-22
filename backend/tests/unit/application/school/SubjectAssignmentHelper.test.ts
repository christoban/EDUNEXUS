import { describe, it, expect, beforeEach } from 'bun:test';
import { assignerMatieresPourClasse, parseSerie } from '../../../../src/application/school/SubjectAssignmentHelper.ts';

function mockDb() {
  const calls: { method: string; args: any }[] = [];
  let hasCoeffs = false;
  let subjCounter = 0;
  const track = (method: string) => (args: any) => {
    calls.push({ method, args });
    return Promise.resolve([]);
  };
  return {
    calls,
    hasCoeffs: () => hasCoeffs,
    setHasCoeffs: (v: boolean) => { hasCoeffs = v; },
    db: {
      subject: {
        create: (args: any) => {
          calls.push({ method: 'subject.create', args });
          subjCounter++;
          return Promise.resolve({ id: `subj-${subjCounter}` });
        },
        findMany: () => Promise.resolve([]),
      } as any,
      subjectCoefficient: {
        findFirst: (_args: any) => {
          calls.push({ method: 'subjectCoefficient.findFirst', args: _args });
          return Promise.resolve(hasCoeffs ? { id: 'existing-coeff' } : null);
        },
        create: track('subjectCoefficient.create'),
        upsert: track('subjectCoefficient.upsert'),
        update: track('subjectCoefficient.update'),
      } as any,
      cycleCoefficient: {
        findMany: track('cycleCoefficient.findMany'),
      } as any,
      bacCoefficient: {
        findMany: track('bacCoefficient.findMany'),
      } as any,
      anglophoneSubjectLoad: {
        findMany: track('anglophoneSubjectLoad.findMany'),
      } as any,
    },
  };
}

const SCHOOL_ID = 'school-test-1';
const EMPTY_CONFIG = {};
const EMPTY_SUBJECT_MAP = new Map<string, string>();
const SUBJECT_COUNT_REF = { value: 0 };

function beforeEachTest(mock: ReturnType<typeof mockDb>) {
  mock.calls.length = 0;
  mock.setHasCoeffs(false);
  SUBJECT_COUNT_REF.value = 0;
  EMPTY_SUBJECT_MAP.clear();
}

describe('SubjectAssignmentHelper — PEBS filiere filtering', () => {
  describe('assignerMatieresPourClasse — 1er cycle FR', () => {
    describe('cycleCoefficient query', () => {
      it('filtre par filiere=FR_PEBS quand la classe a filiere=FR_PEBS', async () => {
        const mock = mockDb();
        beforeEachTest(mock);

        await assignerMatieresPourClasse(
          mock.db,
          { name: '6e A', level: '6e', filiere: 'FR_PEBS' },
          SCHOOL_ID,
          { niveaux1erCycle: ['6e'] },
          false,
          EMPTY_SUBJECT_MAP,
          SUBJECT_COUNT_REF,
          'LYCEE_FR',
        );

        const cycleCall = mock.calls.find(c => c.method === 'cycleCoefficient.findMany');
        expect(cycleCall).toBeDefined();
        expect(cycleCall!.args.where).toMatchObject({
          templateCode: 'LYCEE_FR',
          classLevel: '6e',
          filiere: 'FR_PEBS',
        });
      });

      it('filtre par filiere=FR_GENERAL quand la classe a filiere=FR_GENERAL', async () => {
        const mock = mockDb();
        beforeEachTest(mock);

        await assignerMatieresPourClasse(
          mock.db,
          { name: '6e B', level: '6e', filiere: 'FR_GENERAL' },
          SCHOOL_ID,
          { niveaux1erCycle: ['6e'] },
          false,
          EMPTY_SUBJECT_MAP,
          SUBJECT_COUNT_REF,
          'CES_FR',
        );

        const cycleCall = mock.calls.find(c => c.method === 'cycleCoefficient.findMany');
        expect(cycleCall).toBeDefined();
        expect(cycleCall!.args.where).toMatchObject({
          templateCode: 'CES_FR',
          classLevel: '6e',
          filiere: 'FR_GENERAL',
        });
      });

      it('utilise FR_GENERAL par défaut quand filiere est null', async () => {
        const mock = mockDb();
        beforeEachTest(mock);

        await assignerMatieresPourClasse(
          mock.db,
          { name: '5e A', level: '5e' },
          SCHOOL_ID,
          { niveaux1erCycle: ['5e'] },
          false,
          EMPTY_SUBJECT_MAP,
          SUBJECT_COUNT_REF,
          'PRIVE_FR',
        );

        const cycleCall = mock.calls.find(c => c.method === 'cycleCoefficient.findMany');
        expect(cycleCall).toBeDefined();
        expect(cycleCall!.args.where).toMatchObject({
          templateCode: 'PRIVE_FR',
          classLevel: '5e',
          filiere: 'FR_GENERAL',
        });
      });
    });
  });

  describe('assignerMatieresPourClasse — Anglophone', () => {
    describe('anglophoneSubjectLoad query', () => {
      it('filtre par filiere=EN_PEBS quand la classe a filiere=EN_PEBS', async () => {
        const mock = mockDb();
        beforeEachTest(mock);
        const { db, calls } = mock;
        (db.anglophoneSubjectLoad.findMany as any) = (args: any) => {
          calls.push({ method: 'anglophoneSubjectLoad.findMany', args });
          return Promise.resolve([
            { subjectName: 'English Language', coefficient: 4, weeklyPeriods: 4 },
          ]);
        };

        await assignerMatieresPourClasse(
          db,
          { name: 'Form1 EN', level: 'Form1', filiere: 'EN_PEBS' },
          SCHOOL_ID,
          EMPTY_CONFIG,
          true,
          EMPTY_SUBJECT_MAP,
          SUBJECT_COUNT_REF,
          'GHS_EN',
        );

        const aslCall = calls.find(c => c.method === 'anglophoneSubjectLoad.findMany');
        expect(aslCall).toBeDefined();
        expect(aslCall!.args.where).toMatchObject({
          templateCode: 'GHS_EN',
          classLevel: 'Form1',
          filiere: 'EN_PEBS',
        });
      });

      it('filtre par filiere=EN_GENERAL quand la classe a filiere=EN_GENERAL', async () => {
        const mock = mockDb();
        beforeEachTest(mock);
        const { db, calls } = mock;
        (db.anglophoneSubjectLoad.findMany as any) = (args: any) => {
          calls.push({ method: 'anglophoneSubjectLoad.findMany', args });
          return Promise.resolve([
            { subjectName: 'English Language', coefficient: 3, weeklyPeriods: 5 },
          ]);
        };

        await assignerMatieresPourClasse(
          db,
          { name: 'Form2 A', level: 'Form2', filiere: 'EN_GENERAL' },
          SCHOOL_ID,
          EMPTY_CONFIG,
          true,
          EMPTY_SUBJECT_MAP,
          SUBJECT_COUNT_REF,
          'GSS_EN',
        );

        const aslCall = calls.find(c => c.method === 'anglophoneSubjectLoad.findMany');
        expect(aslCall).toBeDefined();
        expect(aslCall!.args.where).toMatchObject({
          templateCode: 'GSS_EN',
          classLevel: 'Form2',
          filiere: 'EN_GENERAL',
        });
      });

      it('utilise EN_GENERAL par défaut quand filiere est null (classe anglophone)', async () => {
        const mock = mockDb();
        beforeEachTest(mock);
        const { db, calls } = mock;
        (db.anglophoneSubjectLoad.findMany as any) = (args: any) => {
          calls.push({ method: 'anglophoneSubjectLoad.findMany', args });
          return Promise.resolve([
            { subjectName: 'French', coefficient: 3, weeklyPeriods: 5 },
          ]);
        };

        await assignerMatieresPourClasse(
          db,
          { name: 'Form3 A', level: 'Form3' },
          SCHOOL_ID,
          EMPTY_CONFIG,
          true,
          EMPTY_SUBJECT_MAP,
          SUBJECT_COUNT_REF,
          'PRIVE_EN',
        );

        const aslCall = calls.find(c => c.method === 'anglophoneSubjectLoad.findMany');
        expect(aslCall).toBeDefined();
        expect(aslCall!.args.where).toMatchObject({
          templateCode: 'PRIVE_EN',
          classLevel: 'Form3',
          filiere: 'EN_GENERAL',
        });
      });

      it('utilise EN_GENERAL par défaut pour LYCEE_BILINGUE section EN (filiere null)', async () => {
        const mock = mockDb();
        beforeEachTest(mock);
        const { db, calls } = mock;

        let aslCallCount = 0;
        (db.anglophoneSubjectLoad.findMany as any) = (args: any) => {
          calls.push({ method: 'anglophoneSubjectLoad.findMany', args });
          aslCallCount++;
          if (aslCallCount === 1) {
            return Promise.resolve([{ id: 'exists' }]);
          }
          return Promise.resolve([
            { subjectName: 'English Language', coefficient: 4, weeklyPeriods: 4 },
            { subjectName: 'French', coefficient: 3, weeklyPeriods: 5 },
          ]);
        };

        await assignerMatieresPourClasse(
          db,
          { name: 'Form1 EN', level: 'Form1' },
          SCHOOL_ID,
          EMPTY_CONFIG,
          false,
          EMPTY_SUBJECT_MAP,
          SUBJECT_COUNT_REF,
          'LYCEE_BILINGUE',
        );

        const aslCalls = calls.filter(c => c.method === 'anglophoneSubjectLoad.findMany');
        expect(aslCalls.length).toBeGreaterThanOrEqual(2);
        const secondCall = aslCalls[1];
        expect(secondCall.args.where).toMatchObject({
          templateCode: 'LYCEE_BILINGUE',
          classLevel: 'Form1',
          filiere: 'EN_GENERAL',
        });
      });
    });
  });

  describe('parseSerie', () => {
    it('retourne null pour les niveaux 1er cycle', () => {
      expect(parseSerie('6e A', '6e')).toBeNull();
      expect(parseSerie('5e B', '5e')).toBeNull();
      expect(parseSerie('4e C', '4e')).toBeNull();
      expect(parseSerie('3e D', '3e')).toBeNull();
    });

    it('extrait la série pour les niveaux 2e cycle', () => {
      expect(parseSerie('2nde A4-Arabe', '2nde')).toBe('A4');
      expect(parseSerie('1ère C A', '1ère')).toBe('C');
      expect(parseSerie('Tle D A', 'Tle')).toBe('D');
    });

    it('retourne la lettre seule comme série si pas de tiret', () => {
      expect(parseSerie('2nde A', '2nde')).toBe('A');
      expect(parseSerie('Tle C A', 'Tle')).toBe('C');
    });
  });

  describe('Fallback ensureCoefficients', () => {
    function mockDbWithSubjects(subjects: { name: string; coefficient: number }[]) {
      const base = mockDb();
      base.db.subject.findMany = () => Promise.resolve(
        subjects.map(s => ({ id: `subj-${s.name}`, name: s.name, coefficient: s.coefficient, code: '', hoursPerWeek: 2, subjectType: 'THEORETICAL', schoolId: SCHOOL_ID, createdAt: new Date() }))
      ) as any;
      return base;
    }

    it('crée SubjectCoefficients pour toutes les matières (niveau technique CAP1)', async () => {
      const mock = mockDbWithSubjects([
        { name: 'Français', coefficient: 2 },
        { name: 'Mathématiques', coefficient: 2 },
        { name: 'Anglais', coefficient: 2 },
      ]);
      beforeEachTest(mock);
      const { db, calls } = mock;

      await assignerMatieresPourClasse(
        db,
        { name: 'CAP1 F1', level: 'CAP1' },
        SCHOOL_ID,
        EMPTY_CONFIG,
        false,
        EMPTY_SUBJECT_MAP,
        SUBJECT_COUNT_REF,
        'LYCEE_TECHNIQUE_FR',
      );

      const createCalls = calls.filter(c =>
        c.method === 'subjectCoefficient.create' || c.method === 'subjectCoefficient.upsert'
      );
      expect(createCalls.length).toBe(3);
      expect(createCalls[0].args.data?.classLevel ?? createCalls[0].args.create?.classLevel).toBe('CAP1');
    });

    it('crée SubjectCoefficients pour niveau primaire (CP)', async () => {
      const mock = mockDbWithSubjects([
        { name: 'Français', coefficient: 5 },
        { name: 'Mathématiques', coefficient: 5 },
        { name: 'Lecture', coefficient: 3 },
      ]);
      beforeEachTest(mock);
      const { db, calls } = mock;

      await assignerMatieresPourClasse(
        db,
        { name: 'CP A', level: 'CP' },
        SCHOOL_ID,
        EMPTY_CONFIG,
        false,
        EMPTY_SUBJECT_MAP,
        SUBJECT_COUNT_REF,
        'PRIMAIRE_FR',
      );

      const createCalls = calls.filter(c =>
        c.method === 'subjectCoefficient.create' || c.method === 'subjectCoefficient.upsert'
      );
      expect(createCalls.length).toBe(3);
    });

    it('ne duplique pas — ensureCoefficients ne crée rien si des coeffs existent déjà', async () => {
      const mock = mockDbWithSubjects([
        { name: 'Français', coefficient: 6 },
        { name: 'Mathématiques', coefficient: 4 },
      ]);
      beforeEachTest(mock);
      mock.setHasCoeffs(true);
      const { db, calls } = mock;

      const ccBefore = calls.filter(c =>
        c.method === 'subjectCoefficient.create' || c.method === 'subjectCoefficient.upsert'
      ).length;

      await assignerMatieresPourClasse(
        db,
        { name: 'CAP1 F1', level: 'CAP1' },
        SCHOOL_ID,
        EMPTY_CONFIG,
        false,
        EMPTY_SUBJECT_MAP,
        SUBJECT_COUNT_REF,
        'LYCEE_TECHNIQUE_FR',
      );

      const ccAfter = calls.filter(c =>
        c.method === 'subjectCoefficient.create' || c.method === 'subjectCoefficient.upsert'
      ).length;
      expect(ccAfter).toBe(ccBefore);
    });
  });
});
