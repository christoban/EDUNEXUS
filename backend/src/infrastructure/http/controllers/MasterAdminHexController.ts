import type { Request, Response, NextFunction } from 'express';
import type { InviterEcoleUseCase } from '@application/masterAdmin/InviterEcoleUseCase';
import type { SuspendreEcoleUseCase } from '@application/masterAdmin/SuspendreEcoleUseCase';
import type { ReactiverEcoleUseCase } from '@application/masterAdmin/ReactiverEcoleUseCase';
import type { RejeterEcoleUseCase } from '@application/masterAdmin/RejeterEcoleUseCase';
import type { ChangerPlanAbonnementUseCase } from '@application/masterAdmin/ChangerPlanAbonnementUseCase';
import type { PlanType } from '@domain/types/enums';

export class MasterAdminHexController {
  constructor(
    private readonly inviter: InviterEcoleUseCase,
    private readonly suspendre: SuspendreEcoleUseCase,
    private readonly reactiver: ReactiverEcoleUseCase,
    private readonly rejeter: RejeterEcoleUseCase,
    private readonly changerPlan: ChangerPlanAbonnementUseCase,
  ) {}

  // POST /api/v2/master/schools/invite
  inviterEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = (req as any).masterUser;
      const { email, schoolName, plan, notes } = req.body;

      if (!email || !schoolName) {
        res.status(400).json({ success: false, message: 'email et schoolName requis' });
        return;
      }

      const resultat = await this.inviter.execute({
        email,
        schoolName,
        plan: (plan ?? 'DISCOVERY') as PlanType,
        masterAdminId: master.id,
        notes,
      });

      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/suspend
  suspendreEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.suspendre.execute(req.params.id as string);
      res.json({ success: true, message: 'École suspendue' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/reactivate
  reactiverEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.reactiver.execute(req.params.id as string);
      res.json({ success: true, message: 'École réactivée' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/reject
  rejeterEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { motif } = req.body;
      if (!motif) {
        res.status(400).json({ success: false, message: 'Le motif est obligatoire' });
        return;
      }
      await this.rejeter.execute({ schoolId: req.params.id as string, motif });
      res.json({ success: true, message: 'École rejetée' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // PATCH /api/v2/master/schools/:id/plan
  changerPlanEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { plan } = req.body;
      if (!plan) {
        res.status(400).json({ success: false, message: 'plan requis (DISCOVERY/STANDARD/PREMIUM)' });
        return;
      }
      await this.changerPlan.execute({
        schoolId: req.params.id as string,
        nouveauPlan: plan as PlanType,
      });
      res.json({ success: true, message: `Plan changé vers ${plan}` });
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
      if (error.message.includes('Impossible')) {
        res.status(422).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
