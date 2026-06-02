import type { Request, Response, NextFunction } from 'express';
import type { CreerAnneeAcademiqueUseCase } from '@application/academicYear/CreerAnneeAcademiqueUseCase';
import type { DefinirPeriodeCouranteUseCase } from '@application/academicYear/DefinirPeriodeCouranteUseCase';
import type { VerifierPrerequisClotureUseCase } from '@application/academicYear/VerifierPrerequisClotureUseCase';
import type { CloturerAnneeUseCase } from '@application/academicYear/CloturerAnneeUseCase';
import type { MettreAJourCalendrierUseCase } from '@application/academicYear/MettreAJourCalendrierUseCase';

export class AcademicYearController {
  constructor(
    private readonly creer: CreerAnneeAcademiqueUseCase,
    private readonly definirPeriode: DefinirPeriodeCouranteUseCase,
    private readonly verifierPrerequis: VerifierPrerequisClotureUseCase,
    private readonly cloturer: CloturerAnneeUseCase,
    private readonly mettreAJourCalendrier: MettreAJourCalendrierUseCase,
  ) {}

  creerAnnee = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { name, startDate, endDate, isCurrent, creerPeriodesAutomatiquement } = req.body;

      if (!name || !startDate || !endDate) {
        res.status(400).json({ success: false, message: 'name, startDate et endDate requis' });
        return;
      }

      const resultat = await this.creer.execute({
        schoolId: user.schoolId,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isCurrent,
        creerPeriodesAutomatiquement,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  definirPeriodeCourante = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.definirPeriode.definirPeriode(req.params['id'] as string);
      res.json({ success: true, message: 'Période courante définie' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  definirSequenceCourante = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.definirPeriode.definirSequence(req.params['id'] as string);
      res.json({ success: true, message: 'Séquence courante définie' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  verifierAvantCloture = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resultat = await this.verifierPrerequis.execute(req.params['id'] as string);
      res.json({ success: true, data: resultat });
    } catch (error) {
      next(error);
    }
  };

  cloturerAnnee = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { force } = req.body;

      const resultat = await this.cloturer.execute({
        academicYearId: req.params['id'] as string,
        schoolId: user.schoolId,
        demandeurId: user.userId,
        force: force === true,
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  mettreAJourCalendrierScolaire = async (
    req: Request, res: Response, next: NextFunction
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const { periodes } = req.body;

      if (!Array.isArray(periodes)) {
        res.status(400).json({ success: false, message: 'periodes[] requis' });
        return;
      }

      await this.mettreAJourCalendrier.execute({
        academicYearId: req.params['id'] as string,
        schoolId: user.schoolId,
        periodes,
      });
      res.json({ success: true, message: 'Calendrier mis à jour' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof Error) {
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('impossible') || error.message.includes('Clôture')) {
        res.status(422).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('existe déjà')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('Accès refusé') || error.message.includes('archivée')) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
