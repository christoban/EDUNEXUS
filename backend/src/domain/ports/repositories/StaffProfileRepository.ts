/**
 * DOMAIN LAYER — Port Repository StaffProfile (désignation AP / HOD)
 * Opérations liées à la désignation d'un enseignant comme Animateur Pédagogique.
 */
import type { StaffPermissionType } from '@domain/types/enums';

export interface UserPourDesignationAP {
  id: string;
  role: string;
  schoolId: string;
  firstName: string;
  lastName: string;
}

export interface StaffProfileRepository {
  findUserPourDesignationAP(userId: string): Promise<UserPourDesignationAP | null>;
  /** ASSIGN — tx atomique : upsert StaffProfile + permissions + teacherProfile.supervisedSubjectIds. */
  assignerAP(userId: string, schoolId: string, permissions: StaffPermissionType[], departmentSubjectIds: string[]): Promise<void>;
  /** REMOVE — tx atomique : retire permissions, supprime le profil si vide, vide supervisedSubjectIds. */
  retirerAP(userId: string, permissions: StaffPermissionType[]): Promise<void>;
}
