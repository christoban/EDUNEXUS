import type { Request, Response, NextFunction } from 'express';
import type { CreerEmploiDuTempsUseCase } from '@application/timetable/CreerEmploiDuTempsUseCase';
import type { AjouterCreneauUseCase } from '@application/timetable/AjouterCreneauUseCase';
import type { ModifierCreneauUseCase } from '@application/timetable/ModifierCreneauUseCase';
import type { PublierEmploiDuTempsUseCase } from '@application/timetable/PublierEmploiDuTempsUseCase';
import type { DemanderRattrapageUseCase } from '@application/timetable/DemanderRattrapageUseCase';
import { ConflitHoraireError } from '@domain/errors/ConflitHoraireError';
import { VolumeHoraireAPError } from '@domain/errors/VolumeHoraireAPError';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { resolveLanguage } from '../../../utils/languageHelper';

export class TimetableController {
  constructor(
    private readonly creer: CreerEmploiDuTempsUseCase,
    private readonly ajouterCreneau: AjouterCreneauUseCase,
    private readonly modifierCreneau: ModifierCreneauUseCase,
    private readonly publier: PublierEmploiDuTempsUseCase,
    private readonly demanderRattrapage: DemanderRattrapageUseCase,
  ) {}

  creerManuel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { classId, academicYearId } = req.body;

      if (!classId || !academicYearId) {
        res.status(400).json({ success: false, message: 'classId et academicYearId requis' });
        return;
      }

      const resultat = await this.creer.execute({
        schoolId: user.schoolId,
        classId,
        academicYearId,
      });
      res.status(resultat.estNouveauCree ? 201 : 200).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  ajouterSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const resultat = await this.ajouterCreneau.execute({
        timetableId: req.params['id'] as string,
        schoolId: user.schoolId,
        ...req.body,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  modifierSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      await this.modifierCreneau.execute({
        creneauId: req.params['slotId'] as string,
        timetableId: req.params['id'] as string,
        schoolId: user.schoolId,
        ...req.body,
      });
      res.json({ success: true, message: 'Créneau mis à jour' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  publierEDT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      await this.publier.execute({
        timetableId: req.params['id'] as string,
        schoolId: user.schoolId,
      });
      res.json({ success: true, message: 'Emploi du temps publié' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  demanderCours = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { classId, subjectId, proposedDate, proposedStartTime, proposedEndTime, reason } = req.body;

      if (!classId || !proposedDate) {
        res.status(400).json({ success: false, message: 'classId et proposedDate requis' });
        return;
      }

      const school = await prisma.school.findUnique({ where: { id: user.schoolId }, select: { subsystem: true } })
      const lang = resolveLanguage(school?.subsystem)
      await this.demanderRattrapage.execute({
        schoolId: user.schoolId,
        classId,
        subjectId,
        teacherId: user.userId,
        proposedDate: new Date(proposedDate),
        proposedStartTime,
        proposedEndTime,
        reason,
        lang,
      });

      res.json({ success: true, statut: 'pending' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof ConflitHoraireError) {
      res.status(409).json({ success: false, code: 'CONFLIT_HORAIRE', message: error.message });
      return;
    }
    if (error instanceof VolumeHoraireAPError) {
      res.status(409).json({ success: false, code: 'VOLUME_AP_DEPASSE', message: error.message });
      return;
    }
    if (error instanceof Error) {
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('Impossible') || error.message.includes('déjà publié')) {
        res.status(422).json({ success: false, message: error.message });
        return;
      }
      if (
        error.message.includes('Accès refusé') ||
        error.message.includes("n'appartient pas")
      ) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
