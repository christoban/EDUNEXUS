/**
 * Tests unitaires — EnvoyerBulletinsUseCase
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { EnvoyerBulletinsUseCase } from '@application/reportCard/EnvoyerBulletinsUseCase';
import { InMemoryBulletinRepository } from '../../../helpers/repositories/InMemoryBulletinRepository';
import { InMemoryBulletinValidationRepository } from '../../../helpers/repositories/InMemoryBulletinValidationRepository';
import { InMemoryUserRepository } from '../../../helpers/repositories/InMemoryUserRepository';
import { InMemoryEmailService } from '../../../helpers/services/InMemoryEmailService';
import { Bulletin } from '@domain/entities/Bulletin';

const SCHOOL_ID = 'school-1';
const CLASS_ID = 'class-1';
const PERIOD_ID = 'period-1';
const STUDENT_ID = 'student-1';

let bulletinRepo: InMemoryBulletinRepository;
let validationRepo: InMemoryBulletinValidationRepository;
let emailService: InMemoryEmailService;
let useCase: EnvoyerBulletinsUseCase;

beforeEach(() => {
  bulletinRepo = new InMemoryBulletinRepository();
  validationRepo = new InMemoryBulletinValidationRepository();
  emailService = new InMemoryEmailService();
  useCase = new EnvoyerBulletinsUseCase(bulletinRepo, new InMemoryUserRepository(), emailService, validationRepo);
});

function createGeneratedBulletin(): Bulletin {
  const b = Bulletin.create({
    schoolId: SCHOOL_ID,
    studentId: STUDENT_ID,
    academicYearId: 'year-1',
    academicPeriodId: PERIOD_ID,
    template: 'FR_SECONDARY',
  });
  b.definirLignesMatiere([{ id: '1', subjectId: 's1', subjectName: 'Maths', coefficient: 1, subjectAverage: 12 }]);
  b.definirResultats({ generalAverage: 12, rank: 1, totalStudents: 1, mention: 'Bien', absenceCount: 0 });
  b.marquerGenere('test.pdf');
  return b;
}

describe('EnvoyerBulletinsUseCase', () => {
  it('refuse si aucune session PUBLISHED n\'existe', async () => {
    bulletinRepo.ajouter(createGeneratedBulletin());

    await expect(
      useCase.execute({
        schoolId: SCHOOL_ID,
        classId: CLASS_ID,
        academicPeriodId: PERIOD_ID,
        nomEtablissement: 'École Test',
        nomPeriode: 'Trimestre 1',
      })
    ).rejects.toThrow('Publication non autorisée');
  });

  it('refuse si la session n\'est pas PUBLISHED', async () => {
    const session = await validationRepo.creerSession({ schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: PERIOD_ID, submittedById: 'admin-1' });
    bulletinRepo.ajouter(createGeneratedBulletin());

    await expect(
      useCase.execute({
        schoolId: SCHOOL_ID,
        classId: CLASS_ID,
        academicPeriodId: PERIOD_ID,
        nomEtablissement: 'École Test',
        nomPeriode: 'Trimestre 1',
      })
    ).rejects.toThrow('Publication non autorisée');
  });
});
