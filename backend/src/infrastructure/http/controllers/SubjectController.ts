import type { Request, Response, NextFunction } from 'express';
import type { CreerMatiereUseCase } from '@application/subject/CreerMatiereUseCase';
import type { ModifierMatiereUseCase } from '@application/subject/ModifierMatiereUseCase';
import type { AssignerEnseignantMatiereUseCase } from '@application/subject/AssignerEnseignantMatiereUseCase';
import type { DefinirCoefficientUseCase } from '@application/subject/DefinirCoefficientUseCase';
import type { SupprimerMatiereUseCase } from '@application/subject/SupprimerMatiereUseCase';

export class SubjectController {
  constructor(
    private readonly creer: CreerMatiereUseCase,
    private readonly modifier: ModifierMatiereUseCase,
    private readonly assignerEnseignant: AssignerEnseignantMatiereUseCase,
    private readonly definirCoefficient: DefinirCoefficientUseCase,
    private readonly supprimer: SupprimerMatiereUseCase,
  ) {}

  creerMatiere = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const resultat = await this.creer.execute({
        schoolId: user.schoolId,
        demandeurRole: user.role,
        ...req.body,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  modifierMatiere = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      await this.modifier.execute({
        matiereId: req.params.id as string,
        schoolId: user.schoolId,
        demandeurRole: user.role,
        ...req.body,
      });
      res.json({ success: true, message: 'Matière mise à jour' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  assignerOuRetirer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { subjectId, action } = req.body;

      if (!subjectId || !action) {
        res.status(400).json({ success: false, message: 'subjectId et action requis' });
        return;
      }

      await this.assignerEnseignant.execute({
        teacherUserId: req.params.teacherId as string,
        matiereId: subjectId,
        schoolId: user.schoolId,
        demandeurRole: user.role,
        action,
      });

      res.json({
        success: true,
        message: `Enseignant ${action === 'ASSIGNER' ? 'assigné' : 'retiré'}`,
      });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  definirCoefficients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { coefficients } = req.body;

      if (!Array.isArray(coefficients) || coefficients.length === 0) {
        res.status(400).json({ success: false, message: 'coefficients[] requis' });
        return;
      }

      const resultat = await this.definirCoefficient.execute({
        schoolId: user.schoolId,
        subjectId: req.params.id as string,
        demandeurRole: user.role,
        coefficients,
      });

      res.json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  supprimerMatiere = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      await this.supprimer.execute({
        matiereId: req.params.id as string,
        schoolId: user.schoolId,
        demandeurRole: user.role,
      });
      res.json({ success: true, message: 'Matière supprimée' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof Error) {
      if (error.message.includes('existe déjà') || error.message.includes('déjà assigné')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (
        error.message.includes('Seul') ||
        error.message.includes('refusé') ||
        error.message.includes('Permission')
      ) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
