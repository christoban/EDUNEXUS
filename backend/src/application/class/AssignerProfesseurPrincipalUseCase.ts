import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface AssignerProfesseurCommande {
  classeId: string;
  teacherUserId: string;
  schoolId: string;
  demandeurRole: string;
}

export class AssignerProfesseurPrincipalUseCase {
  constructor(
    private readonly classeRepository: ClasseRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(commande: AssignerProfesseurCommande): Promise<void> {
    if (commande.demandeurRole !== 'ADMIN') {
      throw new Error('Seul un Admin peut assigner un Professeur Principal');
    }

    const classe = await this.classeRepository.findById(commande.classeId);
    if (!classe) throw new Error(`Classe introuvable : ${commande.classeId}`);
    if (classe.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : classe hors de votre établissement');
    }

    const enseignant = await this.userRepository.findById(commande.teacherUserId);
    if (!enseignant) throw new Error('Enseignant introuvable');
    if (!enseignant.estEnseignant()) {
      throw new Error(
        `L'utilisateur "${enseignant.nomComplet}" n'est pas un enseignant`
      );
    }
    if (enseignant.schoolId !== commande.schoolId) {
      throw new Error("Cet enseignant n'appartient pas à votre établissement");
    }

    // Un enseignant ne peut être Professeur Principal que d'une seule classe
    const classeExistante = await this.classeRepository.findClasseDeProfPrincipal(commande.teacherUserId);
    if (classeExistante && classeExistante.id !== commande.classeId) {
      throw new Error(
        `L'enseignant "${enseignant.nomComplet}" est déjà Professeur Principal de la classe "${classeExistante.name}". Un enseignant ne peut être PP que d'une seule classe.`
      );
    }

    classe.assignerProfesseurPrincipal(commande.teacherUserId);
    await this.classeRepository.update(classe);
  }
}
