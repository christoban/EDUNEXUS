/**
 * DOMAIN LAYER — Entité Presence (Attendance)
 * Enregistre la présence d'un élève à un cours ou une période.
 * Supporte le mode hors ligne avec marquage isOfflineSync.
 */
import type { AttendanceStatus, AttendancePeriod } from '@domain/types/enums';

export interface PresenceProps {
  id: string;
  schoolId: string;
  studentId: string;
  classId: string;
  academicPeriodId?: string;
  subjectId?: string;
  teacherId?: string;
  recordedById?: string;
  date: Date;
  status: AttendanceStatus;
  period: AttendancePeriod;
  isOfflineSync: boolean;
  syncedAt?: Date;
  createdAt: Date;
}

export interface EnregistrerPresenceProps {
  schoolId: string;
  studentId: string;
  classId: string;
  date: Date;
  status: AttendanceStatus;
  period: AttendancePeriod;
  recordedById: string;
  academicPeriodId?: string;
  subjectId?: string;
  teacherId?: string;
  isOfflineSync?: boolean;
}

export class Presence {
  private constructor(private readonly props: PresenceProps) {}

  // --- Factories ---

  static create(props: EnregistrerPresenceProps): Presence {
    if (!props.studentId) throw new Error('L\'identifiant de l\'élève est obligatoire');
    if (!props.classId) throw new Error('L\'identifiant de la classe est obligatoire');
    if (!props.date) throw new Error('La date est obligatoire');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const datePresence = new Date(props.date);
    datePresence.setHours(0, 0, 0, 0);

    // On ne peut pas enregistrer une présence dans le futur
    if (datePresence > today) {
      throw new Error('Impossible d\'enregistrer une présence pour une date future');
    }

    return new Presence({
      ...props,
      id: crypto.randomUUID(),
      isOfflineSync: props.isOfflineSync ?? false,
      createdAt: new Date(),
    });
  }

  static reconstituer(props: PresenceProps): Presence {
    return new Presence(props);
  }

  // --- Getters ---

  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get studentId(): string { return this.props.studentId; }
  get classId(): string { return this.props.classId; }
  get date(): Date { return this.props.date; }
  get status(): AttendanceStatus { return this.props.status; }
  get period(): AttendancePeriod { return this.props.period; }
  get subjectId(): string | undefined { return this.props.subjectId; }
  get isOfflineSync(): boolean { return this.props.isOfflineSync; }

  // --- Méthodes métier ---

  estPresent(): boolean { return this.props.status === 'PRESENT'; }
  estAbsent(): boolean { return this.props.status === 'ABSENT'; }
  estEnRetard(): boolean { return this.props.status === 'LATE'; }

  estAbsenceOuRetard(): boolean {
    return this.props.status === 'ABSENT' || this.props.status === 'LATE';
  }

  // Appelée lors de la synchronisation hors ligne réussie
  marquerSynchronise(): void {
    if (!this.props.isOfflineSync) {
      throw new Error('Cette présence n\'est pas marquée comme hors ligne');
    }
    this.props.isOfflineSync = false;
    this.props.syncedAt = new Date();
  }

  // --- Sérialisation ---

  toObject(): PresenceProps {
    return { ...this.props };
  }
}
