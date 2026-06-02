import { Classe } from '@domain/entities/Classe';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';

export interface CreerClasseCommande {
  schoolId: string;
  name: string;
  level?: string;
  serie?: string;
  filiere?: string;
  sectionId?: string;
  capacity?: number;
}

export interface CreerClasseResultat {
  classeId: string;
  name: string;
  nomComplet: string;
}

export class CreerClasseUseCase {
  constructor(private readonly classeRepository: ClasseRepository) {}

  async execute(commande: CreerClasseCommande): Promise<CreerClasseResultat> {
    const dejaExiste = await this.classeRepository.existsByName(
      commande.schoolId,
      commande.name
    );
    if (dejaExiste) {
      throw new Error(
        `Une classe avec le nom "${commande.name}" existe déjà dans cet établissement`
      );
    }

    const classe = Classe.create({
      schoolId: commande.schoolId,
      name: commande.name,
      level: commande.level,
      serie: commande.serie,
      filiere: commande.filiere,
      sectionId: commande.sectionId,
      capacity: commande.capacity,
    });

    await this.classeRepository.save(classe);

    return {
      classeId: classe.id,
      name: classe.name,
      nomComplet: classe.nomComplet,
    };
  }
}
