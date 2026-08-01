import type { Request, Response, NextFunction } from 'express';
import type { CreerFicheOrientationUseCase } from '@application/orientation/CreerFicheOrientationUseCase';
import type { AjouterEntretienUseCase } from '@application/orientation/AjouterEntretienUseCase';
import type { AjouterTestAptitudeUseCase } from '@application/orientation/AjouterTestAptitudeUseCase';
import type { CreerRecommandationSerieUseCase } from '@application/orientation/CreerRecommandationSerieUseCase';
import type { AjouterSuiviUseCase } from '@application/orientation/AjouterSuiviUseCase';
import type { ListerFichesOrientationUseCase } from '@application/orientation/ListerFichesOrientationUseCase';
import type { GetStatsOrientationUseCase } from '@application/orientation/GetStatsOrientationUseCase';
import type { SaisirAspirationsEleveUseCase } from '@application/orientation/SaisirAspirationsEleveUseCase';
import type { GenererRecommandationOrientationUseCase } from '@application/orientation/GenererRecommandationOrientationUseCase';
import type { ValiderRecommandationConseillerUseCase } from '@application/orientation/ValiderRecommandationConseillerUseCase';
import type { ProposerRecommandationEleveUseCase } from '@application/orientation/ProposerRecommandationEleveUseCase';
import type { ChoisirPisteEleveUseCase } from '@application/orientation/ChoisirPisteEleveUseCase';
import type { ListerElevesAOrienterUseCase } from '@application/orientation/ListerElevesAOrienterUseCase';
import type { ConfigurerCheckpointOrientationUseCase } from '@application/orientation/ConfigurerCheckpointOrientationUseCase';
import type { IOrientationRepository } from '@domain/ports/repositories/IOrientationRepository';
import type { PrismaClient } from '@prisma/client';
import { journaliserActionIA } from '@infrastructure/services/AIActionAuditLogger';

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
    private readonly saisirAspiration: SaisirAspirationsEleveUseCase,
    private readonly genererRecommandation: GenererRecommandationOrientationUseCase,
    private readonly validerRecommandationConseiller: ValiderRecommandationConseillerUseCase,
    private readonly proposerRecommandationEleve: ProposerRecommandationEleveUseCase,
    private readonly choisirPisteEleve: ChoisirPisteEleveUseCase,
    private readonly listerElevesAOrienter: ListerElevesAOrienterUseCase,
    private readonly configurerCheckpoint: ConfigurerCheckpointOrientationUseCase,
    private readonly prisma: PrismaClient,
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
      journaliserActionIA(this.prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'ajouter_suivi_orientation', targetType: 'OrientationFiche', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { ficheId: req.params.id, riskLevel, mainConcern },
      });
      res.status(201).json({ success: true, data: suivi });
    } catch (err) {
      const user = (req as any).user;
      journaliserActionIA(this.prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'ajouter_suivi_orientation', targetType: 'OrientationFiche', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: req.body,
      });
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

  // ── Moteur de checkpoints (A.5 du plan) ──────────────────────────────────────────

  private async anneeCouranteId(schoolId: string): Promise<string | null> {
    const annee = await this.prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true } });
    return annee?.id ?? null;
  }

  // POST /api/v2/orientation/aspirations — élève
  saisirAspirationHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (user.role !== 'STUDENT') {
        res.status(403).json({ success: false, message: 'Réservé aux élèves' });
        return;
      }
      const { checkpointType, desiredTrack, careerInterest } = req.body;
      if (!checkpointType) {
        res.status(400).json({ success: false, message: 'checkpointType requis' });
        return;
      }
      const aspiration = await this.saisirAspiration.execute({
        studentId: user.userId, schoolId: user.schoolId, checkpointType, desiredTrack, careerInterest,
      });
      res.status(201).json({ success: true, data: aspiration });
    } catch (err) { next(err); }
  };

  // GET /api/v2/orientation/aspirations/:checkpointType — élève consulte la sienne
  obtenirAspiration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (user.role !== 'STUDENT') {
        res.status(403).json({ success: false, message: 'Réservé aux élèves' });
        return;
      }
      const aspiration = await this.repo.findAspiration(user.userId, req.params.checkpointType as any);
      res.json({ success: true, data: aspiration });
    } catch (err) { next(err); }
  };

  // POST /api/v2/orientation/checkpoints/:type/generer — conseiller déclenche manuellement
  genererRecommandationHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!this.checkPermission(user, res)) return;
      const { studentId } = req.body;
      if (!studentId) {
        res.status(400).json({ success: false, message: 'studentId requis' });
        return;
      }
      const academicYearId = await this.anneeCouranteId(user.schoolId);
      if (!academicYearId) {
        res.status(400).json({ success: false, message: 'Aucune année académique courante' });
        return;
      }
      const reco = await this.genererRecommandation.execute({
        schoolId: user.schoolId, studentId, checkpointType: req.params.type as any,
        academicYearId, conseillerId: user.userId,
      });
      res.status(201).json({ success: true, data: reco });
    } catch (err) { next(err); }
  };

  // PATCH /api/v2/orientation/recommandations/:id/valider-conseiller
  validerRecommandationConseillerHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!this.checkPermission(user, res)) return;
      const { serieRecommandee } = req.body;
      if (!serieRecommandee) {
        res.status(400).json({ success: false, message: 'serieRecommandee requis' });
        return;
      }
      const reco = await this.validerRecommandationConseiller.execute({
        recommandationId: req.params.id as string, schoolId: user.schoolId, serieRecommandee,
      });
      res.json({ success: true, data: reco });
    } catch (err) {
      if (err instanceof Error) { res.status(422).json({ success: false, message: err.message }); return; }
      next(err);
    }
  };

  // PATCH /api/v2/orientation/recommandations/:id/proposer-eleve
  proposerRecommandationEleveHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!this.checkPermission(user, res)) return;
      const reco = await this.proposerRecommandationEleve.execute({
        recommandationId: req.params.id as string, schoolId: user.schoolId,
      });
      res.json({ success: true, data: reco });
    } catch (err) {
      if (err instanceof Error) { res.status(422).json({ success: false, message: err.message }); return; }
      next(err);
    }
  };

  // PATCH /api/v2/orientation/recommandations/:id/choisir-piste — élève
  choisirPisteEleveHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (user.role !== 'STUDENT') {
        res.status(403).json({ success: false, message: 'Réservé aux élèves' });
        return;
      }
      const { track } = req.body;
      if (!track) {
        res.status(400).json({ success: false, message: 'track requis' });
        return;
      }
      const reco = await this.choisirPisteEleve.execute({
        recommandationId: req.params.id as string, schoolId: user.schoolId, studentId: user.userId, track,
      });
      res.json({ success: true, data: reco });
    } catch (err) {
      if (err instanceof Error) { res.status(422).json({ success: false, message: err.message }); return; }
      next(err);
    }
  };

  // GET /api/v2/orientation/ma-recommandation/:checkpointType — élève consulte SA proposition en cours
  maRecommandation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (user.role !== 'STUDENT' && user.role !== 'PARENT') {
        res.status(403).json({ success: false, message: 'Réservé aux élèves et parents' });
        return;
      }
      const studentId = user.role === 'STUDENT' ? user.userId : (req.query.studentId as string);
      if (user.role === 'PARENT') {
        if (!studentId) { res.status(400).json({ success: false, message: 'studentId requis' }); return; }
        const lien = await this.prisma.parentStudent.findFirst({
          where: { parentProfile: { userId: user.userId }, studentProfile: { userId: studentId } },
          select: { parentProfileId: true },
        });
        if (!lien) { res.status(403).json({ success: false, message: 'Cet élève n\'est pas rattaché à votre compte' }); return; }
      }

      const academicYearId = await this.anneeCouranteId(user.schoolId);
      if (!academicYearId) { res.json({ success: true, data: null }); return; }

      const fiche = await this.repo.findFicheByStudentAndYear(studentId, academicYearId);
      if (!fiche) { res.json({ success: true, data: null }); return; }

      const detail = await this.repo.findFicheDetailById(fiche.id, user.schoolId);
      const reco = detail?.recommandation ?? null;
      // L'élève/parent ne voit jamais le reste de la fiche (entretiens, suivis...) — uniquement
      // la recommandation, quand elle concerne bien le checkpoint demandé.
      const checkpointType = req.params.checkpointType;
      res.json({ success: true, data: reco && (!checkpointType || reco.checkpointType === checkpointType) ? reco : null });
    } catch (err) { next(err); }
  };

  // GET /api/v2/orientation/eleves-a-orienter — filet de sécurité conseiller
  elevesAOrienterHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!this.checkPermission(user, res)) return;
      const { checkpointType } = req.query as Record<string, string>;
      if (!checkpointType) {
        res.status(400).json({ success: false, message: 'checkpointType requis' });
        return;
      }
      const academicYearId = await this.anneeCouranteId(user.schoolId);
      if (!academicYearId) { res.json({ success: true, data: [] }); return; }
      const eleves = await this.listerElevesAOrienter.execute({
        schoolId: user.schoolId, checkpointType: checkpointType as any, academicYearId,
      });
      res.json({ success: true, data: eleves });
    } catch (err) { next(err); }
  };

  // GET /api/v2/orientation/checkpoints/:type/config
  obtenirConfigCheckpoint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!this.checkPermission(user, res)) return;
      const config = await this.repo.findCheckpointConfig(user.schoolId, req.params.type as any);
      res.json({ success: true, data: config });
    } catch (err) { next(err); }
  };

  // PUT /api/v2/orientation/checkpoints/:type/config — ADMIN uniquement
  configurerCheckpointHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        res.status(403).json({ success: false, message: 'Seul un ADMIN peut configurer les checkpoints d\'orientation' });
        return;
      }
      const { possibleTracks, relevantSubjects, psychotechnicalTestRequired, windowStartMonth, windowStartDay, windowEndMonth, windowEndDay, responseDeadlineDays } = req.body;
      const config = await this.configurerCheckpoint.execute({
        schoolId: user.schoolId, type: req.params.type as any,
        possibleTracks, relevantSubjects,
        psychotechnicalTestRequired: psychotechnicalTestRequired === true || psychotechnicalTestRequired === 'true',
        windowStartMonth, windowStartDay, windowEndMonth, windowEndDay, responseDeadlineDays,
      });
      res.json({ success: true, data: config });
    } catch (err) { next(err); }
  };
}
