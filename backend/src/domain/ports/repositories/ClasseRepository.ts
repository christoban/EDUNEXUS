/**
 * DOMAIN LAYER — Port Repository Classe
 */
import type { Classe } from '@domain/entities/Classe';

export interface ClasseRepository {
  // Lecture
  findById(id: string): Promise<Classe | null>;
  findBySchool(schoolId: string): Promise<Classe[]>;
  findBySection(sectionId: string): Promise<Classe[]>;
  findByLevel(schoolId: string, level: string): Promise<Classe[]>;
  findBySchoolAndYear(schoolId: string, academicYearId: string): Promise<Classe[]>;
  countEleves(classeId: string): Promise<number>;

  /** Bascule DRAFT→ACTIVE toutes les classes proposées d'une année — ValiderStructureAnneeSuivanteUseCase. */
  activerToutesDraft(schoolId: string, academicYearId: string): Promise<number>;

  /**
   * Suppression définitive (pas la corbeille — supprimerAvecCascade) de toutes les classes DRAFT
   * d'une année : une proposition jamais validée n'a aucune donnée liée à préserver (aucun
   * élève, aucune note). AnnulerStructureAnneeSuivanteUseCase. Retourne les ids supprimés, pour
   * que l'appelant purge aussi les mappings ClassPromotion qui pointent dessus.
   */
  supprimerToutesDraft(schoolId: string, academicYearId: string): Promise<string[]>;

  /**
   * Vérifie l'unicité du nom dans une école.
   * excludeId : exclut la classe courante lors d'une modification.
   */
  existsByName(schoolId: string, name: string, excludeId?: string): Promise<boolean>;

  /**
   * Retourne la classe dont cet enseignant est professeur principal (null si aucune).
   * Utilisé pour la règle : un enseignant ne peut être PP que d'une seule classe.
   */
  findClasseDeProfPrincipal(teacherUserId: string): Promise<Classe | null>;

  // Écriture
  save(classe: Classe): Promise<void>;
  update(classe: Classe): Promise<void>;

  /**
   * Suppression douce (Couche 1) — pose deletedAt, ne touche plus aux données liées.
   * Nom historique conservé ("avecCascade"), comportement changé — voir PrismaClasseRepository.
   */
  supprimerAvecCascade(classeId: string, deletedById?: string): Promise<void>;
  restaurer(classeId: string): Promise<void>;
}
