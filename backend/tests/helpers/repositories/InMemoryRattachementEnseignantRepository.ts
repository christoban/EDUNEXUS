import type {
  RattachementEnseignantRepository,
  VerifierRattachementOptions,
} from '@domain/ports/repositories/RattachementEnseignantRepository';

export class InMemoryRattachementEnseignantRepository implements RattachementEnseignantRepository {
  private assignations: { teacherId: string; classId: string; subjectId: string }[] = [];
  private professeursPrincipaux: { classId: string; professorPrincipalId: string }[] = [];

  ajouterAssignation(teacherId: string, classId: string, subjectId: string): void {
    this.assignations.push({ teacherId, classId, subjectId });
  }

  ajouterProfesseurPrincipal(classId: string, professorPrincipalId: string): void {
    this.professeursPrincipaux.push({ classId, professorPrincipalId });
  }

  async estRattacheALaClasse(
    teacherId: string,
    classId: string,
    subjectId: string | undefined,
    options: VerifierRattachementOptions,
  ): Promise<boolean> {
    const assignation = this.assignations.some(
      (a) =>
        a.teacherId === teacherId &&
        a.classId === classId &&
        (subjectId === undefined || a.subjectId === subjectId),
    );
    if (assignation) return true;
    if (!options.autoriserProfesseurPrincipal) return false;

    return this.professeursPrincipaux.some(
      (p) => p.classId === classId && p.professorPrincipalId === teacherId,
    );
  }
}