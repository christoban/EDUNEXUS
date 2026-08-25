export interface AcademicEventData {
  id: string;
  schoolId: string;
  createdById: string;
  type: string;
  category: string;
  title: string;
  description: string | null;
  targetRoles: string[];
  level: string | null;
  openDate: Date | null;
  closeDate: Date | null;
  status: string;
  linkedResourceId: string | null;
  triggeredById: string | null;
  triggeredAt: Date | null;
  reminderSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AcademicEventListData extends AcademicEventData {
  createdBy: { firstName: string; lastName: string };
  triggeredBy: { firstName: string; lastName: string } | null;
}

export interface AcademicEventRepository {
  creer(data: {
    schoolId: string;
    createdById: string;
    type: string;
    category: string;
    title: string;
    description?: string;
    targetRoles: string[];
    level?: string;
    openDate?: Date;
    closeDate?: Date;
    status: string;
    linkedResourceId?: string | null;
  }): Promise<{ id: string }>;

  trouverParId(id: string, schoolId: string): Promise<AcademicEventData | null>;

  mettreAJour(id: string, data: {
    status?: string;
    openDate?: Date;
    closeDate?: Date;
    triggeredById?: string;
    triggeredAt?: Date;
    linkedResourceId?: string | null;
    reminderSentAt?: null;
  }): Promise<void>;

  listerTous(schoolId: string): Promise<AcademicEventListData[]>;

  listerActifs(schoolId: string, role: string, dansQuatorzeJours: Date): Promise<{
    id: string;
    type: string;
    category: string;
    title: string;
    description: string | null;
    openDate: Date | null;
    closeDate: Date | null;
    status: string;
  }[]>;
}
