import type { PrismaClient } from '@prisma/client';
import type { IOrientationRepository, FicheListItem, FicheDetail, EntretienDetail, TestDetail, RecommandationDetail, SuiviDetail, OrientationStats, ListeFichesFilters } from '@domain/ports/repositories/IOrientationRepository';
import { FicheOrientation } from '@domain/entities/FicheOrientation';
import type { NiveauRisque, TypePreoccupation, TypeEntretien, MotifEntretien, StatutEntretien, TypeTest } from '@domain/entities/FicheOrientation';

export class PrismaOrientationRepository implements IOrientationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findFicheByStudentAndYear(studentId: string, academicYearId: string): Promise<FicheOrientation | null> {
    const data = await this.prisma.ficheOrientation.findFirst({
      where: { studentId, academicYearId },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findFicheById(ficheId: string, schoolId: string): Promise<FicheOrientation | null> {
    const data = await this.prisma.ficheOrientation.findFirst({
      where: { id: ficheId, schoolId },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findFicheDetailById(ficheId: string, schoolId: string): Promise<FicheDetail | null> {
    const data = await this.prisma.ficheOrientation.findFirst({
      where: { id: ficheId, schoolId },
      include: {
        student: {
          select: {
            id: true, firstName: true, lastName: true,
            studentProfile: { select: { class: { select: { name: true } } } },
          },
        },
        entretiens: { orderBy: { date: 'desc' } },
        tests: { orderBy: { datePassage: 'desc' } },
        recommandation: true,
        suivis: { orderBy: { date: 'desc' } },
      },
    });
    if (!data) return null;
    return {
      id: data.id,
      studentId: data.studentId,
      schoolId: data.schoolId,
      academicYearId: data.academicYearId,
      conseillerId: data.conseillerId,
      status: data.status,
      riskLevel: data.riskLevel,
      mainConcern: data.mainConcern,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      student: data.student as FicheDetail['student'],
      entretiens: data.entretiens as EntretienDetail[],
      tests: data.tests as TestDetail[],
      recommandation: data.recommandation as RecommandationDetail | null,
      suivis: data.suivis as SuiviDetail[],
    };
  }

  async findFiches(filters: ListeFichesFilters): Promise<{ fiches: FicheListItem[]; total: number }> {
    const { schoolId, classId, riskLevel, status, academicYearId, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      schoolId,
      ...(riskLevel ? { riskLevel } : {}),
      ...(status ? { status } : {}),
      ...(academicYearId ? { academicYearId } : {}),
      ...(classId ? { student: { studentProfile: { classId } } } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.ficheOrientation.count({ where }),
      this.prisma.ficheOrientation.findMany({
        where,
        include: {
          student: {
            select: {
              id: true, firstName: true, lastName: true,
              studentProfile: { select: { class: { select: { name: true } } } },
            },
          },
          _count: { select: { entretiens: true, tests: true, suivis: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { fiches: items as FicheListItem[], total };
  }

  async createFiche(data: {
    studentId: string; schoolId: string; academicYearId: string;
    conseillerId: string; mainConcern?: TypePreoccupation;
  }): Promise<FicheOrientation> {
    const created = await this.prisma.ficheOrientation.create({
      data: {
        studentId: data.studentId,
        schoolId: data.schoolId,
        academicYearId: data.academicYearId,
        conseillerId: data.conseillerId,
        mainConcern: data.mainConcern ?? null,
        status: 'OUVERTE',
        riskLevel: 'FAIBLE',
      },
    });
    return this.toDomain(created);
  }

  async updateFicheRiskLevel(ficheId: string, riskLevel: NiveauRisque, mainConcern: TypePreoccupation): Promise<void> {
    await this.prisma.ficheOrientation.update({
      where: { id: ficheId },
      data: { riskLevel, mainConcern },
    });
  }

  async createEntretien(ficheId: string, data: {
    date: Date; type: TypeEntretien; motif: MotifEntretien;
    notes?: string; recommendations?: string; nextActions?: string;
    parentNotified?: boolean; followUpDate?: Date; status?: StatutEntretien;
  }): Promise<EntretienDetail> {
    const created = await this.prisma.entretienOrientation.create({
      data: {
        ficheOrientationId: ficheId,
        date: data.date,
        type: data.type,
        motif: data.motif,
        notes: data.notes ?? null,
        recommendations: data.recommendations ?? null,
        nextActions: data.nextActions ?? null,
        parentNotified: data.parentNotified ?? false,
        followUpDate: data.followUpDate ?? null,
        status: data.status ?? 'PLANIFIE',
      },
    });
    return created as EntretienDetail;
  }

  async updateEntretien(entretienId: string, data: Partial<{
    notes: string; recommendations: string; nextActions: string;
    parentNotified: boolean; followUpDate: Date; status: StatutEntretien;
  }>): Promise<EntretienDetail> {
    const updated = await this.prisma.entretienOrientation.update({
      where: { id: entretienId },
      data: {
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.recommendations !== undefined ? { recommendations: data.recommendations } : {}),
        ...(data.nextActions !== undefined ? { nextActions: data.nextActions } : {}),
        ...(data.parentNotified !== undefined ? { parentNotified: data.parentNotified } : {}),
        ...(data.followUpDate !== undefined ? { followUpDate: data.followUpDate } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
    return updated as EntretienDetail;
  }

  async createTest(ficheId: string, data: {
    type: TypeTest; datePassage: Date; resultats: string;
    interpretation?: string; scoreGlobal?: number;
  }): Promise<TestDetail> {
    const created = await this.prisma.testAptitude.create({
      data: {
        ficheOrientationId: ficheId,
        type: data.type,
        datePassage: data.datePassage,
        resultats: data.resultats,
        interpretation: data.interpretation ?? null,
        scoreGlobal: data.scoreGlobal ?? null,
      },
    });
    return created as TestDetail;
  }

  async createOrUpdateRecommandation(ficheId: string, studentId: string, data: {
    serieActuelle: string; serieRecommandee: string; justification: string;
  }): Promise<RecommandationDetail> {
    const existing = await this.prisma.recommandationSerie.findUnique({
      where: { ficheOrientationId: ficheId },
    });

    if (existing) {
      const updated = await this.prisma.recommandationSerie.update({
        where: { ficheOrientationId: ficheId },
        data: {
          serieActuelle: data.serieActuelle,
          serieRecommandee: data.serieRecommandee,
          justification: data.justification,
        },
      });
      return updated as RecommandationDetail;
    }

    const created = await this.prisma.recommandationSerie.create({
      data: {
        ficheOrientationId: ficheId,
        studentId,
        serieActuelle: data.serieActuelle,
        serieRecommandee: data.serieRecommandee,
        justification: data.justification,
        status: 'PROPOSEE',
      },
    });
    return created as RecommandationDetail;
  }

  async validerRecommandation(recommandationId: string): Promise<RecommandationDetail> {
    const updated = await this.prisma.recommandationSerie.update({
      where: { id: recommandationId },
      data: { adminValidated: true, status: 'VALIDEE_ADMIN' },
    });
    return updated as RecommandationDetail;
  }

  async createSuivi(ficheId: string, data: {
    riskLevel: NiveauRisque; mainConcern: TypePreoccupation;
    interventions?: string; prochainRdv?: Date; notes?: string;
  }): Promise<SuiviDetail> {
    const created = await this.prisma.suiviOrientation.create({
      data: {
        ficheOrientationId: ficheId,
        riskLevel: data.riskLevel,
        mainConcern: data.mainConcern,
        interventions: data.interventions ?? null,
        prochainRdv: data.prochainRdv ?? null,
        notes: data.notes ?? null,
        date: new Date(),
      },
    });
    return created as SuiviDetail;
  }

  async getStats(schoolId: string, academicYearId?: string): Promise<OrientationStats> {
    const where: any = { schoolId, ...(academicYearId ? { academicYearId } : {}) };

    const now = new Date();
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      fichesOuvertes,
      elevesArisqueEleve,
      elevesArisqueCritique,
      entretiensThisMois,
      recommandationsEnAttente,
      repartition,
    ] = await Promise.all([
      this.prisma.ficheOrientation.count({ where: { ...where, status: { in: ['OUVERTE', 'EN_COURS'] } } }),
      this.prisma.ficheOrientation.count({ where: { ...where, riskLevel: 'ELEVE' } }),
      this.prisma.ficheOrientation.count({ where: { ...where, riskLevel: 'CRITIQUE' } }),
      this.prisma.entretienOrientation.count({
        where: {
          fiche: where,
          date: { gte: debutMois },
        },
      }),
      this.prisma.recommandationSerie.count({
        where: {
          fiche: where,
          status: 'PROPOSEE',
        },
      }),
      this.prisma.ficheOrientation.groupBy({
        by: ['riskLevel'],
        where,
        _count: true,
      }),
    ]);

    const repartitionRisque: Record<string, number> = {};
    for (const item of repartition) {
      repartitionRisque[item.riskLevel] = item._count;
    }

    return {
      fichesOuvertes,
      elevesArisqueEleve,
      elevesArisqueCritique,
      entretiensThisMois,
      recommandationsEnAttente,
      repartitionRisque,
    };
  }

  private toDomain(data: any): FicheOrientation {
    return new FicheOrientation({
      id: data.id,
      studentId: data.studentId,
      schoolId: data.schoolId,
      academicYearId: data.academicYearId,
      conseillerId: data.conseillerId,
      status: data.status,
      riskLevel: data.riskLevel,
      mainConcern: data.mainConcern ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
