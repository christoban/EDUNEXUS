import { describe, it, expect, beforeEach } from 'bun:test';
import { EnregistrerPresenceUseCase } from '@application/attendance/EnregistrerPresenceUseCase';
import { User } from '@domain/entities/User';
import { InMemoryPresenceRepository } from './helpers/InMemoryPresenceRepository';
import { InMemoryUserRepository } from './helpers/InMemoryUserRepository';
import { InMemoryNotificationService } from './helpers/InMemoryNotificationService';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SCHOOL_ID = 'school-1';
const CLASS_ID = 'class-3e';
const PERIOD_ID = 'period-1';

// Date passée locale (aujourd'hui - 1 jour) pour passer la validation de Presence.create
const DATE_PASSEE = new Date(Date.now() - 86_400_000);
const DATE_FUTURE = new Date(Date.now() + 86_400_000);

function creerEnseignant(id = 'teacher-1', isActive = true) {
  return User.reconstituer({
    id,
    schoolId: SCHOOL_ID,
    role: 'TEACHER',
    email: `${id}@ecole.cm`,
    firstName: 'Jean',
    lastName: 'Dupont',
    isActive,
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function commandeBase() {
  return {
    schoolId: SCHOOL_ID,
    classId: CLASS_ID,
    academicPeriodId: PERIOD_ID,
    teacherId: 'teacher-1',
    recordedById: 'teacher-1',
    date: DATE_PASSEE,
    period: 'MORNING' as const,
    presences: [
      { studentId: 'eleve-1', statut: 'PRESENT' as const },
      { studentId: 'eleve-2', statut: 'ABSENT' as const },
      { studentId: 'eleve-3', statut: 'LATE' as const },
    ],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('EnregistrerPresenceUseCase', () => {
  let presenceRepo: InMemoryPresenceRepository;
  let userRepo: InMemoryUserRepository;
  let notifService: InMemoryNotificationService;
  let useCase: EnregistrerPresenceUseCase;

  beforeEach(() => {
    presenceRepo = new InMemoryPresenceRepository();
    userRepo = new InMemoryUserRepository();
    notifService = new InMemoryNotificationService();
    useCase = new EnregistrerPresenceUseCase(presenceRepo, userRepo, notifService);
    userRepo.ajouter(creerEnseignant());
  });

  describe('Cas nominal', () => {
    it('retourne le bon nombre de présences enregistrées', async () => {
      const resultat = await useCase.execute(commandeBase());
      expect(resultat.enregistrees).toBe(3);
    });

    it('identifie correctement les absents', async () => {
      const resultat = await useCase.execute(commandeBase());
      expect(resultat.absents).toEqual(['eleve-2']);
      expect(resultat.absents).not.toContain('eleve-1');
    });

    it('identifie correctement les retardataires', async () => {
      const resultat = await useCase.execute(commandeBase());
      expect(resultat.retards).toEqual(['eleve-3']);
      expect(resultat.retards).not.toContain('eleve-1');
    });

    it('persiste toutes les présences dans le dépôt', async () => {
      await useCase.execute(commandeBase());
      expect(presenceRepo.compter()).toBe(3);
    });

    it('envoie une notification SMS pour chaque absent', async () => {
      await useCase.execute(commandeBase());
      expect(notifService.appels).toHaveLength(1);
      expect(notifService.appels[0].userId).toBe('eleve-2');
      expect(notifService.appels[0].type).toBe('ABSENCE_ALERT');
      expect(notifService.appels[0].canal).toBe('SMS');
    });

    it('ne notifie pas si isOfflineSync est vrai', async () => {
      await useCase.execute({ ...commandeBase(), isOfflineSync: true });
      expect(notifService.appels).toHaveLength(0);
    });

    it('retourne des tableaux vides si tout le monde est présent', async () => {
      const resultat = await useCase.execute({
        ...commandeBase(),
        presences: [
          { studentId: 'eleve-1', statut: 'PRESENT' },
          { studentId: 'eleve-2', statut: 'PRESENT' },
        ],
      });
      expect(resultat.absents).toHaveLength(0);
      expect(resultat.retards).toHaveLength(0);
    });
  });

  describe('Erreurs — enseignant', () => {
    it('rejette si l\'enseignant n\'existe pas', async () => {
      await expect(
        useCase.execute({ ...commandeBase(), teacherId: 'inconnu' })
      ).rejects.toThrow('Enseignant introuvable ou inactif');
    });

    it('rejette si l\'enseignant est inactif', async () => {
      userRepo.ajouter(creerEnseignant('teacher-inactif', false));

      await expect(
        useCase.execute({ ...commandeBase(), teacherId: 'teacher-inactif' })
      ).rejects.toThrow('Enseignant introuvable ou inactif');
    });
  });

  describe('Erreurs — doublon', () => {
    it('rejette si les présences ont déjà été enregistrées pour ce créneau', async () => {
      await useCase.execute(commandeBase());

      await expect(useCase.execute(commandeBase())).rejects.toThrow('déjà été enregistrées');
    });
  });

  describe('Erreurs — date future', () => {
    it('rejette si la date est dans le futur', async () => {
      await expect(
        useCase.execute({ ...commandeBase(), date: DATE_FUTURE })
      ).rejects.toThrow('date future');
    });
  });
});
