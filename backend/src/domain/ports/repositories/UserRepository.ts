/**
 * DOMAIN LAYER — Port Repository User
 * Contrat que toute implémentation (Prisma, mémoire...) doit respecter.
 */
import type { User } from '@domain/entities/User';
import type { UserRole } from '@domain/types/enums';

export interface UserRepository {
  // Lecture
  findById(id: string): Promise<User | null>;
  findByEmail(email: string, schoolId: string): Promise<User | null>;
  findByPhone(phone: string, schoolId: string): Promise<User | null>;
  findBySchool(schoolId: string): Promise<User[]>;
  findByRole(schoolId: string, role: UserRole): Promise<User[]>;
  /** Élèves (role STUDENT) inscrits dans une classe donnée, via StudentProfile.classId. */
  findByClass(schoolId: string, classId: string): Promise<User[]>;
  existsByEmail(email: string, schoolId: string): Promise<boolean>;

  // Écriture
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  delete(id: string): Promise<void>;

  // Spécifique auth
  findByIdWithRefreshVersion(id: string): Promise<{ user: User; refreshTokenVersion: number } | null>;

  // Authentification — bcrypt.compare dans l'adapter Prisma
  // Retourne null si email introuvable OU mot de passe incorrect
  // role optionnel : filtre sur le rôle exact si fourni
  authentifier(email: string, schoolId: string, plainPassword: string, role?: string): Promise<User | null>;

  // Retourne tous les rôles disponibles pour cet email+école SI le mot de passe est correct
  // Utilisé pour détecter un mismatch multi-rôles sans exposer les rôles sans vérification
  listerRolesAvecMotDePasse(email: string, schoolId: string, plainPassword: string): Promise<string[]>;

  // Création avec profil de rôle (student/teacher/parent/staff)
  saveAvecProfil(user: User, profilData: {
    passwordHash: string;
    staffTitle?: string;
    specializations?: string[];
    subjectIds?: string[];
    classeId?: string;
    dateOfBirth?: Date;
    gender?: string;
    parentOfStudentIds?: string[];
  }): Promise<void>;

  // Mise à jour partielle avec sync des sous-profils
  mettreAJourAvecProfil(userId: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string;
    email?: string;
    isActive?: boolean;
    passwordHash?: string;
    subjectIds?: string[];
    classeId?: string;
    dateOfBirth?: Date;
    gender?: string;
  }): Promise<void>;

  // Suppression douce (Couche 1) — pose deletedAt, ne touche plus aux données liées.
  // Nom historique conservé ("avecCascade"), comportement changé — voir PrismaUserRepository.
  supprimerAvecCascade(userId: string, deletedById?: string): Promise<void>;
  restaurer(userId: string): Promise<void>;

  // Transfert d'élève vers une autre classe
  transfererEleve(params: {
    studentId: string;
    fromClasseId: string;
    toClasseId: string;
    demandeurId: string;
    schoolId: string;
  }): Promise<void>;

  /**
   * Retourne les adresses email de tous les parents d'un élève.
   * Utilisé par EnvoyerBulletinsUseCase pour envoyer aux parents, pas à l'élève.
   */
  findEmailsParentsParEleve(studentId: string): Promise<string[]>;
}
