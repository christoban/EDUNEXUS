/**
 * DOMAIN LAYER — Port Repository Orientation
 * Toutes les opérations de persistance du module d'orientation.
 */
import type { FicheOrientation, NiveauRisque, TypePreoccupation, TypeEntretien, MotifEntretien, StatutEntretien, TypeTest, StatutRecommandation } from '@domain/entities/FicheOrientation';

// ── DTOs lecture ─────────────────────────────────────────────────────────────

export interface FicheListItem {
  id: string;
  studentId: string;
  status: string;
  riskLevel: string;
  mainConcern: string | null;
  createdAt: Date;
  updatedAt: Date;
  student: { id: string; firstName: string; lastName: string; studentProfile?: { class?: { name: string } | null } | null };
  _count: { entretiens: number; tests: number; suivis: number };
}

export interface EntretienDetail {
  id: string;
  ficheOrientationId: string;
  date: Date;
  type: TypeEntretien;
  motif: MotifEntretien;
  notes: string | null;
  recommendations: string | null;
  nextActions: string | null;
  parentNotified: boolean;
  followUpDate: Date | null;
  status: StatutEntretien;
  createdAt: Date;
}

export interface TestDetail {
  id: string;
  ficheOrientationId: string;
  type: TypeTest;
  datePassage: Date;
  resultats: string;
  interpretation: string | null;
  scoreGlobal: number | null;
  createdAt: Date;
}

export interface RecommandationDetail {
  id: string;
  ficheOrientationId: string;
  studentId: string;
  serieActuelle: string;
  serieRecommandee: string;
  justification: string;
  parentNotified: boolean;
  adminValidated: boolean;
  status: StatutRecommandation;
  createdAt: Date;
}

export interface SuiviDetail {
  id: string;
  ficheOrientationId: string;
  date: Date;
  riskLevel: NiveauRisque;
  mainConcern: TypePreoccupation;
  interventions: string | null;
  prochainRdv: Date | null;
  notes: string | null;
}

export interface FicheDetail {
  id: string;
  studentId: string;
  schoolId: string;
  academicYearId: string;
  conseillerId: string;
  status: string;
  riskLevel: string;
  mainConcern: string | null;
  createdAt: Date;
  updatedAt: Date;
  student: { id: string; firstName: string; lastName: string; studentProfile?: { class?: { name: string } | null } | null };
  entretiens: EntretienDetail[];
  tests: TestDetail[];
  recommandation: RecommandationDetail | null;
  suivis: SuiviDetail[];
}

export interface OrientationStats {
  fichesOuvertes:      number;
  elevesArisqueEleve:  number;
  elevesArisqueCritique: number;
  entretiensThisMois:  number;
  recommandationsEnAttente: number;
  repartitionRisque: Record<string, number>;
}

// ── Filtres ──────────────────────────────────────────────────────────────────

export interface ListeFichesFilters {
  schoolId:       string;
  classId?:       string;
  riskLevel?:     string;
  status?:        string;
  academicYearId?: string;
  page?:          number;
  limit?:         number;
}

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IOrientationRepository {
  // Fiches
  findFicheByStudentAndYear(studentId: string, academicYearId: string): Promise<FicheOrientation | null>;
  findFicheById(ficheId: string, schoolId: string): Promise<FicheOrientation | null>;
  findFicheDetailById(ficheId: string, schoolId: string): Promise<FicheDetail | null>;
  findFiches(filters: ListeFichesFilters): Promise<{ fiches: FicheListItem[]; total: number }>;
  createFiche(data: {
    studentId: string; schoolId: string; academicYearId: string;
    conseillerId: string; mainConcern?: TypePreoccupation;
  }): Promise<FicheOrientation>;
  updateFicheRiskLevel(ficheId: string, riskLevel: NiveauRisque, mainConcern: TypePreoccupation): Promise<void>;

  // Entretiens
  createEntretien(ficheId: string, data: {
    date: Date; type: TypeEntretien; motif: MotifEntretien;
    notes?: string; recommendations?: string; nextActions?: string;
    parentNotified?: boolean; followUpDate?: Date;
    status?: StatutEntretien;
  }): Promise<EntretienDetail>;
  updateEntretien(entretienId: string, data: Partial<{
    notes: string; recommendations: string; nextActions: string;
    parentNotified: boolean; followUpDate: Date; status: StatutEntretien;
  }>): Promise<EntretienDetail>;

  // Tests
  createTest(ficheId: string, data: {
    type: TypeTest; datePassage: Date; resultats: string;
    interpretation?: string; scoreGlobal?: number;
  }): Promise<TestDetail>;

  // Recommandation série
  createOrUpdateRecommandation(ficheId: string, studentId: string, data: {
    serieActuelle: string; serieRecommandee: string; justification: string;
  }): Promise<RecommandationDetail>;
  validerRecommandation(recommandationId: string): Promise<RecommandationDetail>;

  // Suivis
  createSuivi(ficheId: string, data: {
    riskLevel: NiveauRisque; mainConcern: TypePreoccupation;
    interventions?: string; prochainRdv?: Date; notes?: string;
  }): Promise<SuiviDetail>;

  // Stats
  getStats(schoolId: string, academicYearId?: string): Promise<OrientationStats>;
}
