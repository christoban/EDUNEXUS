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
  existsByEmail(email: string, schoolId: string): Promise<boolean>;

  // Écriture
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  delete(id: string): Promise<void>;

  // Spécifique auth
  findByIdWithRefreshVersion(id: string): Promise<{ user: User; refreshTokenVersion: number } | null>;

  // Authentification — bcrypt.compare dans l'adapter Prisma
  // Retourne null si email introuvable OU mot de passe incorrect
  authentifier(email: string, schoolId: string, plainPassword: string): Promise<User | null>;

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
  }): Promise<void>;

  // Suppression en cascade (profiles + données liées)
  supprimerAvecCascade(userId: string): Promise<void>;

  // Transfert d'élève vers une autre classe
  transfererEleve(params: {
    studentId: string;
    fromClasseId: string;
    toClasseId: string;
    demandeurId: string;
    schoolId: string;
  }): Promise<void>;
}
