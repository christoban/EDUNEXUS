import { Classe } from '@domain/entities/Classe';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { CreerCanalClasseUseCase } from '@application/messagerie/CreerCanalClasseUseCase';
import type { CreerCanalParentsUseCase } from '@application/messagerie/CreerCanalParentsUseCase';

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
  constructor(
    private readonly classeRepository: ClasseRepository,
    // Optionnels : une classe doit avoir ses canaux de messagerie dès sa création (jamais créés
    // à la main), mais ce use case reste testable/utilisable sans messagerie câblée (voir
    // CreerClasseUseCase.test.ts, qui l'instancie avec un seul argument).
    private readonly creerCanalClasseUseCase?: CreerCanalClasseUseCase,
    private readonly creerCanalParentsUseCase?: CreerCanalParentsUseCase,
  ) {}

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

    if (this.creerCanalClasseUseCase && this.creerCanalParentsUseCase) {
      const params = { schoolId: commande.schoolId, classId: classe.id, className: classe.nomComplet };
      // Ne doit jamais faire échouer la création de la classe — un canal manquant se répare en
      // rouvrant la messagerie, une classe non créée est bien plus grave.
      await Promise.allSettled([
        this.creerCanalClasseUseCase.execute(params),
        this.creerCanalParentsUseCase.execute(params),
      ]);
    }

    return {
      classeId: classe.id,
      name: classe.name,
      nomComplet: classe.nomComplet,
    };
  }
}
