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
  countEleves(classeId: string): Promise<number>;

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
   * Suppression en cascade — 9 étapes transactionnelles :
   * attendance, grades, exams+submissions, classCouncilSessions,
   * timetables, classPromotions, studentPromotions,
   * détachement élèves (classId → null), suppression classe.
   */
  supprimerAvecCascade(classeId: string): Promise<void>;
}
