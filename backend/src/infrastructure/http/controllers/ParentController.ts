import type { Request, Response, NextFunction } from 'express';
import type { ObtenirEnfantsUseCase } from '@application/parent/ObtenirEnfantsUseCase';
import type { VerifierAccesEnfantUseCase } from '@application/parent/VerifierAccesEnfantUseCase';

export class ParentController {
  constructor(
    private readonly obtenirEnfants: ObtenirEnfantsUseCase,
    private readonly verifierAcces: VerifierAccesEnfantUseCase,
  ) {}

  // GET /api/v2/parent/children
  getEnfants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const enfants = await this.obtenirEnfants.execute({
        parentUserId: user.userId,
        schoolId: user.schoolId,
      });
      res.json({ success: true, data: enfants });
    } catch (error) {
      next(error);
    }
  };

  // Middleware : vérifie l'accès avant les routes enfant
  verifierAccesEnfant = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const studentId = req.params.studentId as string;
      await this.verifierAcces.execute(user.userId, studentId);
      next();
    } catch {
      res.status(403).json({
        success: false,
        message: 'Accès non autorisé : cet élève ne fait pas partie de vos enfants',
      });
    }
  };
}
