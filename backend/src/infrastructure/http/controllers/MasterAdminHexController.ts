import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { InviterEcoleUseCase } from '@application/masterAdmin/InviterEcoleUseCase';
import type { SuspendreEcoleUseCase } from '@application/masterAdmin/SuspendreEcoleUseCase';
import type { ReactiverEcoleUseCase } from '@application/masterAdmin/ReactiverEcoleUseCase';
import type { RejeterEcoleUseCase } from '@application/masterAdmin/RejeterEcoleUseCase';
import type { ChangerPlanAbonnementUseCase } from '@application/masterAdmin/ChangerPlanAbonnementUseCase';
import type { PlanType } from '@domain/types/enums';
import { sendTransactionalEmail } from '../../../services/emailService';

export class MasterAdminHexController {
  constructor(
    private readonly inviter: InviterEcoleUseCase,
    private readonly suspendre: SuspendreEcoleUseCase,
    private readonly reactiver: ReactiverEcoleUseCase,
    private readonly rejeter: RejeterEcoleUseCase,
    private readonly changerPlan: ChangerPlanAbonnementUseCase,
    private readonly prisma: PrismaClient,
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

  // GET /api/v2/master/schools
  listerEcoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, search, page = '1', limit = '50' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const where: any = {};
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { subdomain: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const [schools, total] = await Promise.all([
        this.prisma.school.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            invites: { where: { status: 'PENDING' }, take: 1, orderBy: { createdAt: 'desc' } },
            _count: { select: { users: true, classes: true } },
          },
        }),
        this.prisma.school.count({ where }),
      ]);

      res.json({
        success: true,
        data: schools,
        pagination: { page: parseInt(page as string), limit: take, total, pages: Math.ceil(total / take) },
      });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /api/v2/master/schools/:id
  detailEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const school = await this.prisma.school.findUnique({
        where: { id: req.params.id as string },
        include: {
          invites: { orderBy: { createdAt: 'desc' }, take: 5 },
          schoolConfig: true,
          schoolSettings: true,
          _count: { select: { users: true, classes: true, subjects: true, feePlans: true } },
        },
      });

      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }

      res.json({ success: true, data: school });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // DELETE /api/v2/master/schools/:id
  supprimerEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const school = await this.prisma.school.findUnique({ where: { id } });
      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }

      await this.prisma.$transaction(async (tx) => {
        // TeacherSubject → Subject n'a pas de CASCADE : suppression manuelle d'abord
        await tx.teacherSubject.deleteMany({ where: { subject: { schoolId: id } } });
        // Tout le reste cascade depuis school (onDelete: Cascade dans le schéma)
        await tx.school.delete({ where: { id } });
      });

      res.json({ success: true, message: 'École supprimée définitivement' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/resend-invite
  renvoyerInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const school = await this.prisma.school.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          invites: { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }

      const invite = (school.invites as any[])[0];
      if (!invite) {
        res.status(400).json({ success: false, message: 'Aucune invitation active à renvoyer pour cette école' });
        return;
      }

      const newToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

      await this.prisma.schoolInvite.update({
        where: { id: invite.id as string },
        data: { token: newToken, expiresAt },
      });

      const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const activationUrl = `${frontendUrl}/onboarding/${newToken}`;

      // Répondre immédiatement — l'email s'envoie en arrière-plan
      res.json({ success: true, message: `Invitation renvoyée à ${invite.email as string}` });

      sendTransactionalEmail({
        recipientEmail: invite.email as string,
        subject: `EduNexus — Renvoi d'invitation : ${invite.schoolName as string}`,
        html: `
          <p>Bonjour,</p>
          <p>Votre invitation pour l'établissement <strong>${invite.schoolName as string}</strong> a été renvoyée.</p>
          <p>Cliquez sur le lien ci-dessous pour activer votre espace (lien valable 72h) :</p>
          <p><a href="${activationUrl}" style="background:#059669;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Activer mon espace EduNexus</a></p>
          <p style="color:#888;font-size:13px">Lien direct : ${activationUrl}</p>
        `,
        template: 'school_invite',
        eventType: 'school_invite',
      }).catch(err => console.error('[Email] Échec renvoi invitation:', err));
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/reexamine
  reexaminerEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const school = await this.prisma.school.findUnique({ where: { id }, select: { id: true, status: true, name: true } });
      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }
      if (school.status !== 'REJECTED') {
        res.status(400).json({ success: false, message: 'Seule une école rejetée peut être réexaminée' });
        return;
      }
      await this.prisma.school.update({ where: { id }, data: { status: 'PENDING' } });
      res.json({ success: true, message: `La demande de ${school.name} est remise en examen` });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /api/v2/master/auth/logs
  listerLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { action, page = '1', limit = '50' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const where: any = {};
      if (action) where.action = action;

      const [logs, total] = await Promise.all([
        this.prisma.masterAuthAudit.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: { masterUser: { select: { id: true, email: true, name: true } } },
        }),
        this.prisma.masterAuthAudit.count({ where }),
      ]);

      res.json({
        success: true,
        data: logs,
        pagination: { page: parseInt(page as string), limit: take, total, pages: Math.ceil(total / take) },
      });
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
