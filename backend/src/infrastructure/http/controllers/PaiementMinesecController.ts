import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { GenererPaiementsMinesecUseCase } from '@application/paiementMinesec/GenererPaiementsMinesecUseCase';
import { GenererPaiementsMinesecPourEcoleUseCase } from '@application/paiementMinesec/GenererPaiementsMinesecPourEcoleUseCase';
import { GetStudentPaymentDashboardUseCase } from '@application/paiementMinesec/GetStudentPaymentDashboardUseCase';
import { GetSchoolPaymentOverviewUseCase } from '@application/paiementMinesec/GetSchoolPaymentOverviewUseCase';

export class PaiementMinesecController {
  constructor(
    private readonly _genererPaiements: GenererPaiementsMinesecUseCase,
    private readonly _genererPaiementsEcole: GenererPaiementsMinesecPourEcoleUseCase,
    private readonly _getDashboard: GetStudentPaymentDashboardUseCase,
    private readonly _getOverview: GetSchoolPaymentOverviewUseCase,
    private readonly prisma: PrismaClient,
  ) {}

  // POST /api/v2/paiements-minesec/generate/:studentProfileId
  generer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const studentProfileId = String(req.params['studentProfileId']);
      const { anneeScolaire } = req.body as { anneeScolaire: string };
      if (!anneeScolaire) {
        res.status(400).json({ success: false, message: 'anneeScolaire requis' });
        return;
      }
      const result = await this._genererPaiements.execute({ schoolId, studentProfileId, anneeScolaire });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // POST /api/v2/paiements-minesec/generate-school — génère pour tous les élèves actifs de l'école
  genererEcole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const { anneeScolaire } = req.body as { anneeScolaire: string };
      if (!anneeScolaire) {
        res.status(400).json({ success: false, message: 'anneeScolaire requis' });
        return;
      }
      const result = await this._genererPaiementsEcole.execute({ schoolId, anneeScolaire });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // GET /api/v2/paiements-minesec/:studentId/:anneeScolaire
  lister = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const studentId = String(req.params['studentId']);
      const anneeScolaire = String(req.params['anneeScolaire']);

      // Vérifier que l'élève appartient à l'école
      const profile = await this.prisma.studentProfile.findFirst({
        where: { id: studentId, user: { schoolId } },
      });
      if (!profile) {
        res.status(404).json({ success: false, message: 'Élève introuvable' });
        return;
      }

      const paiements = await this.prisma.paiementMinesec.findMany({
        where: { studentId, anneeScolaire },
        orderBy: { typeFrais: 'asc' },
      });

      res.json({ success: true, data: paiements });
    } catch (err) { next(err); }
  };

  // GET /api/v2/dashboard/student-payments/:studentId
  dashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const studentUserId = String(req.params['studentId']);
      const result = await this._getDashboard.execute(schoolId, studentUserId);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // GET /api/v2/dashboard/school-payments/:schoolId
  dashboardEcole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const { anneeScolaire } = req.query as { anneeScolaire?: string };
      if (!anneeScolaire) {
        res.status(400).json({ success: false, message: 'anneeScolaire requis' });
        return;
      }
      const result = await this._getOverview.execute(schoolId, anneeScolaire);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // GET /api/v2/dashboard/payment-alerts — élèves avec un paiement MINESEC ou établissement en retard
  paymentAlerts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const now = new Date();

      const impayesMinesec = await this.prisma.paiementMinesec.findMany({
        where: { schoolId, status: 'IMPAYE', dateEcheance: { lt: now } },
        include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: { dateEcheance: 'asc' },
      });

      const impayesEtab = await this.prisma.paiementEtablissement.findMany({
        where: { schoolId, status: 'IMPAYE' },
        include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
      });

      res.json({
        success: true,
        data: {
          minesec: impayesMinesec.map((p: any) => ({
            id: p.id, studentId: p.studentId,
            studentName: p.student?.user ? `${p.student.user.firstName} ${p.student.user.lastName}` : '',
            typeFrais: p.typeFrais, montantAttendu: p.montantAttendu, dateEcheance: p.dateEcheance,
          })),
          etablissement: impayesEtab.map((p: any) => ({
            id: p.id, studentId: p.studentId,
            studentName: p.student?.user ? `${p.student.user.firstName} ${p.student.user.lastName}` : '',
            typeFrais: p.typeFrais, montantAttendu: p.montantAttendu, montantPaye: p.montantPaye,
          })),
        },
      });
    } catch (err) { next(err); }
  };
}
