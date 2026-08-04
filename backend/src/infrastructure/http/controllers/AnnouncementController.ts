import type { PrismaClient, UserRole } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';
import { CreerAnnonceUseCase } from '@application/announcement/CreerAnnonceUseCase';
import { ListerAnnoncesUseCase } from '@application/announcement/ListerAnnoncesUseCase';
import { ModifierAnnonceUseCase } from '@application/announcement/ModifierAnnonceUseCase';
import { SupprimerAnnonceUseCase } from '@application/announcement/SupprimerAnnonceUseCase';
import { SocketNotificationService } from '@infrastructure/services/SocketNotificationService';

export class AnnouncementController {
  private readonly creerAnnonce: CreerAnnonceUseCase;
  private readonly listerAnnonces: ListerAnnoncesUseCase;
  private readonly modifierAnnonce: ModifierAnnonceUseCase;
  private readonly supprimerAnnonce: SupprimerAnnonceUseCase;
  private readonly notificationService: SocketNotificationService;

  constructor(private readonly prisma: PrismaClient) {
    this.creerAnnonce = new CreerAnnonceUseCase(prisma);
    this.listerAnnonces = new ListerAnnoncesUseCase(prisma);
    this.modifierAnnonce = new ModifierAnnonceUseCase(prisma);
    this.supprimerAnnonce = new SupprimerAnnonceUseCase(prisma);
    this.notificationService = new SocketNotificationService();
  }

  creer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { title, content, targetRoles, isPinned, expiresAt } = req.body as {
        title?: string;
        content?: string;
        targetRoles?: UserRole[];
        isPinned?: boolean;
        expiresAt?: string | null;
      };

      const annonce = await this.creerAnnonce.execute({
        schoolId: user.schoolId,
        authorId: user.userId,
        role: user.role,
        title: title ?? '',
        content: content ?? '',
        targetRoles: Array.isArray(targetRoles) ? targetRoles : [],
        isPinned,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      const rolesCibles = Array.from(new Set((annonce.targetRoles ?? targetRoles ?? []) as UserRole[]));
      const destinataires = rolesCibles.length > 0
        ? await (this.prisma as any).user.findMany({
            where: { schoolId: user.schoolId, role: { in: rolesCibles }, isActive: true },
            select: { id: true },
          })
        : [];

      await Promise.allSettled(
        destinataires.map((destinataire: { id: string }) =>
          this.notificationService.envoyer({
            schoolId: user.schoolId,
            userId: destinataire.id,
            type: 'COMMUNICATION',
            titre: annonce.title,
            corps: annonce.content,
            canal: 'PUSH',
            metadata: {
              announcementId: annonce.id,
              authorId: annonce.authorId,
              targetRoles: rolesCibles,
            },
          }),
        ),
      );

      res.status(201).json({ success: true, data: annonce });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const annonces = await this.listerAnnonces.execute({
        schoolId: user.schoolId,
        role: user.role,
      });

      res.json({ success: true, data: annonces });
    } catch (error) {
      next(error);
    }
  };

  modifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { title, content, targetRoles, isPinned, expiresAt } = req.body as {
        title?: string;
        content?: string;
        targetRoles?: UserRole[];
        isPinned?: boolean;
        expiresAt?: string | null;
      };

      const annonce = await this.modifierAnnonce.execute({
        schoolId: user.schoolId,
        announcementId: String(req.params['id']),
        userId: user.userId,
        role: user.role,
        title: title ?? '',
        content: content ?? '',
        targetRoles: Array.isArray(targetRoles) ? targetRoles : [],
        isPinned,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      res.json({ success: true, data: annonce });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  supprimer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const deleted = await this.supprimerAnnonce.execute({
        schoolId: user.schoolId,
        announcementId: String(req.params['id']),
        userId: user.userId,
        role: user.role,
      });

      res.json({ success: true, data: deleted });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };
}
