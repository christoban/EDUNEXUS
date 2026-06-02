/**
 * APPLICATION LAYER — Use Case : Inscrire un utilisateur
 * Logique extraite de controllers/user.ts → register handler
 * Gère la création de tous les types de profils (student/teacher/parent/staff).
 */
import { User } from '@domain/entities/User';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { UserRole, StaffPermissionType } from '@domain/types/enums';
import { getPermissionsPourTitre } from '@domain/rules/StaffPermissionRules';

export interface InscrireUtilisateurCommande {
  schoolId: string;
  role: UserRole;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  passwordHash: string; // Hashé avant d'arriver ici

  // STAFF
  staffTitle?: string;   // "Censeur", "Intendant", etc.
  staffSectionId?: string;
  staffPermissions?: StaffPermissionType[]; // Override manuel si Admin le souhaite

  // TEACHER
  specializations?: string[];
  subjectIds?: string[];

  // STUDENT
  classeId?: string;
  dateOfBirth?: Date;
  gender?: string;

  // PARENT
  parentOfStudentIds?: string[];
}

export interface InscrireUtilisateurResultat {
  userId: string;
  role: UserRole;
  nomComplet: string;
}

export class InscrireUtilisateurUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(commande: InscrireUtilisateurCommande): Promise<InscrireUtilisateurResultat> {
    // 1. Vérifier doublon email/école
    if (commande.email) {
      const existe = await this.userRepository.existsByEmail(
        commande.email, commande.schoolId
      );
      if (existe) {
        throw new Error(
          `Un utilisateur avec l'email "${commande.email}" existe déjà dans cet établissement`
        );
      }
    }

    // 2. Résoudre les permissions STAFF depuis le titre
    let permissions: StaffPermissionType[] = commande.staffPermissions ?? [];
    if (commande.role === 'STAFF' && commande.staffTitle && permissions.length === 0) {
      permissions = getPermissionsPourTitre(commande.staffTitle);
    }

    // 3. Créer l'entité User
    const user = User.create({
      schoolId: commande.schoolId,
      role: commande.role,
      email: commande.email,
      phone: commande.phone,
      firstName: commande.firstName,
      lastName: commande.lastName,
      staffPermissions: permissions,
      staffSectionId: commande.staffSectionId,
    });

    // 4. Sauvegarder avec les données de profil
    await this.userRepository.saveAvecProfil(user, {
      passwordHash: commande.passwordHash,
      staffTitle: commande.staffTitle,
      specializations: commande.specializations,
      subjectIds: commande.subjectIds,
      classeId: commande.classeId,
      dateOfBirth: commande.dateOfBirth,
      gender: commande.gender,
      parentOfStudentIds: commande.parentOfStudentIds,
    });

    return {
      userId: user.id,
      role: user.role,
      nomComplet: user.nomComplet,
    };
  }
}
