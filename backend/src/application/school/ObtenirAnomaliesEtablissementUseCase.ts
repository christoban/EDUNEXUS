/**
 * APPLICATION LAYER — Use Case : Obtenir les anomalies d'établissement pour l'ADMIN
 *
 * Assistant proactif (Section 6.3 du plan Copilot Unifié) — bannière affichée à la
 * connexion, indépendante du copilot conversationnel. Réutilise exactement la même
 * logique que les actions copilot `classes_sans_edt_publie` et `classes_sans_conseil_tenu`
 * (adminActionCatalog.ts) plutôt que d'inventer un nouveau calcul.
 */
import type { PrismaClient } from '@prisma/client';
import { resolveCurrentAcademicYear, resolveCurrentPeriod, type ActionContext } from '@application/assistant/catalogShared';

export interface AnomaliesEtablissement {
  classesSansEdtPublie: string[];
  classesSansConseilTenu: string[];
}

export class ObtenirAnomaliesEtablissementUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(params: { schoolId: string; userId: string }): Promise<AnomaliesEtablissement> {
    const ctx: ActionContext = { schoolId: params.schoolId, userId: params.userId, role: 'ADMIN', prisma: this.prisma };
    const classes = await this.prisma.class.findMany({ where: { schoolId: ctx.schoolId }, select: { id: true, name: true } });

    const [classesSansEdtPublie, classesSansConseilTenu] = await Promise.all([
      this.sansEdtPublie(ctx, classes),
      this.sansConseilTenu(ctx, classes),
    ]);

    return { classesSansEdtPublie, classesSansConseilTenu };
  }

  private async sansEdtPublie(ctx: ActionContext, classes: { id: string; name: string }[]): Promise<string[]> {
    const year = await resolveCurrentAcademicYear(ctx).catch(() => null);
    if (!year) return [];
    const timetables = await this.prisma.timetable.findMany({
      where: { schoolId: ctx.schoolId, academicYearId: year.id, status: 'PUBLISHED' },
      select: { classId: true },
    });
    const publishedIds = new Set(timetables.map((t) => t.classId));
    return classes.filter((c) => !publishedIds.has(c.id)).map((c) => c.name);
  }

  private async sansConseilTenu(ctx: ActionContext, classes: { id: string; name: string }[]): Promise<string[]> {
    const period = await resolveCurrentPeriod(ctx).catch(() => null);
    if (!period) return [];
    const sessions = await this.prisma.classCouncilSession.findMany({
      where: { schoolId: ctx.schoolId, academicPeriodId: period.id, status: 'LOCKED' },
      select: { classId: true },
    });
    const lockedIds = new Set(sessions.map((s: any) => s.classId));
    return classes.filter((c) => !lockedIds.has(c.id)).map((c) => c.name);
  }
}
