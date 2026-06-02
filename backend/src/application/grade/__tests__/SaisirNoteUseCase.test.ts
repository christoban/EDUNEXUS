import { describe, it, expect, beforeEach } from 'bun:test';
import { SaisirNoteUseCase } from '@application/grade/SaisirNoteUseCase';
import { User } from '@domain/entities/User';
import { InMemoryNoteRepository } from './helpers/InMemoryNoteRepository';
import { InMemoryUserRepository } from './helpers/InMemoryUserRepository';
import { InMemoryMatiereRepository } from './helpers/InMemoryMatiereRepository';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SCHOOL_ID = 'school-1';
const SUBJECT_ID = 'maths-1';
const CLASS_ID = 'class-3e';
const YEAR_ID = 'year-2026';
const SEQ_ID = 'seq-1';
const STUDENT_ID = 'eleve-1';

function creerEnseignantActif(id = 'teacher-1') {
  return User.reconstituer({
    id,
    schoolId: SCHOOL_ID,
    role: 'TEACHER',
    email: `${id}@ecole.cm`,
    firstName: 'Jean',
    lastName: 'Dupont',
    isActive: true,
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

function commandeBase(recordedById = 'teacher-1') {
  return {
    schoolId: SCHOOL_ID,
    studentId: STUDENT_ID,
    subjectId: SUBJECT_ID,
    classId: CLASS_ID,
    academicYearId: YEAR_ID,
    sequenceId: SEQ_ID,
    recordedById,
    sequenceScore: 14,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SaisirNoteUseCase', () => {
  let noteRepo: InMemoryNoteRepository;
  let userRepo: InMemoryUserRepository;
  let matiereRepo: InMemoryMatiereRepository;
  let useCase: SaisirNoteUseCase;

  beforeEach(() => {
    noteRepo = new InMemoryNoteRepository();
    userRepo = new InMemoryUserRepository();
    matiereRepo = new InMemoryMatiereRepository();
    useCase = new SaisirNoteUseCase(noteRepo, matiereRepo, userRepo);

    // Matière disponible dans l'établissement
    matiereRepo.ajouter({
      id: SUBJECT_ID,
      schoolId: SCHOOL_ID,
      name: 'Mathématiques',
      coefficient: 4,
      hoursPerWeek: 5,
      subjectType: 'THEORETICAL',
    });
  });

  describe('Cas nominal', () => {
    it('crée une note en statut DRAFT quand l\'enseignant est assigné à la matière', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await matiereRepo.assignerEnseignant('teacher-1', SUBJECT_ID);

      const resultat = await useCase.execute(commandeBase());

      expect(resultat.statut).toBe('DRAFT');
      expect(resultat.noteId).toBeDefined();
      expect(resultat.message).toContain('DRAFT');
      expect(noteRepo.compter()).toBe(1);
    });

    it('retourne un noteId unique à chaque appel', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await matiereRepo.assignerEnseignant('teacher-1', SUBJECT_ID);

      const r1 = await useCase.execute(commandeBase());
      // Deuxième note pour un autre élève
      const r2 = await useCase.execute({ ...commandeBase(), studentId: 'eleve-2' });

      expect(r1.noteId).not.toBe(r2.noteId);
      expect(noteRepo.compter()).toBe(2);
    });

    it('accepte n\'importe quel score entre 0 et 20', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await matiereRepo.assignerEnseignant('teacher-1', SUBJECT_ID);

      const resultat = await useCase.execute({ ...commandeBase(), sequenceScore: 0 });
      expect(resultat.statut).toBe('DRAFT');
    });
  });

  describe('Admin — bypass assignation', () => {
    it('permet à un admin de saisir même s\'il n\'est pas assigné à la matière', async () => {
      const admin = creerAdmin();
      userRepo.ajouter(admin);
      // Aucune assignation enregistrée pour admin-1

      const resultat = await useCase.execute(commandeBase('admin-1'));

      expect(resultat.statut).toBe('DRAFT');
    });
  });

  describe('Erreurs — enseignant', () => {
    it('rejette si l\'enseignant n\'existe pas dans le dépôt', async () => {
      // userRepo vide — teacher-1 n'existe pas
      await expect(useCase.execute(commandeBase())).rejects.toThrow(
        'Enseignant introuvable ou inactif'
      );
    });

    it('rejette si l\'enseignant est désactivé', async () => {
      const inactif = User.reconstituer({
        ...creerEnseignantActif().toObject(),
        isActive: false,
      });
      userRepo.ajouter(inactif);

      await expect(useCase.execute(commandeBase())).rejects.toThrow(
        'Enseignant introuvable ou inactif'
      );
    });

    it('rejette si l\'enseignant TEACHER n\'est pas assigné à la matière', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      // Pas d'assignation → estEnseignantAssigne retourne false

      await expect(useCase.execute(commandeBase())).rejects.toThrow(
        'n\'est pas assigné à cette matière'
      );
    });
  });

  describe('Erreurs — doublon', () => {
    it('rejette si une note existe déjà pour le même élève / matière / séquence', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await matiereRepo.assignerEnseignant('teacher-1', SUBJECT_ID);

      // Première saisie
      await useCase.execute(commandeBase());

      // Deuxième saisie identique → doublon
      await expect(useCase.execute(commandeBase())).rejects.toThrow(
        'Une note existe déjà'
      );
    });

    it('autorise deux notes si les séquences sont différentes', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await matiereRepo.assignerEnseignant('teacher-1', SUBJECT_ID);

      await useCase.execute(commandeBase());
      const r2 = await useCase.execute({ ...commandeBase(), sequenceId: 'seq-2' });

      expect(r2.statut).toBe('DRAFT');
      expect(noteRepo.compter()).toBe(2);
    });
  });

  describe('Erreurs — score invalide', () => {
    it('rejette un score supérieur à maxValue (défaut 20)', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await matiereRepo.assignerEnseignant('teacher-1', SUBJECT_ID);

      await expect(
        useCase.execute({ ...commandeBase(), sequenceScore: 25 })
      ).rejects.toThrow('Score invalide');
    });

    it('rejette un score négatif', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await matiereRepo.assignerEnseignant('teacher-1', SUBJECT_ID);

      await expect(
        useCase.execute({ ...commandeBase(), sequenceScore: -1 })
      ).rejects.toThrow('Score invalide');
    });

    it('accepte un score de 100 quand maxValue est 100', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await matiereRepo.assignerEnseignant('teacher-1', SUBJECT_ID);

      const r = await useCase.execute({
        ...commandeBase(),
        maxValue: 100,
        sequenceScore: 100,
      });
      expect(r.statut).toBe('DRAFT');
    });
  });
});
