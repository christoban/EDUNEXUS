/**
 * DOMAIN LAYER — Règles de permissions STAFF
 * Mapping officiel : titre terrain → permissions système
 * Source : Spécification EduNexus + terrain Cameroun
 */
import type { StaffPermissionType } from '@domain/types/enums';

export const PERMISSIONS_PAR_TITRE: Record<string, StaffPermissionType[]> = {
  // Francophone
  'Censeur': [
    'MANAGE_TIMETABLE', 'VALIDATE_GRADES', 'MANAGE_EXAMS',
    'SUPERVISE_TEACHERS', 'MANAGE_ATTENDANCE', 'MANAGE_CLASS_COUNCIL',
    'MANAGE_CATCHUP_REQUESTS', 'GENERATE_REPORTS',
    'VIEW_SUPERVISED_GRADES', 'SUPERVISE_LESSON_PLANS',
  ],
  'Surveillant Général': [
    'MANAGE_ATTENDANCE', 'MANAGE_DISCIPLINE', 'MANAGE_INCIDENTS',
  ],
  'Intendant': [
    'MANAGE_FINANCE', 'VALIDATE_PAYMENTS', 'GENERATE_REPORTS',
  ],
  'Économe': [
    'MANAGE_FINANCE', 'VALIDATE_PAYMENTS', 'GENERATE_REPORTS',
  ],
  'Chef des Travaux': [
    'MANAGE_ATELIERS', 'MANAGE_PRACTICAL_GRADES', 'MANAGE_INTERNSHIPS',
    'MANAGE_STAGE_CONVENTIONS', 'MANAGE_WORKSHOP_STOCK', 'GENERATE_REPORTS',
  ],
  'Animateur Pédagogique': [
    'VIEW_DEPARTMENT_GRADES', 'SUPERVISE_DEPARTMENT_TEACHERS',
    'VALIDATE_DEPARTMENT_TIMETABLE', 'GENERATE_DEPARTMENT_REPORTS',
    'VIEW_SUPERVISED_GRADES', 'SUPERVISE_LESSON_PLANS',
    'GENERATE_PEDAGOGICAL_REPORTS', 'MANAGE_CE_REPORTS', 'MANAGE_PEDAGOGICAL_BRIEF',
  ],
  'Documentaliste': ['MANAGE_LIBRARY'],
  "Conseiller d'Orientation": ['MANAGE_ORIENTATION'],
  'Comptable-Matières': ['MANAGE_PATRIMOINE', 'MANAGE_DEGRADATIONS'],

  // Anglophone
  'Vice-Principal': [
    'MANAGE_TIMETABLE', 'VALIDATE_GRADES', 'MANAGE_EXAMS',
    'SUPERVISE_TEACHERS', 'MANAGE_ATTENDANCE', 'MANAGE_CLASS_COUNCIL',
    'MANAGE_CATCHUP_REQUESTS', 'GENERATE_REPORTS',
    'VIEW_SUPERVISED_GRADES', 'SUPERVISE_LESSON_PLANS',
  ],
  'Discipline Master': [
    'MANAGE_ATTENDANCE', 'MANAGE_DISCIPLINE', 'MANAGE_INCIDENTS',
  ],
  'Bursar': [
    'MANAGE_FINANCE', 'VALIDATE_PAYMENTS', 'GENERATE_REPORTS',
  ],
  'HOD': [
    'VIEW_DEPARTMENT_GRADES', 'SUPERVISE_DEPARTMENT_TEACHERS',
    'VALIDATE_DEPARTMENT_TIMETABLE', 'GENERATE_DEPARTMENT_REPORTS',
    'VIEW_SUPERVISED_GRADES', 'SUPERVISE_LESSON_PLANS',
    'GENERATE_PEDAGOGICAL_REPORTS', 'MANAGE_CE_REPORTS', 'MANAGE_PEDAGOGICAL_BRIEF',
  ],
};

/**
 * Retourne les permissions pour un titre donné.
 * Si le titre est inconnu, retourne un tableau vide.
 */
export function getPermissionsPourTitre(titre: string): StaffPermissionType[] {
  return PERMISSIONS_PAR_TITRE[titre] ?? [];
}

/**
 * Vérifie qu'un titre est reconnu par le système.
 */
export function titreReconnu(titre: string): boolean {
  return titre in PERMISSIONS_PAR_TITRE;
}
