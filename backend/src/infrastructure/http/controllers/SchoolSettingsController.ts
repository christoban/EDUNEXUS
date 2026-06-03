import type { Request, Response, NextFunction } from 'express';
import type { ObtenirParametresEcoleUseCase } from '@application/schoolSettings/ObtenirParametresEcoleUseCase';
import type { MettreAJourParametresEcoleUseCase } from '@application/schoolSettings/MettreAJourParametresEcoleUseCase';

export class SchoolSettingsController {
  constructor(
    private readonly obtenir: ObtenirParametresEcoleUseCase,
    private readonly mettreAJour: MettreAJourParametresEcoleUseCase,
  ) {}

  // GET /api/v2/school-settings
  getSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const settings = await this.obtenir.execute(user.schoolId);
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/v2/school-settings
  updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      await this.mettreAJour.execute({
        schoolId: user.schoolId,
        demandeurRole: user.role,
        ...req.body,
      });
      res.json({ success: true, message: 'Paramètres mis à jour' });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Admin')) {
          res.status(403).json({ success: false, message: error.message });
          return;
        }
        if (
          error.message.includes('invalide') ||
          error.message.includes('entre 0') ||
          error.message.includes('vide') ||
          error.message.includes('uniquement')
        ) {
          res.status(400).json({ success: false, message: error.message });
          return;
        }
      }
      next(error);
    }
  };
}
