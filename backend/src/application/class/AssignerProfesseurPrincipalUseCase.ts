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

    classe.assignerProfesseurPrincipal(commande.teacherUserId);
    await this.classeRepository.update(classe);
  }
}
