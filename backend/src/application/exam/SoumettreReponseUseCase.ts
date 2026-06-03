/**
 * APPLICATION LAYER — Use Case : Soumettre une réponse d'examen
 *
 * Règle domaine : un élève ne peut soumettre qu'UNE SEULE fois.
 * Cette contrainte était absente du controller actuel (déléguée à Inngest).
 * Elle est maintenant explicite dans le domaine.
 */
import type {
  ExamenRepository,
  SoumissionProps,
} from '@domain/ports/repositories/ExamenRepository';

export interface SoumettreReponseCommande {
  examId: string;
  studentId: string;
  schoolId: string;
  answers?: Record<string, unknown>;
}

export class SoumettreReponseUseCase {
  constructor(private readonly examenRepository: ExamenRepository) {}

  async execute(commande: SoumettreReponseCommande): Promise<{ soumissionId: string }> {
    // 1. Vérifier que l'examen existe et est publié
    const examen = await this.examenRepository.findById(commande.examId);
    if (!examen) throw new Error(`Examen introuvable : ${commande.examId}`);
    if (examen.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé');
    }
    if (!examen.isPublished) {
      throw new Error("Cet examen n'est pas encore disponible");
    }

    // 2. Règle domaine : UN SEUL envoi par élève
    const dejaSoumis = await this.examenRepository.findSoumission(
      commande.examId,
      commande.studentId
    );
    if (dejaSoumis) {
      throw new Error(
        'Vous avez déjà soumis vos réponses pour cet examen. ' +
        'Une seule soumission est autorisée.'
      );
    }

    // 3. Enregistrer la soumission
    const soumission: SoumissionProps = {
      id: crypto.randomUUID(),
      examId: commande.examId,
      studentId: commande.studentId,
      schoolId: commande.schoolId,
      answers: commande.answers,
      submittedAt: new Date(),
    };

    await this.examenRepository.saveSoumission(soumission);
    return { soumissionId: soumission.id };
  }
}
