import { describe, it, expect, beforeEach } from 'bun:test';
import { SoumettreReponseUseCase } from '../SoumettreReponseUseCase';
import { InMemoryExamenRepository } from './helpers/InMemoryExamenRepository';
import type { ExamenProps } from '@domain/ports/repositories/ExamenRepository';

describe('SoumettreReponseUseCase', () => {
  let repo: InMemoryExamenRepository;
  let useCase: SoumettreReponseUseCase;

  const creerExamenPublie = (): ExamenProps => ({
    id: 'exam-1',
    schoolId: 'school-1',
    title: 'Examen de Maths Trimestre 1',
    subjectId: 'maths-1',
    classId: 'classe-1',
    academicYearId: 'annee-1',
    isPublished: true,
    createdAt: new Date(),
  });

  const creerExamenDraft = (): ExamenProps => ({
    ...creerExamenPublie(),
    id: 'exam-draft',
    isPublished: false,
  });

  beforeEach(() => {
    repo = new InMemoryExamenRepository();
    useCase = new SoumettreReponseUseCase(repo);
    repo.ajouter(creerExamenPublie());
    repo.ajouter(creerExamenDraft());
  });

  it('devrait enregistrer une soumission valide', async () => {
    const resultat = await useCase.execute({
      examId: 'exam-1',
      studentId: 'eleve-1',
      schoolId: 'school-1',
      answers: { q1: 'A', q2: 'B' },
    });

    expect(resultat.soumissionId).toBeDefined();
    expect(repo.getSoumissions()).toHaveLength(1);
  });

  it('devrait rejeter une double soumission (règle domaine)', async () => {
    await useCase.execute({
      examId: 'exam-1',
      studentId: 'eleve-1',
      schoolId: 'school-1',
    });

    await expect(
      useCase.execute({
        examId: 'exam-1',
        studentId: 'eleve-1',
        schoolId: 'school-1',
      })
    ).rejects.toThrow('déjà soumis');
  });

  it('devrait permettre à deux élèves différents de soumettre', async () => {
    await useCase.execute({ examId: 'exam-1', studentId: 'eleve-1', schoolId: 'school-1' });
    await useCase.execute({ examId: 'exam-1', studentId: 'eleve-2', schoolId: 'school-1' });

    expect(repo.getSoumissions()).toHaveLength(2);
  });

  it("devrait rejeter si l'examen n'est pas publié", async () => {
    await expect(
      useCase.execute({
        examId: 'exam-draft',
        studentId: 'eleve-1',
        schoolId: 'school-1',
      })
    ).rejects.toThrow('pas encore disponible');
  });

  it("devrait rejeter si l'examen est introuvable", async () => {
    await expect(
      useCase.execute({
        examId: 'exam-inexistant',
        studentId: 'eleve-1',
        schoolId: 'school-1',
      })
    ).rejects.toThrow('introuvable');
  });

  it('devrait rejeter un accès hors établissement', async () => {
    await expect(
      useCase.execute({
        examId: 'exam-1',
        studentId: 'eleve-1',
        schoolId: 'autre-school',
      })
    ).rejects.toThrow('Accès refusé');
  });
});
