import { describe, it, expect, beforeEach } from 'bun:test';
import { ValiderNoteUseCase } from '@application/grade/ValiderNoteUseCase';
import { Note } from '@domain/entities/Note';
import { User } from '@domain/entities/User';
import { InMemoryNoteRepository } from '../../../helpers/repositories/InMemoryNoteRepository.ts';
import { InMemoryUserRepository } from '../../../helpers/repositories/InMemoryUserRepository.ts';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SCHOOL_ID = 'school-1';
const NOTE_ID_FIXE = 'note-uuid-fixe';

function creerCenseur(id = 'censeur-1') {
  return User.reconstituer({
    id,
    schoolId: SCHOOL_ID,
    role: 'STAFF',
    email: `${id}@ecole.cm`,
    firstName: 'Paul',
    lastName: 'Censeur',
    isActive: true,
    staffPermissions: ['VALIDATE_GRADES'],
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function creerAdmin(id = 'admin-1') {
  return User.reconstituer({
    id,
    schoolId: SCHOOL_ID,
    role: 'ADMIN',
    email: `${id}@ecole.cm`,
    firstName: 'Directeur',
    lastName: 'Mballa',
    isActive: true,
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function creerStaffSansPermission(id = 'staff-2') {
  return User.reconstituer({
    id,
    schoolId: SCHOOL_ID,
    role: 'STAFF',
    email: `${id}@ecole.cm`,
    firstName: 'Autre',
    lastName: 'Staff',
    isActive: true,
    staffPermissions: ['MANAGE_TIMETABLE'],
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function creerNoteEnDraft(): Note {
  return Note.create({
    schoolId: SCHOOL_ID,
    studentId: 'eleve-1',
    subjectId: 'maths-1',
    classId: 'class-3e',
    academicYearId: 'year-2026',
    sequenceId: 'seq-1',
    recordedById: 'teacher-1',
    sequenceScore: 14,
  });
}

function creerNoteAvecIdFixe(): Note {
  return Note.reconstituer({
    id: NOTE_ID_FIXE,
    schoolId: SCHOOL_ID,
    studentId: 'eleve-1',
    subjectId: 'maths-1',
    classId: 'class-3e',
    academicYearId: 'year-2026',
    sequenceId: 'seq-1',
    recordedById: 'teacher-1',
    sequenceScore: 14,
    coefficient: 4,
    maxValue: 20,
    validationStatus: 'SUBMITTED',
    isOfflineSync: false,
    createdAt: new Date(),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ValiderNoteUseCase', () => {
  let noteRepo: InMemoryNoteRepository;
  let userRepo: InMemoryUserRepository;
  let useCase: ValiderNoteUseCase;

  beforeEach(() => {
    noteRepo = new InMemoryNoteRepository();
    userRepo = new InMemoryUserRepository();
    useCase = new ValiderNoteUseCase(noteRepo, userRepo);
  });

  describe('Cas nominal — STAFF avec VALIDATE_GRADES', () => {
    it('passe la note de SUBMITTED à VALIDATED', async () => {
      const censeur = creerCenseur();
      userRepo.ajouter(censeur);
      const note = creerNoteAvecIdFixe();
      await noteRepo.save(note);

      const resultat = await useCase.execute({
        noteId: NOTE_ID_FIXE,
        validateurId: 'censeur-1',
        schoolId: SCHOOL_ID,
      });

      expect(resultat.statut).toBe('VALIDATED');
      expect(resultat.noteId).toBe(NOTE_ID_FIXE);
      expect(resultat.validateurNom).toBe('Paul Censeur');
      expect(resultat.valideeA).toBeInstanceOf(Date);
    });

    it('persiste le nouveau statut dans le dépôt', async () => {
      const censeur = creerCenseur();
      userRepo.ajouter(censeur);
      const note = creerNoteAvecIdFixe();
      await noteRepo.save(note);

      await useCase.execute({ noteId: NOTE_ID_FIXE, validateurId: 'censeur-1', schoolId: SCHOOL_ID });

      const noteApres = await noteRepo.findById(NOTE_ID_FIXE, SCHOOL_ID);
      expect(noteApres?.validationStatus).toBe('VALIDATED');
    });
  });

  describe('Cas nominal — Admin', () => {
    it('permet à un ADMIN de valider sans permission VALIDATE_GRADES explicite', async () => {
      const admin = creerAdmin();
      userRepo.ajouter(admin);
      const note = creerNoteAvecIdFixe();
      await noteRepo.save(note);

      const resultat = await useCase.execute({
        noteId: NOTE_ID_FIXE,
        validateurId: 'admin-1',
        schoolId: SCHOOL_ID,
      });

      expect(resultat.statut).toBe('VALIDATED');
      expect(resultat.validateurNom).toBe('Directeur Mballa');
    });
  });

  describe('Erreurs — validateur', () => {
    it('rejette si le validateur n\'existe pas', async () => {
      const note = creerNoteAvecIdFixe();
      await noteRepo.save(note);

      await expect(
        useCase.execute({ noteId: NOTE_ID_FIXE, validateurId: 'inconnu', schoolId: SCHOOL_ID })
      ).rejects.toThrow('Validateur introuvable');
    });

    it('rejette si le STAFF n\'a pas la permission VALIDATE_GRADES', async () => {
      const staffSansPermission = creerStaffSansPermission();
      userRepo.ajouter(staffSansPermission);
      const note = creerNoteAvecIdFixe();
      await noteRepo.save(note);

      await expect(
        useCase.execute({ noteId: NOTE_ID_FIXE, validateurId: 'staff-2', schoolId: SCHOOL_ID })
      ).rejects.toThrow('Permission refusée');
    });
  });

  describe('Erreurs — note', () => {
    it('rejette si la note n\'existe pas', async () => {
      const censeur = creerCenseur();
      userRepo.ajouter(censeur);
      // noteRepo vide

      await expect(
        useCase.execute({ noteId: 'note-inexistante', validateurId: 'censeur-1', schoolId: SCHOOL_ID })
      ).rejects.toThrow('Note introuvable');
    });

    it('rejette si la note est en DRAFT (pas encore soumise)', async () => {
      const censeur = creerCenseur();
      userRepo.ajouter(censeur);

      const noteDraft = creerNoteEnDraft();
      await noteRepo.save(noteDraft);

      await expect(
        useCase.execute({ noteId: noteDraft.id, validateurId: 'censeur-1', schoolId: SCHOOL_ID })
      ).rejects.toThrow('Impossible de valider');
    });

    it('rejette si la note est déjà VALIDATED', async () => {
      const censeur = creerCenseur();
      userRepo.ajouter(censeur);

      const noteDejaValidee = Note.reconstituer({
        id: 'note-deja-validee',
        schoolId: SCHOOL_ID,
        studentId: 'eleve-1',
        subjectId: 'maths-1',
        classId: 'class-3e',
        academicYearId: 'year-2026',
        sequenceId: 'seq-1',
        recordedById: 'teacher-1',
        sequenceScore: 14,
        coefficient: 4,
        maxValue: 20,
        validationStatus: 'VALIDATED',
        validatedById: 'censeur-1',
        validatedAt: new Date(),
        isOfflineSync: false,
        createdAt: new Date(),
      });
      await noteRepo.save(noteDejaValidee);

      await expect(
        useCase.execute({ noteId: 'note-deja-validee', validateurId: 'censeur-1', schoolId: SCHOOL_ID })
      ).rejects.toThrow('Impossible de valider');
    });
  });

  describe('Isolation multi-tenant', () => {
    it('rejette la validation d\'une note appartenant à une autre école', async () => {
      const censeur = creerCenseur(); // école school-1, permission VALIDATE_GRADES : acteur légitime
      userRepo.ajouter(censeur);

      const noteAutreEcole = Note.reconstituer({
        id: 'note-autre-ecole',
        schoolId: 'school-2',
        studentId: 'eleve-9',
        subjectId: 'maths-1',
        classId: 'class-3e',
        academicYearId: 'year-2026',
        sequenceId: 'seq-1',
        recordedById: 'teacher-9',
        sequenceScore: 14,
        coefficient: 4,
        maxValue: 20,
        validationStatus: 'SUBMITTED',
        isOfflineSync: false,
        createdAt: new Date(),
      });
      await noteRepo.save(noteAutreEcole);

      // « Note introuvable » et non « note d'une autre école » : le message ne doit pas révéler
      // que la note existe ailleurs.
      await expect(
        useCase.execute({ noteId: 'note-autre-ecole', validateurId: 'censeur-1', schoolId: SCHOOL_ID })
      ).rejects.toThrow('Note introuvable');

      const intacte = await noteRepo.findById('note-autre-ecole', 'school-2');
      expect(intacte?.validationStatus).toBe('SUBMITTED');
    });
  });

  describe('Intégrité du résultat', () => {
    it('valideeA est proche de la date actuelle', async () => {
      const censeur = creerCenseur();
      userRepo.ajouter(censeur);
      const note = creerNoteAvecIdFixe();
      await noteRepo.save(note);

      const avant = Date.now();
      const resultat = await useCase.execute({
        noteId: NOTE_ID_FIXE,
        validateurId: 'censeur-1',
        schoolId: SCHOOL_ID,
      });
      const apres = Date.now();

      expect(resultat.valideeA.getTime()).toBeGreaterThanOrEqual(avant);
      expect(resultat.valideeA.getTime()).toBeLessThanOrEqual(apres);
    });
  });
});
