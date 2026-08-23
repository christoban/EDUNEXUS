import type {
  SanteEleveRepository,
  DonneesSanteEleve,
} from '@domain/ports/repositories/SanteEleveRepository';

export class InMemorySanteEleveRepository implements SanteEleveRepository {
  private donnees = new Map<string, DonneesSanteEleve>();
  scoresEnregistres = new Map<string, number>();

  definir(studentId: string, donnees: DonneesSanteEleve): void {
    this.donnees.set(studentId, donnees);
  }

  async getDonneesSante(
    studentId: string,
    _schoolId: string,
    _yearId: string
  ): Promise<DonneesSanteEleve | null> {
    return this.donnees.get(studentId) ?? null;
  }

  async sauvegarderScore(studentId: string, score: number): Promise<void> {
    this.scoresEnregistres.set(studentId, score);
  }
}
