import type { Request, Response, NextFunction } from 'express';
import type { CreerFicheOrientationUseCase } from '@application/orientation/CreerFicheOrientationUseCase';
import type { AjouterEntretienUseCase } from '@application/orientation/AjouterEntretienUseCase';
import type { AjouterTestAptitudeUseCase } from '@application/orientation/AjouterTestAptitudeUseCase';
import type { CreerRecommandationSerieUseCase } from '@application/orientation/CreerRecommandationSerieUseCase';
import type { AjouterSuiviUseCase } from '@application/orientation/AjouterSuiviUseCase';
import type { ListerFichesOrientationUseCase } from '@application/orientation/ListerFichesOrientationUseCase';
import type { GetStatsOrientationUseCase } from '@application/orientation/GetStatsOrientationUseCase';
import type { IOrientationRepository } from '@domain/ports/repositories/IOrientationRepository';

export class OrientationController {
  constructor(
    private readonly creerFiche: CreerFicheOrientationUseCase,
    private readonly ajouterEntretien: AjouterEntretienUseCase,
    private readonly ajouterTest: AjouterTestAptitudeUseCase,
    private readonly creerRecommandation: CreerRecommandationSerieUseCase,
    private readonly ajouterSuivi: AjouterSuiviUseCase,
    private readonly listerFiches: ListerFichesOrientationUseCase,
    private readonly getStats: GetStatsOrientationUseCase,
    private readonly repo: IOrientationRepository,
  ) {}

  private checkPermission(user: any, res: Response): boolean {
    if (user.role === 'ADMIN') return true;
    const perms: string[] = user.permissions ?? [];
    if (!perms.includes('MANAGE_ORIENTATION')) {
      res.status(403).json({ success: false, message: 'Permission MANAGE_ORIENTATION requise' });
      return false;
    }
    return true;
  }

  // GET /api/v2/orientation/stats
  obtenirStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!this.checkPermission(user, res)) return;
      const { academicYearId } = req.query as Record<string, string>;
      const stats = await this.getStats.execute({ schoolId: user.schoolId, academicYearId });
      res.json({ success: true, data: stats });
    } catch (err) { next(err); }
  };

  // GET /api/v2/orientation/fiches
  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!this.checkPermission(user, res)) return;
      const { classId, riskLevel, status, academicYearId, page, limit } = req.query as Record<string, string>;
      const resultat = await this.listerFiches.execute({
        schoolId: user.schoolId,
        classId,
        riskLevel,
        status,
        academicYearId,
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
      });
      res.json({ success: true, ...resultat });
    } catch (err) { next(err); }
  };

  // POST /api/v2/orientation/fiches
  creer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!this.checkPermission(user, res)) return;
      const { studentId, mainConcern, academicYearId } = req.body as {
        studentId: string; mainConcern?: string; academicYearId: string;
      };
      if (!studentId || !academicYearId) {
        res.status(400).json({ success: false, message: 'studentId et academicYearId requis' });
        return;
      }
      const fiche = await this.creerFiche.execute({
        studentId,
        schoolId: user.schoolId,
        academicYearId,
        conseillerId: user.userId,
        mainConcern: mainConcern as any,
      });
      res.status(201).json({ success: true, data: fiche });
    } catch (err) {
      if (err instanceof Error && err.message.includes('existe déjà')) {
        res.status(409).json({ success: false, message: err.message });
        return;
      }
      next(err);
    }
  };

  // GET /api/v2/orientation/fiches/:id
  detail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!this.checkPermission(user, res)) return;
      const fiche = await this.repo.findFicheDetailById(req.params.id as string, user.schoolId);
      if (!fiche) {
        res.status(404).json({ success: false, message: 'Fiche d\'orientation introuvable' });
        return;
      }
      res.json({ success: true, data: fiche });
    } catch (err) { next(err); }
  };

  // POST /api/v2/orientation/fiches/:id/entretiens
  ajouterEntretienHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!this.checkPermission(user, res)) return;
      const { date, type, motif, notes, recommendations, nextActions, parentNotified, followUpDate, status } = req.body;
      if (!date || !type || !motif) {
        res.status(400).json({ success: false, message: 'date, type et motif requis' });
        return;
      }
      const entretien = await this.ajouterEntretien.execute({
        ficheId: req.params.id as string,
        schoolId: user.schoolId,
        date: new Date(date),
        type,
        motif,
        notes,
        recommendations,
        nextActions,
        parentNotified: parentNotified === true || parentNotified === 'true',
        followUpDate: followUpDate ? new Date(followUpDate) : undefined,
        status,
      });
      res.status(201).json({ success: true, data: entretien });
    } catch (err) {
      if (err instanceof Error && err.message.includes('clôturée')) {
        res.status(422).json({ success: false, message: err.message });
        return;
      }
      if (err instanceof Error && err.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: err.message });
        return;
      }
      next(err);
    }
  };

  // PATCH /api/v2/orientation/entretiens/:id
  modifierEntretien = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!this.checkPermission(user, res)) return;
      const { notes, recommendations, nextActions, parentNotified, followUpDate, status } = req.body;
      const updated = await this.repo.updateEntretien(req.params.id as string, {
        notes,
        recommendations,
        nextActions,
        ...(parentNotified !== undefined ? { parentNotified: parentNotified === true || parentNotified === 'true' } : {}),
        ...(followUpDate ? { followUpDate: new Date(followUpDate) } : {}),
        status,
      });
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  };

  // POST /api/v2/orientation/fiches/:id/tests
  ajouterTestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!this.checkPermission(user, res)) return;
      const { type, datePassage, resultats, interpretation, scoreGlobal } = req.body;
      if (!type || !datePassage || !resultats) {
        res.status(400).json({ success: false, message: 'type, datePassage et resultats requis' });
        return;
      }
      const test = await this.ajouterTest.execute({
        ficheId: req.params.id as string,
        schoolId: user.schoolId,
        type,
        datePassage: new Date(datePassage),
        resultats,
        interpretation,
        scoreGlobal: scoreGlobal != null ? parseInt(scoreGlobal) : undefined,
      });
      res.status(201).json({ success: true, data: test });
    } catch (err) {
      if (err instanceof Error && err.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: err.message });
        return;
      }
      next(err);
    }
  };

  // POST /api/v2/orientation/fiches/:id/recommandation-serie
  creerRecommandationHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!this.checkPermission(user, res)) return;
      const { serieActuelle, serieRecommandee, justification } = req.body;
      if (!serieActuelle || !serieRecommandee || !justification) {
        res.status(400).json({ success: false, message: 'serieActuelle, serieRecommandee et justification requis' });
        return;
      }
      const reco = await this.creerRecommandation.execute({
        ficheId: req.params.id as string,
        schoolId: user.schoolId,
        serieActuelle,
        serieRecommandee,
        justification,
      });
      res.status(201).json({ success: true, data: reco });
    } catch (err) {
      if (err instanceof Error && err.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: err.message });
        return;
      }
      if (err instanceof Error && err.message.includes('clôturée')) {
        res.status(422).json({ success: false, message: err.message });
        return;
      }
      next(err);
    }
  };

  // PATCH /api/v2/orientation/recommandations/:id/valider
  validerRecommandation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        res.status(403).json({ success: false, message: 'Seul un ADMIN peut valider une recommandation de série' });
        return;
      }
      const updated = await this.repo.validerRecommandation(req.params.id as string);
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  };

  // POST /api/v2/orientation/fiches/:id/suivis
  ajouterSuiviHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!this.checkPermission(user, res)) return;
      const { riskLevel, mainConcern, interventions, prochainRdv, notes } = req.body;
      if (!riskLevel || !mainConcern) {
        res.status(400).json({ success: false, message: 'riskLevel et mainConcern requis' });
        return;
      }
      const suivi = await this.ajouterSuivi.execute({
        ficheId: req.params.id as string,
        schoolId: user.schoolId,
        riskLevel,
        mainConcern,
        interventions,
        prochainRdv: prochainRdv ? new Date(prochainRdv) : undefined,
        notes,
      });
      res.status(201).json({ success: true, data: suivi });
    } catch (err) {
      if (err instanceof Error && err.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: err.message });
        return;
      }
      if (err instanceof Error && err.message.includes('clôturée')) {
        res.status(422).json({ success: false, message: err.message });
        return;
      }
      next(err);
    }
  };
}
