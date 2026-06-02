/**
 * DOMAIN LAYER — Port Repository Presence (Attendance)
 */
import type { Presence } from '@domain/entities/Presence';
import type { AttendanceStatus, AttendancePeriod } from '@domain/types/enums';

export interface StatistiquesPresence {
  totalJours: number;
  joursPresent: number;
  joursAbsent: number;
  joursRetard: number;
  tauxPresence: number; // pourcentage 0-100
}

export interface PresenceRepository {
  // Lecture
  findById(id: string): Promise<Presence | null>;
  findByEleve(studentId: string, academicPeriodId: string): Promise<Presence[]>;
  findByClasse(classId: string, date: Date, period: AttendancePeriod): Promise<Presence[]>;
  findByClasseEtPeriode(classId: string, academicPeriodId: string): Promise<Presence[]>;

  // Comptages pour les alertes (Loi absences)
  countAbsencesNonJustifiees(studentId: string, academicPeriodId: string): Promise<number>;
  countAbsencesConsecutives(studentId: string): Promise<number>;

  // Stats pour dashboard et bulletins
  getStatistiquesEleve(studentId: string, academicPeriodId: string): Promise<StatistiquesPresence>;

  // Vérifier si une présence existe déjà (éviter les doublons)
  existeDeja(studentId: string, date: Date, period: AttendancePeriod): Promise<boolean>;

  // Écriture
  save(presence: Presence): Promise<void>;
  saveMany(presences: Presence[]): Promise<void>; // Enregistrement en bloc d'une classe
  update(presence: Presence): Promise<void>;

  // Sync hors ligne
  findPresencesHorsLigneEnAttente(userId: string): Promise<Presence[]>;
}
