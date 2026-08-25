export interface DisciplineSessionData {
  id: string;
  schoolId: string;
  studentId: string;
  presidedById: string;
  motif: string;
  composition: unknown;
  parentNotifiedAt: Date;
  scheduledAt: Date;
  status: string;
  heldAt: Date | null;
  decision: string | null;
  pv: string | null;
  disciplineRecordId: string | null;
  createdAt: Date;
}

export interface DisciplineRecordData {
  id: string;
  schoolId: string;
  studentId: string;
  type: string;
  reason: string;
  decidedById: string;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
}

export interface DisciplineRepository {
  verifierEleve(studentId: string, schoolId: string): Promise<boolean>;

  creerSession(data: {
    schoolId: string;
    studentId: string;
    presidedById: string;
    motif: string;
    composition: unknown;
    parentNotifiedAt: Date;
    scheduledAt: Date;
  }): Promise<DisciplineSessionData>;

  trouverSession(id: string, schoolId: string): Promise<DisciplineSessionData | null>;

  creerRecord(data: {
    schoolId: string;
    studentId: string;
    type: string;
    reason: string;
    decidedById: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<DisciplineRecordData>;

  mettreAJourSession(id: string, data: {
    heldAt: Date;
    decision: string;
    pv: string;
    status: string;
    disciplineRecordId: string;
  }): Promise<DisciplineSessionData & { disciplineRecord: DisciplineRecordData | null }>;
}
