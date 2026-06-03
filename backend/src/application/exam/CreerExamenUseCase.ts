/**
 * APPLICATION LAYER — Use Case : Créer un examen manuel
 *
 * La génération par IA est supprimée — les enseignants créent
 * leurs propres épreuves. isAiGenerated est toujours false.
 */
import type { ExamenRepository, ExamenProps } from '@domain/ports/repositories/ExamenRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface CreerExamenCommande {
  schoolId: string;
  title: string;
  subjectId: string;
  classId: string;
  academicYearId: string;
  scheduledAt?: Date;
  duration?: number;
  demandeurId: string;
  demandeurRole: string;
}

export interface CreerExamenResultat {
  examenId: string;
  title: string;
}

export class CreerExamenUseCase {
  constructor(
    private readonly examenRepository: ExamenRepository,
    private readonly matiereRepository: MatiereRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(commande: CreerExamenCommande): Promise<CreerExamenResultat> {
    // 1. Vérifier permission
    const demandeur = await this.userRepository.findById(commande.demandeurId);
    if (!demandeur) throw new Error('Utilisateur introuvable');

    if (!demandeur.estAdmin() && !demandeur.estEnseignant()) {
      throw new Error('Seul un enseignant ou un Admin peut créer un examen');
    }

    // 2. Vérifier que la matière appartient à l'école
    const matiere = await this.matiereRepository.findById(commande.subjectId);
    if (!matiere || matiere.schoolId !== commande.schoolId) {
      throw new Error('Matière introuvable dans votre établissement');
    }

    // 3. Si enseignant : vérifier qu'il est assigné à cette matière
    if (demandeur.estEnseignant()) {
      const estAssigne = await this.matiereRepository.estEnseignantAssigne(
        commande.demandeurId,
        commande.subjectId
      );
      if (!estAssigne) {
        throw new Error(
          `Vous n'êtes pas assigné à la matière "${matiere.name}"`
        );
      }
    }

    // 4. Créer l'examen (isAiGenerated toujours false)
    const examen: ExamenProps = {
      id: crypto.randomUUID(),
      schoolId: commande.schoolId,
      title: commande.title.trim(),
      subjectId: commande.subjectId,
      classId: commande.classId,
      academicYearId: commande.academicYearId,
      scheduledAt: commande.scheduledAt,
      duration: commande.duration,
      isPublished: false, // DRAFT par défaut
      createdAt: new Date(),
    };

    await this.examenRepository.save(examen);

    return { examenId: examen.id, title: examen.title };
  }
}
